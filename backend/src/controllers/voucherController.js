const { Voucher, Event, Order, TicketTier } = require("../models");
const { httpError, validId, ah, intIn, date } = require("../utils/http");
const { audit } = require("../utils/audit");
const { _helpers: H } = require("./organizerEventController");

const CODE = /^[A-Z0-9_-]{3,30}$/;

async function ownVoucher(req, id) {
  const v = await Voucher.findById(validId(id, "ID voucher"));
  const e = v && (await Event.findOne({ _id: v.event_id, organizer_id: req.user.id }));
  if (!v || !e) throw httpError("Không tìm thấy voucher", 404);
  return { voucher: v, event: e };
}

/** Khoảng thời gian bán vé của sự kiện = từ giờ mở bán sớm nhất đến giờ đóng bán muộn nhất của các hạng vé. */
async function saleWindow(eventId) {
  const tiers = await TicketTier.find({ event_id: eventId }).select("sale_start_time sale_end_time");
  if (!tiers.length) return null;
  return {
    from: new Date(Math.min(...tiers.map((t) => +t.sale_start_time))),
    to: new Date(Math.max(...tiers.map((t) => +t.sale_end_time))),
  };
}

const fmt = (d) => new Date(d).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

function assertInSaleWindow(win, from, until) {
  if (!win) throw httpError("Sự kiện chưa có hạng vé nào, hãy tạo hạng vé (xác định thời gian bán vé) trước khi tạo voucher", 409);
  if (from < win.from || until > win.to) {
    throw httpError(`Thời gian hiệu lực voucher phải nằm trong thời gian bán vé (${fmt(win.from)} – ${fmt(win.to)})`, 400);
  }
}

function statusOf(v, now = new Date()) {
  if (!v.is_active) return "PAUSED";
  if (v.usage_limit > 0 && v.used_count >= v.usage_limit) return "EXHAUSTED";
  if (now < v.valid_from) return "UPCOMING";
  if (now > v.valid_until) return "EXPIRED";
  return "RUNNING";
}

const toClient = (v, statsMap) => {
  const st = statsMap?.get(String(v._id)) || {
    paidOrdersCount: 0,
    totalDiscountGranted: 0,
    grossOrderSubtotal: 0,
    netRevenueGenerated: 0,
  };
  return {
    status: statusOf(v), remainingCount: Math.max(0, (v.usage_limit || 0) - (v.used_count || 0)),
    createdAt: v.created_at,
    _id: v._id, eventId: v.event_id, code: v.code, discountType: v.discount_type, discountValue: v.discount_value,
    maxDiscountAmount: v.max_discount_amount, minOrderAmount: v.min_order_amount, usageLimit: v.usage_limit,
    usedCount: v.used_count, maxPerUser: v.max_per_user, validFrom: v.valid_from, validUntil: v.valid_until, isActive: v.is_active,
    stats: {
      paidOrdersCount: st.paidOrdersCount,
      totalDiscountGranted: st.totalDiscountGranted,
      grossOrderSubtotal: st.grossOrderSubtotal,
      netRevenueGenerated: st.netRevenueGenerated,
      usageRatePct: v.usage_limit > 0 ? Math.round((v.used_count / v.usage_limit) * 10000) / 100 : 0,
    },
  };
};

function checkValue(type, value) {
  if (type === "PERCENT") return H.num(value, 0.01, 100, "discountValue (%)");
  return H.num(value, 1, 100_000_000, "discountValue (đ)");
}

// GET /v1/organizer/events/:eventId/vouchers (+ thống kê hiệu quả khuyến mãi)
exports.list = ah(async (req, res) => {
  const event = await H.ownEvent(req, req.params.eventId);
  const [items, win, agg] = await Promise.all([
    Voucher.find({ event_id: event._id }).sort({ _id: -1 }),
    saleWindow(event._id),
    Order.aggregate([
      { $match: { event_id: event._id, status: "PAID", voucher_id: { $ne: null } } },
      {
        $group: {
          _id: "$voucher_id",
          paidOrdersCount: { $sum: 1 },
          totalDiscountGranted: { $sum: { $ifNull: ["$discount_amount", 0] } },
          grossOrderSubtotal: { $sum: { $ifNull: ["$subtotal", 0] } },
          netRevenueGenerated: { $sum: { $ifNull: ["$total_amount", 0] } },
        },
      },
    ]),
  ]);

  const statsMap = new Map(agg.map((r) => [String(r._id), r]));
  const clientItems = items.map((v) => toClient(v, statsMap));
  const summary = clientItems.reduce(
    (acc, it) => {
      acc.totalVouchers += 1;
      if (it.isActive) acc.activeVouchers += 1;
      acc.totalUsedCount += it.usedCount || 0;
      acc.paidOrdersWithVoucher += it.stats.paidOrdersCount;
      acc.totalDiscountGranted += it.stats.totalDiscountGranted;
      acc.netRevenueGenerated += it.stats.netRevenueGenerated;
      return acc;
    },
    {
      totalVouchers: 0,
      activeVouchers: 0,
      totalUsedCount: 0,
      paidOrdersWithVoucher: 0,
      totalDiscountGranted: 0,
      netRevenueGenerated: 0,
    },
  );

  res.json({
    success: true, summary, items: clientItems,
    saleWindow: win && { from: win.from, to: win.to },
    event: { _id: event._id, title: event.title, status: event.status },
  });
});

// POST /v1/organizer/events/:eventId/vouchers
exports.create = ah(async (req, res) => {
  const event = await H.ownEvent(req, req.params.eventId);
  if (["CANCELLED", "ENDED"].includes(event.status)) throw httpError("Sự kiện đã kết thúc hoặc bị huỷ", 409);
  const b = req.body || {};
  const code = String(b.code || "").trim().toUpperCase();
  if (!CODE.test(code)) throw httpError("Mã voucher gồm 3–30 ký tự A–Z, 0–9, _ hoặc -", 400);
  const type = String(b.discountType || "").toUpperCase();
  if (!["PERCENT", "FIXED"].includes(type)) throw httpError("discountType phải là PERCENT hoặc FIXED", 400);
  const from = date(b.validFrom ?? new Date(), "validFrom");
  const until = date(b.validUntil, "validUntil");
  if (until <= from) throw httpError("validUntil phải sau validFrom", 400);
  assertInSaleWindow(await saleWindow(event._id), from, until);

  const doc = {
    event_id: event._id, code, discount_type: type, discount_value: checkValue(type, b.discountValue),
    min_order_amount: H.num(b.minOrderAmount ?? 0, 0, 1_000_000_000, "minOrderAmount"),
    usage_limit: intIn(b.usageLimit, 1, 1_000_000, "usageLimit"),
    max_per_user: intIn(b.maxPerUser ?? 1, 1, 100, "maxPerUser"),
    valid_from: from, valid_until: until, is_active: b.isActive === undefined ? true : H.bool(b.isActive),
  };
  if (b.maxDiscountAmount !== undefined && b.maxDiscountAmount !== null) {
    if (type !== "PERCENT") throw httpError("maxDiscountAmount chỉ dùng cho voucher PERCENT", 400);
    doc.max_discount_amount = H.num(b.maxDiscountAmount, 1, 100_000_000, "maxDiscountAmount");
  }
  const v = await Voucher.create(doc); // trùng mã trong sự kiện -> unique index -> 409
  await audit(req, "VOUCHER_CREATE", "vouchers", v._id, { code, eventId: event._id });
  res.status(201).json({ success: true, voucher: toClient(v) });
});

// PUT /v1/organizer/vouchers/:id
exports.update = ah(async (req, res) => {
  const { voucher, event } = await ownVoucher(req, req.params.id);
  if (["CANCELLED", "ENDED"].includes(event.status)) throw httpError("Sự kiện đã kết thúc hoặc bị huỷ", 409);
  const b = req.body || {};
  const set = {};
  const used = voucher.used_count > 0;

  if (b.code !== undefined || b.discountType !== undefined || b.discountValue !== undefined || b.maxDiscountAmount !== undefined || b.minOrderAmount !== undefined) {
    if (used) throw httpError("Voucher đã có người dùng: không đổi mã / mức giảm / điều kiện. Hãy tắt (isActive=false) và tạo voucher mới.", 409);
    const type = b.discountType !== undefined ? String(b.discountType).toUpperCase() : voucher.discount_type;
    if (!["PERCENT", "FIXED"].includes(type)) throw httpError("discountType phải là PERCENT hoặc FIXED", 400);
    if (b.code !== undefined) {
      const code = String(b.code).trim().toUpperCase();
      if (!CODE.test(code)) throw httpError("Mã voucher gồm 3–30 ký tự A–Z, 0–9, _ hoặc -", 400);
      set.code = code;
    }
    set.discount_type = type;
    set.discount_value = checkValue(type, b.discountValue !== undefined ? b.discountValue : voucher.discount_value);
    if (b.minOrderAmount !== undefined) set.min_order_amount = H.num(b.minOrderAmount, 0, 1_000_000_000, "minOrderAmount");
    if (type === "PERCENT" && b.maxDiscountAmount !== undefined) set.max_discount_amount = H.num(b.maxDiscountAmount, 1, 100_000_000, "maxDiscountAmount");
    if (type === "FIXED") set.$unset = { max_discount_amount: 1 };
  }
  if (b.usageLimit !== undefined) {
    const n = intIn(b.usageLimit, 1, 1_000_000, "usageLimit");
    if (n < voucher.used_count) throw httpError(`usageLimit không được nhỏ hơn số lượt đã dùng (${voucher.used_count})`, 409);
    set.usage_limit = n;
  }
  if (b.maxPerUser !== undefined) set.max_per_user = intIn(b.maxPerUser, 1, 100, "maxPerUser");
  const from = b.validFrom !== undefined ? date(b.validFrom, "validFrom") : voucher.valid_from;
  const until = b.validUntil !== undefined ? date(b.validUntil, "validUntil") : voucher.valid_until;
  if (until <= from) throw httpError("validUntil phải sau validFrom", 400);
  if (b.validFrom !== undefined || b.validUntil !== undefined) assertInSaleWindow(await saleWindow(event._id), from, until);
  if (b.validFrom !== undefined) set.valid_from = from;
  if (b.validUntil !== undefined) set.valid_until = until;
  if (b.isActive !== undefined) set.is_active = H.bool(b.isActive);
  if (!Object.keys(set).length) throw httpError("Không có trường nào để cập nhật", 400);

  const { $unset, ...$set } = set;
  const updated = await Voucher.findByIdAndUpdate(voucher._id, { $set, ...($unset ? { $unset } : {}) }, { new: true, runValidators: false });
  await audit(req, "VOUCHER_UPDATE", "vouchers", voucher._id, { fields: Object.keys(b) });
  res.json({ success: true, voucher: toClient(updated) });
});

// DELETE /v1/organizer/vouchers/:id — chưa ai dùng thì xoá; đã dùng thì phải tắt
exports.remove = ah(async (req, res) => {
  const { voucher } = await ownVoucher(req, req.params.id);
  const del = await Voucher.deleteOne({ _id: voucher._id, used_count: 0 });
  if (!del.deletedCount) throw httpError("Voucher đã có lượt dùng, không xoá được. Hãy tắt bằng PUT isActive=false.", 409);
  await audit(req, "VOUCHER_DELETE", "vouchers", voucher._id, { code: voucher.code });
  res.json({ success: true, message: "Đã xoá voucher" });
});
