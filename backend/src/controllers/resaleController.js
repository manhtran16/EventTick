const mongoose = require("mongoose");
const { ResaleListing, Ticket, Event, Order } = require("../models");
const bookingService = require("../services/bookingService");
const { audit } = require("../utils/audit");
const { ah, httpError, validId, str } = require("../utils/http");

const seatLabel = (s) => (s ? `${s.section_name}-${s.row_label}${s.seat_number}` : null);

// Tin bán đã quá hạn giữ chỗ mà job chưa kịp nhả (và chưa bị seller yêu cầu huỷ): coi như còn bán
const expiredReserveFilter = () => ({ status: "RESERVED", reserved_until: { $lt: new Date() }, cancel_requested: { $ne: true } });

/* ============================ NGƯỜI BÁN ============================ */

// POST /v1/resale/listings — Đăng bán lại 1 hoặc nhiều vé cùng hạng/suất thành 1 gói (kèm tài khoản nhận tiền)
//  body: { ticketIds: [...] | ticketId, resalePrice, allowPartial?, bankName, accountNo, accountHolder }
exports.createListing = ah(async (req, res) => {
  const { resalePrice, bankName, accountNo, accountHolder } = req.body;
  const rawIds = Array.isArray(req.body.ticketIds) && req.body.ticketIds.length ? req.body.ticketIds : [req.body.ticketId];
  const ticketIds = [...new Set(rawIds.map((id) => validId(id, "Mã vé")))];
  if (ticketIds.length > 10) throw httpError("Mỗi gói bán lại tối đa 10 vé", 400);
  const allowPartial = req.body.allowPartial !== false; // mặc định cho mua lẻ
  const priceNum = Number(resalePrice);
  if (!Number.isFinite(priceNum) || priceNum <= 0) throw httpError("Giá bán lại không hợp lệ", 400);

  const payoutBank = {
    bank_name: str(bankName, 100, "tên ngân hàng nhận tiền"),
    account_no: str(accountNo, 50, "số tài khoản nhận tiền"),
    account_holder: str(accountHolder, 150, "tên chủ tài khoản"),
  };
  if (!/^[0-9]{6,20}$/.test(payoutBank.account_no)) throw httpError("Số tài khoản chỉ gồm 6–20 chữ số", 400);

  const tickets = await Ticket.find({ _id: { $in: ticketIds }, owner_id: req.user.id }).populate("tier_id").populate("event_id").populate("session_id");
  if (tickets.length !== ticketIds.length) throw httpError("Không tìm thấy vé hợp lệ thuộc tài khoản của bạn", 404);

  const first = tickets[0];
  for (const t of tickets) {
    if (t.status !== "VALID") throw httpError(`Không thể đăng bán vé ở trạng thái ${t.status}`, 400);
    if (String(t.tier_id?._id) !== String(first.tier_id?._id) || String(t.session_id?._id) !== String(first.session_id?._id)) {
      throw httpError("Các vé trong một gói phải cùng hạng vé và cùng suất diễn", 400);
    }
  }
  const startTime = first.session_id?.start_time || first.event_id?.start_time;
  if (startTime && new Date() >= startTime) throw httpError("Suất diễn đã bắt đầu, không thể đăng bán lại vé", 400);

  const originalPrice = first.tier_id?.price || priceNum;
  const maxAllowedPrice = Math.round(originalPrice * 1.1); // Trần 110% giá gốc chống phe vé
  if (priceNum > maxAllowedPrice) {
    throw httpError(`Giá bán lại vượt trần quy định (tối đa 110% giá gốc: ${maxAllowedPrice.toLocaleString("vi-VN")} ₫)`, 400);
  }

  // Khoá vé nguyên tử: tất cả hoặc không
  const lockRes = await Ticket.updateMany({ _id: { $in: ticketIds }, owner_id: req.user.id, status: "VALID" }, { status: "LISTED_RESALE" });
  if (lockRes.modifiedCount !== ticketIds.length) {
    await Ticket.updateMany({ _id: { $in: ticketIds }, status: "LISTED_RESALE", owner_id: req.user.id }, { status: "VALID" });
    throw httpError("Vé đang được xử lý hoặc không còn hợp lệ", 409);
  }

  const bundleCode = `RSL${String(Date.now()).slice(-6)}${String(Math.floor(Math.random() * 900) + 100)}`;
  const created = [];
  try {
    for (const t of tickets) {
      // ticket_id unique: vé từng đăng bán rồi huỷ -> dùng lại bản ghi cũ
      const fields = {
        seller_id: req.user.id,
        original_price: originalPrice,
        resale_price: priceNum,
        status: "ACTIVE",
        cancel_requested: false,
        bundle_code: bundleCode,
        allow_partial: allowPartial,
        payout_bank: payoutBank,
        payout_status: "NONE",
        created_at: new Date(),
      };
      let listing = await ResaleListing.findOneAndUpdate(
        { ticket_id: t._id, status: "CANCELLED" },
        { $set: fields, $unset: { buyer_order_id: 1, reserved_until: 1, payout_amount: 1, payout_ref: 1, paid_out_at: 1, paid_out_by: 1 } },
        { new: true },
      );
      if (!listing) listing = await ResaleListing.create({ ticket_id: t._id, ...fields });
      created.push(listing);
    }
  } catch (err) {
    await ResaleListing.updateMany({ _id: { $in: created.map((l) => l._id) } }, { status: "CANCELLED", cancel_requested: false });
    await Ticket.updateMany({ _id: { $in: ticketIds }, status: "LISTED_RESALE" }, { status: "VALID" });
    throw err;
  }

  await audit(req, "RESALE_LIST_CREATE", "resale_listings", created[0]._id, { ticketIds, resalePrice: priceNum, bundleCode, allowPartial });

  res.status(201).json({
    success: true,
    message: "Đăng bán lại vé thành công!",
    listing: { id: created[0]._id, bundleCode, quantity: created.length, allowPartial, originalPrice, resalePrice: priceNum, status: "ACTIVE", createdAt: created[0].created_at },
  });
});

// DELETE /v1/resale/listings/:id — Huỷ tin bán (hướng C: huỷ ngay nếu ACTIVE; trì hoãn nếu đang RESERVED)
exports.cancelListing = ah(async (req, res) => {
  const listingId = validId(req.params.id, "Mã tin bán");

  // 1. Thử huỷ ngay bằng atomic update nếu tin đang ACTIVE hoặc đã quá hạn giữ chỗ
  const listing = await ResaleListing.findOneAndUpdate(
    { _id: listingId, seller_id: req.user.id, $or: [{ status: "ACTIVE" }, expiredReserveFilter()] },
    { $set: { status: "CANCELLED", cancel_requested: false }, $unset: { reserved_until: 1, buyer_order_id: 1 } },
    { new: true },
  );

  if (listing) {
    await Ticket.updateOne({ _id: listing.ticket_id, status: "LISTED_RESALE" }, { status: "VALID" });
    await audit(req, "RESALE_LIST_CANCEL", "resale_listings", listing._id, { ticketId: listing.ticket_id });
    return res.json({ success: true, message: "Đã huỷ đăng bán lại vé thành công" });
  }

  // 2. Nếu đang có người giữ chỗ thanh toán (RESERVED): ghi nhận huỷ trì hoãn (Hướng C)
  const reservedListing = await ResaleListing.findOneAndUpdate(
    { _id: listingId, seller_id: req.user.id, status: "RESERVED" },
    { $set: { cancel_requested: true } },
    { new: true },
  );

  if (reservedListing) {
    await audit(req, "RESALE_LIST_CANCEL_REQUESTED", "resale_listings", reservedListing._id, { ticketId: reservedListing.ticket_id });
    return res.json({
      success: true,
      cancelRequested: true,
      message: "Vé đang có người thanh toán, yêu cầu hủy sẽ có hiệu lực sau tối đa 10 phút nếu họ không hoàn tất.",
    });
  }

  // 3. Kiểm tra lý do thất bại nếu không trúng 2 bước trên
  const exists = await ResaleListing.findOne({ _id: listingId, seller_id: req.user.id });
  if (!exists) throw httpError("Không tìm thấy tin bán vé", 404);
  if (exists.status === "SOLD") throw httpError("Vé đã được bán thành công, không thể huỷ tin", 400);
  if (exists.status === "CANCELLED") throw httpError("Tin bán vé đã được huỷ trước đó", 400);
  throw httpError(`Tin bán vé đang ở trạng thái ${exists.status}`, 400);
});

// GET /v1/resale/my-listings
exports.getMyListings = ah(async (req, res) => {
  const listings = await ResaleListing.find({ seller_id: req.user.id })
    .populate({
      path: "ticket_id",
      populate: [
        { path: "event_id", select: "title banner_url venue_name" },
        { path: "tier_id", select: "name price" },
        { path: "seat_id", select: "section_name row_label seat_number" },
      ],
    })
    .sort({ created_at: -1 });

  res.json({
    success: true,
    listings: listings.map((l) => ({
      id: l._id,
      resalePrice: l.resale_price,
      originalPrice: l.original_price,
      status: l.status,
      cancelRequested: Boolean(l.cancel_requested),
      payoutStatus: l.payout_status || "NONE",
      payoutAmount: l.payout_amount,
      paidOutAt: l.paid_out_at,
      ticketCode: l.ticket_id?.ticket_code,
      eventName: l.ticket_id?.event_id?.title,
      tierName: l.ticket_id?.tier_id?.name,
      seat: seatLabel(l.ticket_id?.seat_id),
      createdAt: l.created_at,
    })),
  });
});

/* ============================ NGƯỜI MUA ============================ */

/** Các tin bán còn mua được (ACTIVE hoặc giữ chỗ đã hết hạn), kèm vé đã populate */
async function loadBuyableListings(ticketMatch = {}, { includeHeld = false } = {}) {
  // includeHeld: lấy thêm các tin đang được người khác giữ chỗ để hiển thị "đang chờ thanh toán"
  const statusClause = includeHeld
    ? [{ status: "ACTIVE", cancel_requested: { $ne: true } }, { status: "RESERVED" }]
    : [{ status: "ACTIVE", cancel_requested: { $ne: true } }, expiredReserveFilter()];
  const listings = await ResaleListing.find({ $or: statusClause })
    .populate({
      path: "ticket_id",
      match: { status: "LISTED_RESALE", ...ticketMatch },
      populate: [
        { path: "tier_id", select: "name price zone_color" },
        { path: "seat_id", select: "section_name row_label seat_number" },
        { path: "session_id", select: "name start_time end_time status" },
      ],
    })
    .sort({ resale_price: 1, created_at: 1 });
  const now = new Date();
  return listings.filter((l) => l.ticket_id && l.ticket_id.session_id && l.ticket_id.session_id.start_time > now);
}

// GET /v1/resale/events — Trang chợ: danh sách sự kiện đang có vé bán lại
exports.getResaleEvents = ah(async (req, res) => {
  const listings = await loadBuyableListings();
  const byEvent = new Map();
  for (const l of listings) {
    const key = String(l.ticket_id.event_id);
    const cur = byEvent.get(key) || { count: 0, minPrice: Infinity, nextSession: null };
    cur.count += 1;
    cur.minPrice = Math.min(cur.minPrice, l.resale_price);
    const st = l.ticket_id.session_id.start_time;
    if (!cur.nextSession || st < cur.nextSession) cur.nextSession = st;
    byEvent.set(key, cur);
  }

  const events = await Event.find({ _id: { $in: [...byEvent.keys()] }, status: "PUBLISHED" })
    .select("title banner_url thumbnail_url venue_name city start_time");

  const q = String(req.query.q || "").trim().toLowerCase();
  const result = events
    .filter((e) => !q || e.title.toLowerCase().includes(q))
    .map((e) => {
      const agg = byEvent.get(String(e._id));
      return {
        id: e._id,
        title: e.title,
        bannerUrl: e.thumbnail_url || e.banner_url,
        venueName: e.venue_name,
        city: e.city,
        nextSessionTime: agg.nextSession,
        listingCount: agg.count,
        minPrice: agg.minPrice,
      };
    })
    .sort((a, b) => new Date(a.nextSessionTime) - new Date(b.nextSessionTime));

  res.json({ success: true, events: result, total: result.length });
});

// GET /v1/resale/events/:eventId — Chi tiết sự kiện + các tin bán (gom theo hạng vé)
exports.getEventListings = ah(async (req, res) => {
  const eventId = validId(req.params.eventId, "Mã sự kiện");
  const event = await Event.findById(eventId).select("title banner_url thumbnail_url venue_name city custom_form_schema status description");
  if (!event) throw httpError("Không tìm thấy sự kiện", 404);

  const listings = await loadBuyableListings({ event_id: new mongoose.Types.ObjectId(eventId) }, { includeHeld: true });
  const myId = req.user?.id;
  const now = new Date();

  const sessions = new Map();
  for (const l of listings) {
    const s = l.ticket_id.session_id;
    if (!sessions.has(String(s._id))) sessions.set(String(s._id), { id: s._id, name: s.name, startTime: s.start_time });
  }

  // Gom thành "gói": các vé cùng mã bundle_code (tin cũ không có mã thì mỗi tin là 1 gói)
  const bundleMap = new Map();
  for (const l of listings) {
    const code = l.bundle_code || `RSL${String(l._id).slice(-9).toUpperCase()}`;
    let b = bundleMap.get(code);
    if (!b) {
      b = {
        code,
        tierId: l.ticket_id.tier_id?._id,
        tierName: l.ticket_id.tier_id?.name || "Vé",
        zoneColor: l.ticket_id.tier_id?.zone_color,
        sessionId: l.ticket_id.session_id._id,
        allowPartial: l.allow_partial !== false,
        items: [],
      };
      bundleMap.set(code, b);
    }
    const held = l.status === "RESERVED" && l.reserved_until && l.reserved_until >= now;
    b.items.push({
      id: l._id,
      displayCode: String(l._id).slice(-5).toUpperCase(),
      resalePrice: l.resale_price,
      originalPrice: l.original_price,
      seat: seatLabel(l.ticket_id.seat_id),
      held: Boolean(held), // người khác đang thanh toán
      heldUntil: held ? l.reserved_until : undefined,
      isMine: Boolean(myId && String(l.seller_id) === String(myId)),
    });
  }
  const bundles = [...bundleMap.values()]
    .filter((b) => !b.items.every((i) => i.isMine)) // ẩn gói của chính mình
    .map((b) => ({ ...b, items: b.items.filter((i) => !i.isMine) }));

  res.json({
    success: true,
    event: {
      id: event._id,
      title: event.title,
      bannerUrl: event.thumbnail_url || event.banner_url,
      venueName: event.venue_name,
      city: event.city,
      formSchema: Array.isArray(event.custom_form_schema) ? event.custom_form_schema : [],
    },
    sessions: [...sessions.values()].sort((a, b) => new Date(a.startTime) - new Date(b.startTime)),
    bundles,
    total: bundles.reduce((s, b) => s + b.items.length, 0),
  });
});

// POST /v1/resale/orders — Giữ chỗ các vé bán lại 10 phút, trả về orderId để sang trang thanh toán
exports.createResaleOrder = ah(async (req, res) => {
  const { eventId, listingIds, attendeeFormAnswers, refundBankInfo, voucherCode, agreeTerms } = req.body;
  validId(eventId, "Mã sự kiện");
  if (agreeTerms !== true) throw httpError("Bạn cần đồng ý với Quy định sử dụng tính năng Bán lại vé", 400);

  const order = await bookingService.createResaleOrderHold({
    buyerId: req.user.id,
    eventId,
    listingIds,
    attendeeFormAnswers,
    refundBankInfo,
    voucherCode,
  });

  await audit(req, "RESALE_ORDER_HOLD", "orders", order._id, {
    listingIds: order.resale_listing_ids,
    amount: order.total_amount,
  });

  res.status(201).json({
    success: true,
    message: "Đã giữ vé trong 10 phút, vui lòng thanh toán",
    orderId: order._id,
    orderCode: order.order_code,
    totalAmount: order.total_amount,
    expiresAt: order.lock_expires_at,
  });
});

// Luồng cũ (mua ngay không thanh toán) đã bỏ: giữ route để báo lỗi rõ ràng
exports.buyListing = (req, res) =>
  res.status(410).json({ success: false, message: "Vui lòng mua vé bán lại qua trang sự kiện trên Chợ vé (có bước thanh toán)" });

/* ============================ ADMIN: CHI TRẢ NGƯỜI BÁN ============================ */

// GET /v1/admin/resale/payouts?status=PENDING|PAID
exports.adminListPayouts = ah(async (req, res) => {
  const status = ["PENDING", "PAID"].includes(req.query.status) ? req.query.status : "PENDING";
  const listings = await ResaleListing.find({ status: "SOLD", payout_status: status })
    .populate("seller_id", "full_name username email phone")
    .populate({ path: "ticket_id", populate: [{ path: "event_id", select: "title" }, { path: "tier_id", select: "name" }] })
    .populate("buyer_order_id", "order_code total_amount status")
    .sort({ created_at: -1 })
    .limit(200);

  res.json({
    success: true,
    payouts: listings.map((l) => ({
      id: l._id,
      seller: {
        name: l.seller_id?.full_name || l.seller_id?.username,
        email: l.seller_id?.email,
        phone: l.seller_id?.phone,
      },
      eventTitle: l.ticket_id?.event_id?.title,
      tierName: l.ticket_id?.tier_id?.name,
      resalePrice: l.resale_price,
      payoutAmount: l.payout_amount ?? l.resale_price,
      bank: l.payout_bank
        ? { bankName: l.payout_bank.bank_name, accountNo: l.payout_bank.account_no, accountHolder: l.payout_bank.account_holder }
        : null,
      buyerOrderCode: l.buyer_order_id?.order_code,
      payoutStatus: l.payout_status,
      payoutRef: l.payout_ref,
      paidOutAt: l.paid_out_at,
    })),
  });
});

// PUT /v1/admin/resale/payouts/:id/paid — Admin xác nhận đã chuyển tiền cho người bán
exports.adminMarkPayoutPaid = ah(async (req, res) => {
  const payoutRef = str(req.body.payoutRef, 255, "mã giao dịch chuyển khoản");
  const listing = await ResaleListing.findOneAndUpdate(
    { _id: validId(req.params.id, "Mã tin bán"), status: "SOLD", payout_status: "PENDING" },
    { payout_status: "PAID", payout_ref: payoutRef, paid_out_at: new Date(), paid_out_by: req.user.id },
    { new: true },
  );
  if (!listing) throw httpError("Khoản chi trả không tồn tại hoặc đã được xử lý", 409);

  const order = await Order.findById(listing.buyer_order_id).select("status");
  await audit(req, "RESALE_PAYOUT_PAID", "resale_listings", listing._id, {
    amount: listing.payout_amount,
    payoutRef,
    buyerOrderStatus: order?.status,
  });
  res.json({ success: true, message: "Đã ghi nhận chi trả cho người bán" });
});
