const crypto = require("crypto");
const mongoose = require("mongoose");
const {
  Event,
  EventSession,
  TicketTier,
  Seat,
  Voucher,
  Order,
  Ticket,
  Payment,
  RefundRequest,
  ResaleListing,
  EContract,
} = require("../models");
const seatLock = require("./seatLockService");
const ticketMail = require("./ticketMailService");
const mailService = require("../utils/mailService");

const HOLD_MS = seatLock.HOLD_SECONDS * 1000;
const QR_SECRET = process.env.QR_SECRET || process.env.JWT_SECRET_KEY || "dev_qr_secret";

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function genOrderCode() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `ORD-${d}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function validateRefundBankInfo(info) {
  if (!info || typeof info !== "object") {
    throw httpError("Vui lòng điền thông tin tài khoản nhận tiền nếu sự kiện bị huỷ", 400);
  }
  const bankName = String(info.bankName || info.bank_name || "").trim();
  const accountNo = String(info.accountNo || info.account_no || "").trim();
  const accountHolder = String(info.accountHolder || info.account_holder || "").trim().toUpperCase();
  if (!bankName) throw httpError("Vui lòng nhập tên ngân hàng nhận tiền", 400);
  if (!/^[0-9]{6,20}$/.test(accountNo)) throw httpError("Số tài khoản phải gồm 6–20 chữ số", 400);
  if (!accountHolder) throw httpError("Vui lòng nhập tên chủ tài khoản", 400);
  return { bank_name: bankName, account_no: accountNo, account_holder: accountHolder };
}

function signTicket(ticketCode) {
  return crypto.createHmac("sha256", QR_SECRET).update(ticketCode).digest("hex");
}

async function restoreStock(items) {
  for (const it of items) {
    await TicketTier.updateOne({ _id: it.tier_id }, { $inc: { available_quantity: it.quantity } });
  }
}

/** Trả ghế về AVAILABLE (chỉ ghế còn LOCKED) + nhả khóa Redis của đơn */
async function releaseSeats({ sessionId, seatIds, orderId }) {
  if (!seatIds.length) return;
  await Seat.updateMany(
    { _id: { $in: seatIds }, status: "LOCKED" },
    { $set: { status: "AVAILABLE" }, $unset: { locked_by_user_id: 1, lock_expires_at: 1 } },
  );
  await seatLock.unlockSeats(sessionId, seatIds, orderId);
}

const allSeatIds = (items) => items.flatMap((it) => (it.seat_ids || []).map(String));

/**
 * 1. GIỮ CHỖ 10 PHÚT
 *  - Vé đứng (GA):  items = [{ tierId, quantity }]  -> trừ kho ticket_tiers nguyên tử.
 *  - Vé ngồi:       items = [{ seatIds: [...] }]    -> khóa ghế trên Redis (SET NX EX, all-or-nothing),
 *                   đánh dấu ghế LOCKED trong MongoDB, đồng thời trừ kho hạng vé tương ứng.
 *  Đơn lưu items_snapshot để sinh vé / hoàn kho / nhả ghế sau này.
 */
async function createOrderHold({
  buyerId,
  eventId,
  sessionId,
  items,
  voucherCode,
  attendeeFormAnswers,
  vatInvoiceInfo,
}) {
  const event = await Event.findById(eventId);
  if (!event) throw httpError("Không tìm thấy sự kiện", 404);
  if (!sessionId) throw httpError("Thiếu suất diễn", 400);
  const session = await EventSession.findOne({ _id: sessionId, event_id: event._id });
  if (!session) throw httpError("Không tìm thấy suất diễn này của sự kiện", 404);
  if (session.status !== "SCHEDULED" || session.end_time < new Date()) {
    throw httpError("Suất diễn đã kết thúc hoặc bị huỷ", 400);
  }
  if (event.status !== "PUBLISHED") throw httpError("Sự kiện chưa mở bán", 400);
  if (!Array.isArray(items) || items.length === 0) throw httpError("Đơn hàng phải có ít nhất 1 vé", 400);

  const orderId = new mongoose.Types.ObjectId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + HOLD_MS);

  // ---- Chuẩn hoá thành lines: tierId -> { quantity, seatIds[] }
  const lines = new Map();
  const seatIdsWanted = [];
  // Một sự kiện có thể trộn khu GA (tierId + quantity) và khu ghế đánh số (seatIds); kiểm tra theo từng dòng
  const sessionTiers = new Map((await TicketTier.find({ session_id: session._id })).map((t) => [String(t._id), t]));
  for (const item of items) {
    const ids = (item.seatIds || item.seat_ids || []).map(String);
    if (ids.length > 0) {
      seatIdsWanted.push(...ids);
    } else {
      const tierId = String(item.tierId || item.zoneId || item.ticketId || "");
      if (sessionTiers.get(tierId)?.zone_type === "SEATED") {
        throw httpError(`Hạng vé "${sessionTiers.get(tierId).name}" bán theo ghế đánh số: vui lòng chọn ghế (seatIds)`, 400);
      }
      const quantity = Number(item.quantity);
      if (!tierId || !Number.isInteger(quantity) || quantity <= 0) {
        throw httpError("Thông tin loại vé hoặc số lượng không hợp lệ", 400);
      }
      const line = lines.get(tierId) || { quantity: 0, seatIds: [] };
      line.quantity += quantity;
      lines.set(tierId, line);
    }
  }

  let seats = [];
  if (seatIdsWanted.length) {
    if (new Set(seatIdsWanted).size !== seatIdsWanted.length) throw httpError("Danh sách ghế bị trùng", 400);
    if (!seatIdsWanted.every((id) => mongoose.isValidObjectId(id))) throw httpError("seatIds không hợp lệ", 400);
    seats = await Seat.find({ _id: { $in: seatIdsWanted }, session_id: session._id });
    if (seats.length !== seatIdsWanted.length) throw httpError("Có ghế không thuộc suất diễn này", 404);
    const taken = seats.filter((s) => s.status !== "AVAILABLE" && !(s.status === "LOCKED" && s.lock_expires_at < now));
    if (taken.length) {
      throw httpError(`Ghế đã có người giữ/mua: ${taken.map((s) => `${s.section_name}-${s.row_label}${s.seat_number}`).join(", ")}`, 409);
    }
    for (const s of seats) {
      const line = lines.get(String(s.tier_id)) || { quantity: 0, seatIds: [] };
      line.quantity += 1;
      line.seatIds.push(String(s.id));
      lines.set(String(s.tier_id), line);
    }
  }

  // ---- Các bước có thể phải hoàn tác
  const reservedTiers = [];
  let lockedSeatIds = [];
  let voucherBumped = null;

  const rollback = async () => {
    await restoreStock(reservedTiers);
    await releaseSeats({ sessionId: session._id, seatIds: lockedSeatIds, orderId });
    if (voucherBumped) await Voucher.updateOne({ _id: voucherBumped }, { $inc: { used_count: -1 } });
  };

  try {
    // 1a. Khóa ghế: Redis (nguyên tử, tất cả hoặc không) rồi tới MongoDB
    if (seats.length) {
      const redisOk = await seatLock.lockSeats(session._id, seatIdsWanted, orderId);
      if (!redisOk) throw httpError("Một hoặc nhiều ghế vừa có người khác giữ, vui lòng chọn ghế khác", 409);
      lockedSeatIds = [...seatIdsWanted];

      const res = await Seat.updateMany(
        {
          _id: { $in: seatIdsWanted },
          $or: [{ status: "AVAILABLE" }, { status: "LOCKED", lock_expires_at: { $lt: now } }],
        },
        { $set: { status: "LOCKED", locked_by_user_id: buyerId, lock_expires_at: expiresAt } },
      );
      if (res.modifiedCount !== seatIdsWanted.length) {
        // Có ghế vừa bị bán: trả lại những ghế mình vừa khóa
        await Seat.updateMany(
          { _id: { $in: seatIdsWanted }, status: "LOCKED", locked_by_user_id: buyerId, lock_expires_at: expiresAt },
          { $set: { status: "AVAILABLE" }, $unset: { locked_by_user_id: 1, lock_expires_at: 1 } },
        );
        await seatLock.unlockSeats(session._id, seatIdsWanted, orderId);
        lockedSeatIds = [];
        throw httpError("Một hoặc nhiều ghế vừa được người khác mua, vui lòng chọn lại", 409);
      }
    }

    // 1b. Trừ kho từng hạng vé (atomic)
    const snapshot = [];
    let subtotal = 0;
    for (const [tierId, line] of lines) {
      const tier = await TicketTier.findOne({ _id: tierId, session_id: session._id });
      if (!tier) throw httpError("Hạng vé không thuộc suất diễn này", 404);
      if (now < tier.sale_start_time || now > tier.sale_end_time) {
        throw httpError(`Hạng vé "${tier.name}" không trong thời gian mở bán`, 400);
      }
      if (line.quantity < tier.min_per_order || line.quantity > tier.max_per_order) {
        throw httpError(
          `Hạng vé "${tier.name}": mỗi đơn mua từ ${tier.min_per_order} đến ${tier.max_per_order} vé`,
          400,
        );
      }
      const updated = await TicketTier.findOneAndUpdate(
        { _id: tier._id, available_quantity: { $gte: line.quantity } },
        { $inc: { available_quantity: -line.quantity } },
        { new: true },
      );
      if (!updated) throw httpError(`Hạng vé "${tier.name}" không đủ số lượng còn lại`, 409);

      reservedTiers.push({ tier_id: tier._id, quantity: line.quantity });
      subtotal += tier.price * line.quantity;
      snapshot.push({
        tier_id: tier._id,
        tier_name: tier.name,
        unit_price: tier.price,
        quantity: line.quantity,
        seat_ids: line.seatIds,
      });
    }

    // 2. Voucher (nếu có) — lượt dùng cập nhật atomic
    let voucher = null;
    let discount = 0;
    if (voucherCode && String(voucherCode).trim()) {
      voucher = await findUsableVoucher({ eventId: event._id, code: voucherCode, buyerId, subtotal, now });
      const bumped = await Voucher.findOneAndUpdate(
        { _id: voucher._id, $expr: { $lt: ["$used_count", "$usage_limit"] } },
        { $inc: { used_count: 1 } },
        { new: true },
      );
      if (!bumped) throw httpError("Mã giảm giá đã hết lượt sử dụng", 400);
      voucherBumped = voucher._id;

      discount = voucherDiscount(voucher, subtotal);
    }

    return await Order.create({
      _id: orderId,
      buyer_id: buyerId,
      event_id: event._id,
      session_id: session._id,
      voucher_id: voucher ? voucher._id : undefined,
      order_code: genOrderCode(),
      order_type: "PRIMARY",
      items_snapshot: snapshot,
      subtotal_amount: subtotal,
      discount_amount: discount,
      total_amount: Math.max(0, subtotal - discount),
      status: "PENDING_PAYMENT",
      lock_expires_at: expiresAt,
      attendee_form_answers: attendeeFormAnswers || [],
      vat_invoice_info: vatInvoiceInfo || undefined,
    });
  } catch (err) {
    await rollback();
    throw err;
  }
}

/**
 * 2. NHẢ ĐƠN: PENDING_PAYMENT -> EXPIRED | CANCELLED
 *    Chuyển trạng thái bằng findOneAndUpdate để mỗi đơn chỉ được hoàn kho đúng 1 lần.
 */
async function releaseOrder(filter, newStatus) {
  const order = await Order.findOneAndUpdate({ ...filter, status: "PENDING_PAYMENT" }, { status: newStatus }, { new: true });
  if (!order) return null;
  if (order.order_type === "RESALE") {
    // Đơn mua lại: không đụng kho / ghế, xử lý các tin bán thuộc đơn
    const listingIds = order.resale_listing_ids || [];
    if (listingIds.length) {
      // Hướng C: nhóm có seller yêu cầu huỷ trong lúc giữ chỗ -> CANCELLED và trả vé về VALID
      const cancelRequestedListings = await ResaleListing.find({
        _id: { $in: listingIds },
        status: "RESERVED",
        buyer_order_id: order._id,
        cancel_requested: true,
      }).select("_id ticket_id");

      if (cancelRequestedListings.length) {
        const cIds = cancelRequestedListings.map((l) => l._id);
        const tIds = cancelRequestedListings.map((l) => l.ticket_id);
        await ResaleListing.updateMany(
          { _id: { $in: cIds } },
          { $set: { status: "CANCELLED", cancel_requested: false }, $unset: { reserved_until: 1, buyer_order_id: 1 } },
        );
        await Ticket.updateMany(
          { _id: { $in: tIds }, status: "LISTED_RESALE" },
          { $set: { status: "VALID" } },
        );
      }

      // Nhóm không yêu cầu huỷ -> trả về ACTIVE cho người khác mua
      await ResaleListing.updateMany(
        { _id: { $in: listingIds }, status: "RESERVED", buyer_order_id: order._id, cancel_requested: { $ne: true } },
        { $set: { status: "ACTIVE" }, $unset: { reserved_until: 1, buyer_order_id: 1 } },
      );
    }
    return order;
  }
  await restoreStock(order.items_snapshot);
  await releaseSeats({ sessionId: order.session_id, seatIds: allSeatIds(order.items_snapshot), orderId: order._id });
  if (order.voucher_id) await Voucher.updateOne({ _id: order.voucher_id }, { $inc: { used_count: -1 } });
  return order;
}

/** Dọn dẹp các tin bán lại hết hạn giữ chỗ: nếu cancel_requested=true thì CANCELLED + hoàn vé, ngược lại trả về ACTIVE. */
async function releaseExpiredResaleListings() {
  const now = new Date();
  const cancelListings = await ResaleListing.find({
    status: "RESERVED",
    reserved_until: { $lt: now },
    cancel_requested: true,
  }).select("_id ticket_id");

  if (cancelListings.length) {
    const cIds = cancelListings.map((l) => l._id);
    const tIds = cancelListings.map((l) => l.ticket_id);
    await ResaleListing.updateMany(
      { _id: { $in: cIds } },
      { $set: { status: "CANCELLED", cancel_requested: false }, $unset: { reserved_until: 1, buyer_order_id: 1 } },
    );
    await Ticket.updateMany(
      { _id: { $in: tIds }, status: "LISTED_RESALE" },
      { $set: { status: "VALID" } },
    );
  }

  await ResaleListing.updateMany(
    {
      status: "RESERVED",
      reserved_until: { $lt: now },
      cancel_requested: { $ne: true },
    },
    { $set: { status: "ACTIVE" }, $unset: { reserved_until: 1, buyer_order_id: 1 } },
  );
}

/** Quét các đơn quá hạn 10 phút: EXPIRED + hoàn kho + trả ghế. Gọi định kỳ bởi job. */
async function releaseExpiredOrders() {
  let count = 0;
  for (;;) {
    const order = await releaseOrder({ lock_expires_at: { $lt: new Date() } }, "EXPIRED");
    if (!order) break;
    count++;
  }
  await releaseExpiredResaleListings().catch(() => {});
  return count;
}

/** Nhả mọi đơn đang giữ chỗ của một sự kiện (dùng khi Organizer huỷ sự kiện). Trả về số đơn đã nhả. */
async function cancelPendingOrdersOfEvent(eventId) {
  let count = 0;
  for (;;) {
    const order = await releaseOrder({ event_id: eventId }, "CANCELLED");
    if (!order) break;
    count++;
  }
  return count;
}

/** Khách chủ động huỷ đơn chưa thanh toán. */
async function cancelPendingOrder({ orderId, buyerId }) {
  const order = await Order.findById(orderId);
  if (!order || order.buyer_id.toString() !== String(buyerId)) throw httpError("Không tìm thấy đơn hàng", 404);
  if (order.status !== "PENDING_PAYMENT") throw httpError(`Đơn đang ở trạng thái ${order.status}, không thể huỷ`, 409);
  return releaseOrder({ _id: order._id }, "CANCELLED");
}

/** Số tiền giảm của voucher trên tổng tiền vé. */
function voucherDiscount(voucher, subtotal) {
  if (voucher.discount_type === "PERCENT") {
    const d = Math.round((subtotal * voucher.discount_value) / 100);
    return voucher.max_discount_amount > 0 ? Math.min(d, voucher.max_discount_amount) : d;
  }
  return Math.min(voucher.discount_value, subtotal);
}

/** Tìm voucher dùng được cho sự kiện + người mua + tổng tiền; ném lỗi tiếng Việt nếu không hợp lệ (chưa trừ lượt). */
async function findUsableVoucher({ eventId, code, buyerId, subtotal, now = new Date() }) {
  const c = String(code || "").trim().toUpperCase();
  const voucher = c ? await Voucher.findOne({ event_id: eventId, code: c }) : null;
  if (!voucher || !voucher.is_active) throw httpError("Mã giảm giá không tồn tại hoặc đã bị vô hiệu hóa", 400);
  if (now < voucher.valid_from || now > voucher.valid_until) throw httpError("Mã giảm giá chưa/đã hết hiệu lực", 400);
  if (subtotal < (voucher.min_order_amount || 0)) {
    throw httpError(`Đơn hàng chưa đạt giá trị tối thiểu ${voucher.min_order_amount.toLocaleString("vi-VN")} ₫`, 400);
  }
  if (voucher.usage_limit && voucher.used_count >= voucher.usage_limit) throw httpError("Mã giảm giá đã hết lượt sử dụng", 400);
  const usedByUser = await Order.countDocuments({
    buyer_id: buyerId,
    voucher_id: voucher._id,
    status: { $in: ["PENDING_PAYMENT", "PAID"] },
  });
  if (usedByUser >= (voucher.max_per_user || 1)) {
    throw httpError(`Bạn đã hết số lần dùng mã này (tối đa ${voucher.max_per_user})`, 400);
  }
  return voucher;
}

/** Xem trước voucher (không trừ lượt): trả về số tiền giảm và tổng sau giảm. */
async function previewVoucher({ eventId, code, buyerId, subtotal }) {
  const sub = Number(subtotal);
  if (!Number.isFinite(sub) || sub <= 0) throw httpError("Chưa chọn vé nào để áp dụng mã", 400);
  if (!mongoose.isValidObjectId(eventId)) throw httpError("Sự kiện không hợp lệ", 400);
  const voucher = await findUsableVoucher({ eventId, code, buyerId, subtotal: sub });
  const discount = voucherDiscount(voucher, sub);
  return { code: voucher.code, discountType: voucher.discount_type, discountValue: voucher.discount_value, discount, total: Math.max(0, sub - discount) };
}

/**
 * 3. XÁC NHẬN THANH TOÁN: orders -> PAID, payments (1-1), sinh tickets, ghế -> SOLD.
 */
async function confirmPaymentAndIssueTickets({ orderId, buyerId, gateway = "VNPAY", transactionRef, webhookPayload }) {
  const order = await Order.findById(orderId);
  if (!order) throw httpError("Không tìm thấy đơn hàng", 404);
  if (buyerId && order.buyer_id.toString() !== buyerId.toString()) throw httpError("Không có quyền với đơn hàng này", 403);

  if (order.status === "PAID") {
    return {
      order,
      payment: await Payment.findOne({ order_id: order._id }),
      tickets: await Ticket.find({ order_id: order._id }),
    };
  }
  if (order.status === "EXPIRED" || order.status === "CANCELLED" || order.lock_expires_at < new Date()) {
    await releaseExpiredOrders();
    throw httpError("Đơn hàng đã hết hạn giữ chỗ (10 phút). Kho vé đã được hoàn trả, vui lòng đặt lại.", 410);
  }

  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, status: "PENDING_PAYMENT" },
    { status: "PAID" },
    { new: true },
  );
  if (!claimed) throw httpError("Đơn hàng đang được xử lý", 409);

  const payment = await Payment.create({
    order_id: claimed._id,
    gateway,
    transaction_ref: transactionRef || `TX-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    amount: claimed.total_amount,
    status: "SUCCESS",
    webhook_payload: webhookPayload,
    paid_at: new Date(),
  });

  if (claimed.order_type === "RESALE") {
    const tickets = await issueResaleTickets(claimed);
    ticketMail.sendTicketEmailForOrder(claimed, tickets);
    return { order: claimed, payment, tickets };
  }

  const seatIds = allSeatIds(claimed.items_snapshot);
  if (seatIds.length) {
    await Seat.updateMany(
      { _id: { $in: seatIds } },
      { $set: { status: "SOLD" }, $unset: { locked_by_user_id: 1, lock_expires_at: 1 } },
    );
    await seatLock.unlockSeats(claimed.session_id, seatIds, claimed._id);
  }

  const docs = [];
  for (const item of claimed.items_snapshot) {
    for (let i = 0; i < item.quantity; i++) {
      const ticketCode = `TK-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      docs.push({
        order_id: claimed._id,
        event_id: claimed.event_id,
        session_id: claimed.session_id,
        tier_id: item.tier_id,
        seat_id: item.seat_ids?.[i] || undefined, // Vé đứng: không có seat_id
        owner_id: claimed.buyer_id,
        ticket_code: ticketCode,
        qr_hash_signature: signTicket(ticketCode),
        status: "VALID",
      });
    }
  }
  const tickets = await Ticket.insertMany(docs);
  ticketMail.sendTicketEmailForOrder(claimed, tickets);

  return { order: claimed, payment, tickets };
}

/* ===================== CHỢ VÉ BÁN LẠI (RESALE) ===================== */

/** Kiểm tra câu trả lời form của BTC (custom_form_schema): bắt buộc / select hợp lệ. Trả về object đã làm sạch. */
function validateFormAnswers(formSchema, answers) {
  const fields = Array.isArray(formSchema) ? formSchema : [];
  const input = answers && typeof answers === "object" && !Array.isArray(answers) ? answers : {};
  const clean = {};
  for (const f of fields) {
    let v = input[f.key];
    if (f.type === "checkbox") v = Boolean(v);
    else if (v !== undefined && v !== null) v = String(v).trim().slice(0, 1000);
    const empty = f.type === "checkbox" ? v !== true : !v;
    if (f.required && empty) throw httpError(`Vui lòng trả lời câu hỏi: "${f.label}"`, 400);
    if (f.type === "select" && v && !(f.options || []).includes(v)) {
      throw httpError(`Lựa chọn không hợp lệ cho câu hỏi "${f.label}"`, 400);
    }
    if (f.type === "number" && v && !Number.isFinite(Number(v))) {
      throw httpError(`Câu hỏi "${f.label}" phải là số`, 400);
    }
    if (v !== undefined && v !== "") clean[f.key] = v;
  }
  return clean;
}

/**
 * GIỮ CHỖ ĐƠN MUA LẠI (10 phút) — giống luồng mua vé thường nhưng:
 *  - Không áp dụng voucher.
 *  - Không trừ kho / khoá ghế: chỉ chuyển các tin bán ACTIVE -> RESERVED (nguyên tử).
 *  - Tiền chuyển vào tài khoản nền tảng; Admin chi trả cho người bán sau khi vé đã được cấp.
 */
async function createResaleOrderHold({ buyerId, eventId, listingIds, attendeeFormAnswers, refundBankInfo, voucherCode }) {
  if (voucherCode && String(voucherCode).trim()) {
    throw httpError("Vé bán lại không áp dụng mã giảm giá", 400);
  }
  const ids = [...new Set((Array.isArray(listingIds) ? listingIds : []).map(String))];
  if (!ids.length) throw httpError("Vui lòng chọn ít nhất 1 vé", 400);
  if (ids.length > 10) throw httpError("Mỗi đơn mua lại tối đa 10 vé", 400);
  if (!ids.every((id) => mongoose.isValidObjectId(id))) throw httpError("Mã tin bán không hợp lệ", 400);

  const event = await Event.findById(eventId);
  if (!event) throw httpError("Không tìm thấy sự kiện", 404);
  if (event.status !== "PUBLISHED") throw httpError("Sự kiện không còn mở bán", 400);

  const listings = await ResaleListing.find({ _id: { $in: ids } }).populate("ticket_id");
  if (listings.length !== ids.length) throw httpError("Có vé không còn tồn tại", 404);

  let sessionId = null;
  for (const l of listings) {
    const t = l.ticket_id;
    const staleReserve = l.status === "RESERVED" && l.reserved_until && l.reserved_until < new Date();
    if (l.status !== "ACTIVE" && !staleReserve) throw httpError("Có vé vừa được người khác giữ hoặc đã bán, vui lòng chọn lại", 409);
    if (String(l.seller_id) === String(buyerId)) throw httpError("Không thể mua lại vé của chính mình", 400);
    if (!t || t.status !== "LISTED_RESALE" || String(t.event_id) !== String(event._id)) {
      throw httpError("Có vé không hợp lệ để mua", 409);
    }
    if (sessionId && String(t.session_id) !== String(sessionId)) {
      throw httpError("Các vé trong một đơn phải cùng suất diễn", 400);
    }
    sessionId = t.session_id;
  }

  // Gói "không bán lẻ": phải mua đủ mọi vé còn bán trong gói
  const wholeBundles = [...new Set(listings.filter((l) => l.allow_partial === false && l.bundle_code).map((l) => l.bundle_code))];
  for (const code of wholeBundles) {
    const members = await ResaleListing.find({
      bundle_code: code,
      $or: [{ status: "ACTIVE" }, { status: "RESERVED", reserved_until: { $lt: new Date() } }],
    }).select("_id");
    const missing = members.filter((m) => !ids.includes(String(m._id)));
    if (missing.length) {
      throw httpError(`Gói vé ${code} không bán lẻ: vui lòng chọn tất cả ${members.length} vé trong gói`, 400);
    }
  }

  const session = await EventSession.findById(sessionId);
  if (!session || session.status !== "SCHEDULED" || session.start_time <= new Date()) {
    throw httpError("Suất diễn đã bắt đầu hoặc bị huỷ, không thể mua lại vé", 400);
  }

  const cleanAnswers = validateFormAnswers(event.custom_form_schema, attendeeFormAnswers);
  const cleanRefundBankInfo = validateRefundBankInfo(refundBankInfo);

  const orderId = new mongoose.Types.ObjectId();
  const expiresAt = new Date(Date.now() + HOLD_MS);

  // Giữ từng tin bán nguyên tử; thất bại thì trả lại những tin đã giữ
  const reserved = [];
  for (const l of listings) {
    const ok = await ResaleListing.findOneAndUpdate(
      {
        _id: l._id,
        cancel_requested: { $ne: true },
        $or: [{ status: "ACTIVE" }, { status: "RESERVED", reserved_until: { $lt: new Date() } }],
      },
      { status: "RESERVED", reserved_until: expiresAt, buyer_order_id: orderId },
    );
    if (!ok) {
      await ResaleListing.updateMany(
        { _id: { $in: reserved }, status: "RESERVED", buyer_order_id: orderId },
        { $set: { status: "ACTIVE" }, $unset: { reserved_until: 1, buyer_order_id: 1 } },
      );
      throw httpError("Có vé vừa được người khác giữ hoặc đã được hủy bán, vui lòng chọn lại", 409);
    }
    reserved.push(l._id);
  }

  try {
    const tierNames = new Map(
      (await TicketTier.find({ _id: { $in: listings.map((l) => l.ticket_id.tier_id) } }).select("name")).map((t) => [String(t._id), t.name]),
    );
    // Mỗi tin bán = 1 dòng snapshot (giá bán lại có thể khác nhau giữa các tin)
    const snapshot = listings.map((l) => ({
      tier_id: l.ticket_id.tier_id,
      tier_name: `${tierNames.get(String(l.ticket_id.tier_id)) || "Vé"} (Bán lại)`,
      unit_price: l.resale_price,
      quantity: 1,
      seat_ids: l.ticket_id.seat_id ? [l.ticket_id.seat_id] : [],
    }));
    const subtotal = listings.reduce((s, l) => s + l.resale_price, 0);

    return await Order.create({
      _id: orderId,
      buyer_id: buyerId,
      event_id: event._id,
      session_id: sessionId,
      order_code: genOrderCode(),
      order_type: "RESALE",
      resale_listing_ids: reserved,
      items_snapshot: snapshot,
      subtotal_amount: subtotal,
      discount_amount: 0,
      total_amount: subtotal,
      status: "PENDING_PAYMENT",
      lock_expires_at: expiresAt,
      attendee_form_answers: cleanAnswers,
      refund_bank_info: cleanRefundBankInfo,
    });
  } catch (err) {
    await ResaleListing.updateMany(
      { _id: { $in: reserved }, status: "RESERVED", buyer_order_id: orderId },
      { $set: { status: "ACTIVE" }, $unset: { reserved_until: 1, buyer_order_id: 1 } },
    );
    throw err;
  }
}

/** Sau khi đơn RESALE đã PAID: huỷ vé cũ, cấp vé mới cho người mua, đánh dấu chờ chi trả cho người bán. */
async function issueResaleTickets(order) {
  const listings = await ResaleListing.find({ _id: { $in: order.resale_listing_ids || [] } });
  const issued = [];
  for (const l of listings) {
    const sold = await ResaleListing.findOneAndUpdate(
      { _id: l._id, status: "RESERVED", buyer_order_id: order._id },
      {
        $set: { status: "SOLD", buyer_order_id: order._id, payout_amount: l.resale_price, payout_status: "PENDING", cancel_requested: false },
        $unset: { reserved_until: 1 },
      },
      { new: true },
    );
    if (!sold) {
      // Tin đã bị huỷ ngoài luồng: tiền đã vào nhưng không cấp được vé -> Admin xử lý thủ công
      console.warn(`[Resale] Đơn ${order.order_code}: không cấp được vé cho tin ${l._id} (trạng thái ${l.status})`);
      continue;
    }

    const oldTicket = await Ticket.findOneAndUpdate(
      { _id: l.ticket_id, status: "LISTED_RESALE" },
      { status: "RESOLD_INVALID" },
      { new: true },
    );
    if (!oldTicket) continue;

    const code = `TK-RS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    issued.push(
      await Ticket.create({
        order_id: order._id,
        event_id: oldTicket.event_id,
        session_id: oldTicket.session_id,
        tier_id: oldTicket.tier_id,
        seat_id: oldTicket.seat_id,
        owner_id: order.buyer_id,
        ticket_code: code,
        qr_hash_signature: signTicket(code),
        status: "VALID",
      }),
    );
  }
  return issued;
}

async function updateCheckoutInfo({ orderId, buyerId, attendeeFormAnswers, vatInvoiceInfo, refundBankInfo }) {
  const order = await Order.findById(orderId);
  if (!order || order.buyer_id.toString() !== String(buyerId)) throw httpError("Không tìm thấy đơn hàng", 404);
  if (!["PENDING_PAYMENT", "PAID"].includes(order.status)) throw httpError("Không thể cập nhật thông tin đơn hàng ở trạng thái này", 400);

  if (attendeeFormAnswers !== undefined) {
    if (order.status === "PENDING_PAYMENT") {
      const ev = await Event.findById(order.event_id).select("custom_form_schema");
      order.attendee_form_answers = validateFormAnswers(ev?.custom_form_schema, attendeeFormAnswers);
    } else {
      throw httpError("Đơn đã thanh toán, không sửa được câu trả lời", 400);
    }
  }
  if (vatInvoiceInfo !== undefined) {
    order.vat_invoice_info = vatInvoiceInfo;
  }
  if (order.status === "PENDING_PAYMENT") {
    order.refund_bank_info = validateRefundBankInfo(refundBankInfo);
  }
  await order.save();
  return order;
}

/**
 * UC23 / UC43: Huỷ sự kiện & hoàn tiền hàng loạt (Bulk Refund) cho toàn bộ đơn PAID,
 * nhả các đơn PENDING_PAYMENT, huỷ các tin đăng bán lại (ResaleListing) và gửi thông báo email.
 */
async function bulkRefundAndCancelEvent(eventId, reason = "Sự kiện bị huỷ theo quyết định của ban tổ chức / quản trị") {
  const e = await Event.findById(eventId);
  if (!e) throw httpError("Không tìm thấy sự kiện", 404);

  e.status = "CANCELLED";
  await e.save();
  await require("../utils/eventHistory").logEventStatus(e._id, "CANCELLED", { note: `Huỷ & hoàn tiền hàng loạt: ${reason}` });

  await EventSession.updateMany({ event_id: e._id }, { status: "CANCELLED" });
  await EContract.updateOne({ event_id: e._id, status: "WAITING_SIGN" }, { status: "REJECTED" });

  // 1. Nhả toàn bộ đơn đang chờ thanh toán (PENDING_PAYMENT)
  const releasedPendingOrders = await cancelPendingOrdersOfEvent(e._id);

  // 2. Huỷ mọi tin đăng bán lại đang ACTIVE của sự kiện này
  const eventTickets = await Ticket.find({ event_id: e._id }).select("_id seat_id").lean();
  const eventTicketIds = eventTickets.map((t) => t._id);
  let cancelledResaleCount = 0;
  if (eventTicketIds.length) {
    const resaleRes = await ResaleListing.updateMany(
      { ticket_id: { $in: eventTicketIds }, status: { $in: ["ACTIVE", "RESERVED"] } },
      { $set: { status: "CANCELLED" } },
    );
    cancelledResaleCount = resaleRes.modifiedCount || 0;
  }

  // 3. Hoàn tiền các vé chưa sử dụng của mọi đơn PAID.
  const paidOrders = await Order.find({ event_id: e._id, status: "PAID" }).populate("buyer_id", "email full_name username");

  let refundedCount = 0;
  let refundedTicketsCount = 0;
  let totalRefundAmount = 0;
  let notifiedBuyersCount = 0;

  for (const order of paidOrders) {
    const refundableTickets = await Ticket.find({
      order_id: order._id,
      status: { $in: ["VALID", "LISTED_RESALE"] },
    });
    if (!refundableTickets.length) continue;

    const lineByTier = new Map((order.items_snapshot || []).map((item) => [String(item.tier_id), item]));
    const refundableGross = refundableTickets.reduce(
      (sum, ticket) => sum + Number(lineByTier.get(String(ticket.tier_id))?.unit_price || 0),
      0,
    );
    const subtotal = Number(order.subtotal_amount || 0);
    const discount = Number(order.discount_amount || 0);
    const refundAmount = Math.max(
      0,
      Math.min(
        Number(order.total_amount || 0),
        Math.round(refundableGross - (subtotal ? (discount * refundableGross) / subtotal : 0)),
      ),
    );
    if (!refundAmount) continue;

    await Ticket.updateMany({ _id: { $in: refundableTickets.map((ticket) => ticket._id) } }, { status: "REFUNDED" });
    const remainingTickets = await Ticket.exists({
      order_id: order._id,
      status: { $in: ["VALID", "USED", "LISTED_RESALE"] },
    });
    if (!remainingTickets) {
      await Order.updateOne({ _id: order._id, status: "PAID" }, { status: "REFUNDED" });
    }

    await RefundRequest.findOneAndUpdate(
      { order_id: order._id, refund_type: "EVENT_BULK_REFUND", status: { $ne: "COMPLETED" } },
      {
        $set: {
          refund_amount: refundAmount,
          reason,
          status: "PROCESSING",
        },
        $setOnInsert: {
          order_id: order._id,
          user_id: order.buyer_id?._id || order.buyer_id,
          refund_type: "EVENT_BULK_REFUND",
        },
      },
      { upsert: true, new: true },
    );

    const buyerEmail = order.customer_info?.email || order.buyer_id?.email;
    const buyerName = order.customer_info?.full_name || order.buyer_id?.full_name || order.buyer_id?.username;
    if (buyerEmail) {
      const sent = await mailService.sendEventCancellationRefundEmail(buyerEmail, {
        buyerName,
        eventTitle: e.title,
        orderCode: order.order_code,
        refundAmount,
        reason,
      });
      if (sent) notifiedBuyersCount++;
    }

    refundedCount++;
    refundedTicketsCount += refundableTickets.length;
    totalRefundAmount += refundAmount;
  }

  return {
    event: e,
    refundedOrdersCount: refundedCount,
    refundedTicketsCount,
    totalRefundAmount,
    releasedPendingOrders,
    cancelledResaleCount,
    notifiedBuyersCount,
  };
}

/**
 * Chuyển sự kiện PUBLISHED sang ENDED khi suất diễn cuối đã kết thúc (end_time của sự kiện = suất muộn nhất).
 * Cập nhật nguyên tử theo điều kiện status để không đè lên sự kiện vừa bị huỷ.
 */
async function endFinishedEvents() {
  const { logEventStatus } = require("../utils/eventHistory");
  const due = await Event.find({ status: "PUBLISHED", end_time: { $lt: new Date() } }).select("_id");
  let count = 0;
  for (const e of due) {
    const r = await Event.updateOne({ _id: e._id, status: "PUBLISHED" }, { status: "ENDED" });
    if (r.modifiedCount) {
      count++;
      await EventSession.updateMany({ event_id: e._id, status: "SCHEDULED" }, { status: "ENDED" });
      await logEventStatus(e._id, "ENDED", { note: "Tự động: suất diễn cuối đã kết thúc" });
    }
  }
  return count;
}

/** Job nền: mỗi 30 giây hoàn kho + trả ghế các đơn quá hạn; mỗi ~5 phút chuyển sự kiện đã diễn xong sang ENDED. */
let timer = null;
function startExpirationJob(intervalMs = 30_000) {
  if (timer) return;
  let tick = 0;
  timer = setInterval(() => {
    releaseExpiredOrders()
      .then((n) => n && console.log(`[OrderExpirationJob] Đã nhả ${n} đơn quá hạn`))
      .catch((e) => console.error("[OrderExpirationJob] lỗi:", e.message));
    if (tick++ % 10 === 0) {
      endFinishedEvents()
        .then((n) => n && console.log(`[EventEndJob] Đã chuyển ${n} sự kiện sang ENDED`))
        .catch((e) => console.error("[EventEndJob] lỗi:", e.message));
    }
  }, intervalMs);
  timer.unref?.();
}

module.exports = {
  createOrderHold,
  createResaleOrderHold,
  previewVoucher,
  validateFormAnswers,
  updateCheckoutInfo,
  bulkRefundAndCancelEvent,
  releaseExpiredOrders,
  endFinishedEvents,
  cancelPendingOrder,
  cancelPendingOrdersOfEvent,
  confirmPaymentAndIssueTickets,
  startExpirationJob,
  signTicket,
};
