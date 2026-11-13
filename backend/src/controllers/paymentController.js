const { Order, Payment, Event, RefundRequest, Ticket } = require("../models");
const bookingService = require("../services/bookingService");
const sepay = require("../services/sepayService");
const { audit } = require("../utils/audit");
const { ah, httpError } = require("../utils/http");

const ORPHAN_ACTION = "PAYMENT_UNMATCHED";

function extractRefundId(body) {
  const text = [body.code, body.content, body.description].filter(Boolean).join(" ");
  const match = text.toUpperCase().match(/REFUND[-\s]?([A-F0-9]{24})/);
  return match ? match[1] : null;
}

async function processOutgoingRefund(req, body, txId, amount) {
  const refundId = extractRefundId(body);
  const transferRef = `SEPAY-OUT-${txId}`;
  if (!refundId) {
    await recordUnmatched(req, "Giao dịch tiền ra không có mã hoàn tiền hợp lệ", body, { transferRef });
    return { success: true, message: "Không có mã hoàn tiền hợp lệ" };
  }

  const refund = await RefundRequest.findOneAndUpdate(
    { _id: refundId, status: "PROCESSING", refund_amount: amount },
    {
      $set: {
        status: "COMPLETED",
        transfer_reference: transferRef,
        processed_at: new Date(),
        processing_note: "Tự động xác nhận từ webhook SePay",
      },
    },
    { new: true },
  );

  if (!refund) {
    const alreadyProcessed = await RefundRequest.exists({ _id: refundId, transfer_reference: transferRef });
    if (alreadyProcessed) return { success: true, message: "Khoản hoàn tiền đã được xác nhận trước đó" };
    const expected = await RefundRequest.findById(refundId).select("refund_amount").lean();
    await recordUnmatched(req, "Không khớp yêu cầu hoàn tiền hoặc số tiền", body, { refundId, transferRef, expectedAmount: expected?.refund_amount });
    return { success: true, message: "Không khớp yêu cầu hoàn tiền" };
  }

  const remainingTickets = await Ticket.exists({
    order_id: refund.order_id,
    status: { $in: ["VALID", "USED", "LISTED_RESALE"] },
  });
  if (!remainingTickets) {
    await Payment.updateOne(
      { order_id: refund.order_id, status: "SUCCESS" },
      { $set: { status: "REFUNDED" } },
    );
  }
  await audit(req, "REFUND_WEBHOOK_COMPLETED", "refund_requests", refund._id, {
    transferRef,
    amount,
    sepayId: txId,
  });
  return { success: true, message: "Đã tự động xác nhận hoàn tiền" };
}

/** Ghi lại giao dịch tiền vào KHÔNG gắn được với đơn nào (để Admin đối soát / hoàn tiền thủ công). */
async function recordUnmatched(req, reason, body, extra = {}) {
  console.warn(`[SePay] ${reason} (giao dịch ${body.id})`);
  await audit(req, ORPHAN_ACTION, "payments", `SEPAY-${body.id}`, {
    reason,
    sepayId: body.id,
    amount: body.transferAmount,
    content: body.content,
    referenceCode: body.referenceCode,
    transactionDate: body.transactionDate,
    ...extra,
  });
}

/**
 * POST /v1/payment/sepay-webhook   (SePay gọi, KHÔNG đăng nhập, xác thực bằng API key)
 *
 * Body SePay: { id, gateway, transactionDate, accountNumber, code, content,
 *               transferType: "in"|"out", transferAmount, accumulated, referenceCode, description }
 * HTTP 200 + {"success": true} = đã nhận, SePay ngừng gọi lại. Giao dịch không xử lý được vì lý do
 * nghiệp vụ vẫn trả 200 (tránh gọi lại vô hạn) và được log cảnh báo (action PAYMENT_UNMATCHED).
 * Chỉ lỗi hệ thống tạm thời mới trả 500 để SePay gọi lại.
 */
exports.sepayWebhook = async (req, res) => {
  if (!sepay.verifyApiKey(req.headers.authorization)) {
    return res.status(401).json({ success: false, message: "Sai API key" });
  }

  const body = req.body || {};
  const txId = body.id != null ? String(body.id) : null;
  if (!txId) return res.status(400).json({ success: false, message: "Thiếu id giao dịch" });
  const transferType = String(body.transferType || "").toLowerCase();
  const paid = Number(body.transferAmount);
  if (!Number.isFinite(paid) || paid <= 0) {
    return res.status(400).json({ success: false, message: "transferAmount không hợp lệ" });
  }

  try {
    if (transferType === "out") {
      return res.json(await processOutgoingRefund(req, body, txId, paid));
    }
    if (transferType !== "in") {
      return res.json({ success: true, message: "Bỏ qua loại giao dịch không hỗ trợ" });
    }

    // Chống xử lý trùng (SePay có thể gọi lại): transaction_ref = SEPAY-<id>
    const txRef = `SEPAY-${txId}`;
    if (await Payment.exists({ transaction_ref: txRef })) {
      return res.json({ success: true, message: "Giao dịch đã được xử lý trước đó" });
    }

    const orderCode = sepay.extractOrderCode(body.code) || sepay.extractOrderCode(body.content);
    if (!orderCode) {
      await recordUnmatched(req, "Nội dung chuyển khoản không có mã đơn hợp lệ", body);
      return res.json({ success: true, message: "Không có mã đơn hợp lệ trong nội dung" });
    }

    const order = await Order.findOne({ order_code: orderCode });
    if (!order) {
      await recordUnmatched(req, `Không tìm thấy đơn ${orderCode}`, body, { orderCode });
      return res.json({ success: true, message: "Không tìm thấy đơn hàng" });
    }

    if (order.status === "PAID") {
      // Khách chuyển thêm lần nữa cho đơn đã thanh toán -> tiền thừa, cần hoàn
      await recordUnmatched(req, "Đơn đã thanh toán trước đó, giao dịch này là tiền thừa", body, { orderCode, orderId: order._id });
      return res.json({ success: true, message: "Đơn đã thanh toán trước đó" });
    }

    if (paid < order.total_amount) {
      await recordUnmatched(req, `Chuyển thiếu tiền (${paid}/${order.total_amount})`, body, { orderCode, orderId: order._id, expected: order.total_amount });
      return res.json({ success: true, message: "Số tiền chuyển chưa đủ, đơn chưa được xác nhận" });
    }

    try {
      await bookingService.confirmPaymentAndIssueTickets({
        orderId: order._id,
        gateway: "VIETQR",
        transactionRef: txRef,
        webhookPayload: body,
      });
    } catch (err) {
      if (err.statusCode === 409 && (await Payment.exists({ transaction_ref: txRef }))) {
        // Webhook trùng gọi đồng thời: lần kia đã xử lý xong giao dịch này
        return res.json({ success: true, message: "Giao dịch đã được xử lý trước đó" });
      }
      if (err.statusCode === 410 || err.statusCode === 409) {
        // Đơn đã hết hạn / bị huỷ / đang xử lý nhưng tiền ĐÃ vào: cần hoàn tiền thủ công
        await recordUnmatched(req, `Đơn không còn hiệu lực: ${err.message}`, body, { orderCode, orderId: order._id, orderStatus: order.status });
        return res.json({ success: true, message: err.message });
      }
      throw err;
    }

    // Chuyển thừa: vẫn xác nhận đơn, ghi nhận phần dư để hoàn lại
    if (paid > order.total_amount) {
      await recordUnmatched(req, `Chuyển thừa ${paid - order.total_amount}đ`, body, { orderCode, orderId: order._id, expected: order.total_amount, surplus: paid - order.total_amount });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("[SePay] Lỗi xử lý webhook:", err);
    res.status(500).json({ success: false, message: "Lỗi xử lý, vui lòng gọi lại" });
  }
};

// GET /v1/payment/orders/:orderId/instructions — thông tin chuyển khoản + mã QR cho khách
exports.paymentInstructions = ah(async (req, res) => {
  const order = await Order.findById(req.params.orderId).catch(() => null);
  if (!order || order.buyer_id.toString() !== req.user.id) throw httpError("Không tìm thấy đơn hàng", 404);
  if (order.status !== "PENDING_PAYMENT") throw httpError(`Đơn đang ở trạng thái ${order.status}, không cần thanh toán`, 409);
  const ev = await Event.findById(order.event_id).select("custom_form_schema");
  try {
    bookingService.validateFormAnswers(ev?.custom_form_schema, order.attendee_form_answers);
  } catch (e) {
    return res.status(422).json({ success: false, needsForm: true, message: e.message });
  }
  res.json({
    success: true,
    orderId: order._id,
    orderCode: order.order_code,
    status: order.status,
    amount: order.total_amount,
    expiresAt: order.lock_expires_at,
    transferContent: sepay.paymentContent(order.order_code),
    ...sepay.bankInfo(),
    qrUrl: sepay.qrUrl({ amount: order.total_amount, orderCode: order.order_code }),
  });
});

// GET /v1/admin/payments/unmatched — Admin xem giao dịch cần đối soát / hoàn tiền thủ công
exports.listUnmatched = ah(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  res.json({ success: true, page, limit, total: 0, items: [] });
});
