const mongoose = require("mongoose");
const { Order, Ticket, StaffAssignment, RefundRequest, TicketTier, Event, EventSession, Seat, Payment, ResaleListing } = require("../models");
const bookingService = require("../services/bookingService");
const { audit } = require("../utils/audit");

function fail(res, err) {
  res.status(err.statusCode || 500).json({ success: false, message: err.message });
}

/** Định dạng đơn hàng cho front-end (PaymentPage đọc totalPrice, orderItems[].ticketName...). */
function orderToClient(order) {
  const o = order.toObject ? order.toObject() : order;
  return {
    ...o,
    id: o._id,
    event_id: o.event_id,
    session_id: o.session_id,
    totalPrice: o.total_amount,
    totalAmount: o.total_amount,
    finalAmount: o.total_amount,
    discountAmount: o.discount_amount,
    expiresAt: o.lock_expires_at,
    paymentStatus: o.status,
  };
}

function orderItemsToClient(order) {
  return (order.items_snapshot || []).map((it) => ({
    ticket_id: it.tier_id,
    ticketName: it.tier_name,
    ticketPrice: it.unit_price,
    quantity: it.quantity,
  }));
}

// POST /booking  |  POST /booking/carts/:eventId
exports.createBooking = async (req, res) => {
  try {
    const eventId = req.params.eventId || req.body.eventId;
    const rawItems = req.body.cartItems || req.body.items;
    const voucherCode = req.body.voucherCode || req.body.voucher;
    const sessionId =
      req.body.sessionId || (Array.isArray(rawItems) && rawItems[0]?.sessionId);
    const attendeeFormAnswers = req.body.attendeeFormAnswers || req.body.attendee_form_answers || req.body.attendeeAnswers;
    const vatInvoiceInfo = req.body.vatInvoiceInfo || req.body.vat_invoice_info || req.body.vatInfo;

    if (!eventId || !sessionId || !Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin đặt vé" });
    }

    const order = await bookingService.createOrderHold({
      buyerId: req.user.id,
      eventId,
      sessionId,
      items: rawItems,
      voucherCode,
      attendeeFormAnswers,
      vatInvoiceInfo,
    });

    res.json({
      success: true,
      bookingId: order._id,
      orderId: order._id,
      orderCode: order.order_code,
      totalAmount: order.total_amount,
      finalAmount: order.total_amount,
      discountAmount: order.discount_amount,
      expiresAt: order.lock_expires_at,
    });
  } catch (err) {
    fail(res, err);
  }
};

// PUT /booking/orders/:orderId/checkout-info (UC13, UC16)
exports.updateCheckoutInfo = async (req, res) => {
  try {
    const attendeeFormAnswers = req.body.attendeeFormAnswers || req.body.attendee_form_answers || req.body.attendeeAnswers;
    const vatInvoiceInfo = req.body.vatInvoiceInfo || req.body.vat_invoice_info || req.body.vatInfo;

    const order = await bookingService.updateCheckoutInfo({
      orderId: req.params.orderId,
      buyerId: req.user.id,
      attendeeFormAnswers,
      vatInvoiceInfo,
    });

    res.json({
      success: true,
      message: "Đã cập nhật thông tin đơn hàng",
      order: orderToClient(order),
    });
  } catch (err) {
    fail(res, err);
  }
};

// POST /booking/voucher-preview { eventId, code, subtotal } — kiểm tra mã giảm giá, chưa trừ lượt dùng
exports.previewVoucher = async (req, res) => {
  try {
    const r = await bookingService.previewVoucher({
      eventId: req.body.eventId,
      code: req.body.code,
      buyerId: req.user.id,
      subtotal: req.body.subtotal,
    });
    res.json({ success: true, ...r });
  } catch (err) {
    fail(res, err);
  }
};

// POST /booking/orders/:orderId/cancel — khách huỷ đơn chưa thanh toán (nhả ghế + hoàn kho)
exports.cancelOrder = async (req, res) => {
  try {
    const order = await bookingService.cancelPendingOrder({ orderId: req.params.orderId, buyerId: req.user.id });
    res.json({ success: true, message: "Đã huỷ đơn hàng", status: order?.status });
  } catch (err) {
    fail(res, err);
  }
};

// GET /booking/user/tickets
exports.myTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ owner_id: req.user.id })
      .populate("event_id", "title banner_url venue_name")
      .populate("tier_id", "name price")
      .populate("session_id", "name start_time end_time status")
      .sort({ _id: -1 });

    // Tin bán lại của các vé đang bán / đã bán: để hiện trạng thái giữ chỗ & chi trả
    const listings = await ResaleListing.find({ ticket_id: { $in: tickets.map((t) => t._id) } });
    const listingByTicket = new Map(listings.map((l) => [String(l.ticket_id), l]));
    const now = Date.now();

    const statusLabel = {
      VALID: "Chưa sử dụng",
      USED: "Đã check-in",
      LISTED_RESALE: "Đang bán lại",
      RESOLD_INVALID: "Đã chuyển nhượng",
      REFUNDED: "Đã hoàn tiền",
    };

    res.json({
      tickets: tickets.map((t) => {
        const session = t.session_id;
        const endMs = session?.end_time ? new Date(session.end_time).getTime() : null;
        const startMs = session?.start_time ? new Date(session.start_time).getTime() : null;
        // Thời hạn vé: UPCOMING (chưa diễn) | ONGOING (đang diễn) | EXPIRED (suất đã kết thúc / bị huỷ)
        let validity = "UPCOMING";
        if (session?.status === "CANCELLED") validity = "CANCELLED";
        else if (endMs && now > endMs) validity = "EXPIRED";
        else if (startMs && now >= startMs) validity = "ONGOING";

        const l = listingByTicket.get(String(t._id));
        const reservedNow = l && l.status === "RESERVED" && l.reserved_until && new Date(l.reserved_until).getTime() > now;
        let resale = null;
        if (l && ["ACTIVE", "RESERVED", "SOLD"].includes(l.status) && ["LISTED_RESALE", "RESOLD_INVALID"].includes(t.status)) {
          resale = {
            listingId: l._id,
            status: reservedNow ? "RESERVED" : l.status === "RESERVED" ? "ACTIVE" : l.status,
            resalePrice: l.resale_price,
            reservedUntil: reservedNow ? l.reserved_until : undefined,
            payoutStatus: l.payout_status,
            cancelRequested: Boolean(l.cancel_requested),
          };
        }

        return {
          _id: t._id,
          orderId: t.order_id,
          ticketCode: t.ticket_code,
          qrHash: t.qr_hash_signature,
          eventId: t.event_id?._id || t.event_id,
          eventName: t.event_id?.title || "Sự kiện",
          ticketName: t.tier_id?.name || "Hạng vé",
          ticketPrice: t.tier_id?.price,
          quantity: 1,
          status: statusLabel[t.status] || t.status,
          rawStatus: t.status,
          purchaseDate: t._id.getTimestamp(),
          sessionName: session?.name,
          sessionStart: session?.start_time,
          sessionEnd: session?.end_time,
          validity,
          resale,
        };
      }),
    });
  } catch (err) {
    fail(res, err);
  }
};

// POST /booking/create-payment-intent (demo: thanh toán thành công ngay)
exports.createPaymentIntent = async (req, res) => {
  try {
    // Thanh toán GIẢ LẬP (đánh dấu đã trả không cần chuyển tiền): chỉ để test.
    // Production phải đặt ENABLE_DEMO_PAYMENT=false; thanh toán thật đi qua webhook SePay.
    if (process.env.ENABLE_DEMO_PAYMENT === "false") {
      return res.status(403).json({
        success: false,
        message: "Thanh toán demo đã tắt. Vui lòng chuyển khoản theo hướng dẫn (GET /v1/payment/orders/:orderId/instructions).",
      });
    }
    const { orderId, provider } = req.body;
    if (!orderId) return res.status(400).json({ success: false, message: "Thiếu mã đơn hàng" });
    if (!req.user) return res.status(401).json({ success: false, message: "Bạn cần đăng nhập" });

    const gateway = ["VNPAY", "VIETQR", "MOMO", "STRIPE"].includes(String(provider).toUpperCase())
      ? String(provider).toUpperCase()
      : "VNPAY";

    const { order, tickets } = await bookingService.confirmPaymentAndIssueTickets({
      orderId,
      buyerId: req.user.id,
      gateway,
    });

    res.json({
      success: true,
      alreadyPaid: true,
      clientSecret: "demo_client_secret",
      order: orderToClient(order),
      orderItems: orderItemsToClient(order),
      tickets,
    });
  } catch (err) {
    fail(res, err);
  }
};

// GET /booking/orders/auth/:orderId — trạng thái đơn + (khi đã thanh toán) biên nhận và danh sách vé để hiện trang thành công
exports.getOrder = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: "Bạn cần đăng nhập" });
    const order = await Order.findById(req.params.orderId);
    if (!order || order.buyer_id.toString() !== req.user.id) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }
    const status = order.status === "PAID" ? "CONFIRMED" : order.status;
    const body = { success: true, status, order: orderToClient(order) };

    if (order.status === "PAID") {
      const [tickets, event, session, payment] = await Promise.all([
        Ticket.find({ order_id: order._id }).sort({ _id: 1 }),
        Event.findById(order.event_id).select("title banner_url thumbnail_url venue_name city"),
        EventSession.findById(order.session_id).select("name start_time end_time"),
        Payment.findOne({ order_id: order._id }).select("gateway amount paid_at transaction_ref"),
      ]);
      const seatIds = tickets.map((t) => t.seat_id).filter(Boolean);
      const seats = seatIds.length ? await Seat.find({ _id: { $in: seatIds } }).select("section_name row_label seat_number") : [];
      const seatById = new Map(seats.map((x) => [String(x._id), x]));
      const tierName = new Map((order.items_snapshot || []).map((it) => [String(it.tier_id), it.tier_name]));
      body.tickets = tickets.map((t) => {
        const seat = t.seat_id && seatById.get(String(t.seat_id));
        return {
          _id: t._id,
          ticketCode: t.ticket_code,
          qrHash: t.qr_hash_signature,
          status: t.status,
          tierName: tierName.get(String(t.tier_id)) || "Vé",
          seat: seat ? { section: seat.section_name, row: seat.row_label, number: seat.seat_number } : null,
        };
      });
      body.event = event && {
        _id: event._id, title: event.title, bannerUrl: event.thumbnail_url || event.banner_url, venueName: event.venue_name, city: event.city,
      };
      body.session = session && { _id: session._id, name: session.name, startTime: session.start_time, endTime: session.end_time };
      body.payment = payment && { gateway: payment.gateway, amount: payment.amount, paidAt: payment.paid_at, transactionRef: payment.transaction_ref };
    } else {
      body.tickets = [];
      const [event, session] = await Promise.all([
        Event.findById(order.event_id).select("title banner_url thumbnail_url venue_name city custom_form_schema"),
        EventSession.findById(order.session_id).select("name start_time"),
      ]);
      body.event = event && { _id: event._id, title: event.title, bannerUrl: event.thumbnail_url || event.banner_url, venueName: event.venue_name, city: event.city };
      body.session = session && { _id: session._id, name: session.name, startTime: session.start_time };
      body.formSchema = Array.isArray(event?.custom_form_schema) ? event.custom_form_schema : [];
      body.attendeeFormAnswers = order.attendee_form_answers && !Array.isArray(order.attendee_form_answers) ? order.attendee_form_answers : {};
    }
    res.json(body);
  } catch (err) {
    fail(res, err);
  }
};

// POST /booking/check-in (STAFF/ADMIN quét vé QR trực tuyến)
exports.checkInTicket = async (req, res) => {
  try {
    const rawInput = req.body?.ticketCode || req.body?.qrData || "";
    if (!rawInput) return res.status(400).json({ success: false, message: "Thiếu mã vé QR" });

    let code = "";
    let providedHash = req.body?.qrHash || req.body?.signature || "";

    // Hỗ trợ payload QR dạng JSON {"ticketCode":"...","qrHash":"..."} hoặc chuỗi ghép "TK-XXX.hash" / "TK-XXX|hash"
    const trimmed = String(rawInput).trim();
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        code = String(parsed.ticketCode || parsed.code || "").replace(/^[#\s]+/, "").trim().toUpperCase();
        if (!providedHash) providedHash = String(parsed.qrHash || parsed.signature || "").trim();
      } catch {
        return res.status(400).json({ success: false, message: "Dữ liệu QR không hợp lệ" });
      }
    } else if (/[.|:]/.test(trimmed)) {
      const [cPart, hPart] = trimmed.split(/[.|:]/) ;
      code = String(cPart || "").replace(/^[#\s]+/, "").trim().toUpperCase();
      if (!providedHash && hPart) providedHash = String(hPart).trim();
    } else {
      code = trimmed.replace(/^[#\s]+/, "").trim().toUpperCase();
    }

    if (!code) return res.status(400).json({ success: false, message: "Thiếu mã vé QR" });

    const targetEventId = req.body?.eventId ? String(req.body.eventId).trim() : null;
    const targetSessionId = req.body?.sessionId ? String(req.body.sessionId).trim() : null;

    const ticket = await Ticket.findOne({ ticket_code: code })
      .populate("event_id", "title venue_name organizer_id")
      .populate("session_id", "name start_time end_time status")
      .populate("tier_id", "name")
      .populate("seat_id", "section_name row_label seat_number")
      .populate("owner_id", "full_name username email phone");
    if (!ticket) return res.status(404).json({ success: false, message: "Mã vé không hợp lệ" });

    // Xác thực chữ ký bảo mật HMAC-SHA256 của vé (chống vé giả / can thiệp DB hoặc QR giả mạo)
    const crypto = require("crypto");
    // So khớp với chữ ký đã lưu lúc phát hành vé, không tính lại bằng secret hiện tại
    // (đổi QR_SECRET/JWT_SECRET_KEY hoặc vé seed sẽ làm mọi vé bị báo không hợp lệ).
    const expectedSig = String(ticket.qr_hash_signature || "");
    const safeEq = (a, b) => {
      const ba = Buffer.from(String(a));
      const bb = Buffer.from(String(b));
      return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
    };
    if (!expectedSig) {
      return res.status(400).json({ success: false, message: "Vé thiếu chữ ký bảo mật" });
    }
    if (providedHash && !safeEq(String(providedHash).trim().toLowerCase(), expectedSig.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Chữ ký QR không khớp (mã QR giả mạo hoặc đã bị thu hồi)",
      });
    }

    // Phân quyền soát vé: Nhân viên (STAFF) được phân công sự kiện nào thì chỉ soát được vé của sự kiện đó
    const ticketEventId = String(ticket.event_id?._id || ticket.event_id);

    if (req.user.role === "STAFF") {
      if (targetEventId) {
        // Kiểm tra nhân viên có được phân công cho sự kiện đang chọn không
        const assigned = await StaffAssignment.findOne({
          staff_user_id: req.user.id,
          event_id: targetEventId,
          is_active: true,
        });
        if (!assigned) {
          return res.status(403).json({
            success: false,
            message: "Bạn không được phân công soát vé cho sự kiện này",
          });
        }
        // Kiểm tra vé quét có thuộc sự kiện đang chọn soát vé không
        if (ticketEventId !== targetEventId) {
          return res.status(400).json({
            success: false,
            message: `Vé không thuộc sự kiện đang chọn soát vé! Vé này thuộc sự kiện "${ticket.event_id?.title || 'khác'}".`,
          });
        }
      } else {
        // Nếu client không gửi targetEventId: kiểm tra nhân viên có được phân công cho sự kiện của vé không
        const assigned = await StaffAssignment.findOne({
          staff_user_id: req.user.id,
          event_id: ticketEventId,
          is_active: true,
        });
        if (!assigned) {
          return res.status(403).json({
            success: false,
            message: "Bạn không được phân công soát vé sự kiện này",
          });
        }
      }
    } else if (req.user.role === "ORGANIZER") {
      const isOwner = String(ticket.event_id?.organizer_id) === String(req.user.id);
      if (!isOwner) {
        const assigned = await StaffAssignment.findOne({
          staff_user_id: req.user.id,
          event_id: ticketEventId,
          is_active: true,
        });
        if (!assigned) {
          return res.status(403).json({
            success: false,
            message: "Bạn không có quyền soát vé sự kiện này",
          });
        }
      }
      if (targetEventId && ticketEventId !== targetEventId) {
        return res.status(400).json({
          success: false,
          message: `Vé không thuộc sự kiện đang chọn soát vé! Vé này thuộc sự kiện "${ticket.event_id?.title || 'khác'}".`,
        });
      }
    } else if (req.user.role === "ADMIN") {
      if (targetEventId && ticketEventId !== targetEventId) {
        return res.status(400).json({
          success: false,
          message: `Vé không thuộc sự kiện đang chọn soát vé! Vé này thuộc sự kiện "${ticket.event_id?.title || 'khác'}".`,
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền soát vé",
      });
    }

    // Kiểm tra suất diễn (Session): ngăn chặn đi nhầm suất hoặc suất đã kết thúc
    const ticketSessionId = String(ticket.session_id?._id || ticket.session_id || "");
    const session = ticket.session_id;

    if (session?.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: `Suất diễn "${session.name}" của vé này đã bị huỷ!`,
      });
    }

    if (targetSessionId && ticketSessionId !== targetSessionId) {
      const startTimeStr = session?.start_time ? new Date(session.start_time).toLocaleString("vi-VN") : "";
      return res.status(400).json({
        success: false,
        message: `Sai suất diễn! Vé này dành cho "${session?.name || 'suất khác'}"${startTimeStr ? ` (${startTimeStr})` : ''}, không phải suất đang chọn soát vé.`,
      });
    }

    const now = new Date();
    const EARLY_CHECKIN_HOURS = 4;
    const startMs = session?.start_time ? new Date(session.start_time).getTime() : null;
    const endMs = session?.end_time ? new Date(session.end_time).getTime() : null;

    if (endMs && now.getTime() > endMs) {
      return res.status(400).json({
        success: false,
        message: `Suất diễn "${session?.name || 'này'}" đã kết thúc vào lúc ${new Date(endMs).toLocaleString("vi-VN")}!`,
      });
    }

    if (startMs && now.getTime() < startMs - EARLY_CHECKIN_HOURS * 3600 * 1000) {
      return res.status(400).json({
        success: false,
        message: `Chưa đến giờ soát vé cho suất "${session?.name || 'này'}"! Suất diễn bắt đầu lúc ${new Date(startMs).toLocaleString("vi-VN")}.`,
      });
    }

    if (ticket.status === "USED") {
      return res.status(409).json({
        success: false,
        message: `Vé này ĐÃ ĐƯỢC SỬ DỤNG vào lúc ${new Date(ticket.checked_in_at).toLocaleString("vi-VN")}`,
      });
    }
    if (ticket.status !== "VALID") {
      return res.status(400).json({ success: false, message: `Vé không hợp lệ (${ticket.status})` });
    }

    // Atomic: chỉ 1 lần quét thành công
    const updated = await Ticket.findOneAndUpdate(
      { _id: ticket._id, status: "VALID" },
      { status: "USED", checked_in_at: new Date(), checked_in_by: req.user.id },
      { new: true },
    );
    if (!updated) return res.status(409).json({ success: false, message: "Vé vừa được sử dụng" });

    const seatLabel = ticket.seat_id
      ? `${ticket.seat_id.section_name} - Hàng ${ticket.seat_id.row_label} - Ghế ${ticket.seat_id.seat_number}`
      : "Vé đứng (GA)";
    const ownerName = ticket.owner_id?.full_name || ticket.owner_id?.username || "Khách hàng";

    res.json({
      success: true,
      message: "Check-in thành công!",
      ticket: {
        ticketCode: updated.ticket_code,
        eventName: ticket.event_id?.title,
        venueName: ticket.event_id?.venue_name,
        sessionName: session?.name,
        sessionStart: session?.start_time,
        sessionEnd: session?.end_time,
        zoneName: ticket.tier_id?.name,
        seat: seatLabel,
        ownerName,
        gate: req.body?.gate || "Cổng chính",
        scannedAt: updated.checked_in_at,
      },
    });
  } catch (err) {
    fail(res, err);
  }
};

// GET /booking/tickets/:id/status — Khách kiểm tra trạng thái vé thời gian thực (check-in tại cổng)
exports.getTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const filter = isObjectId
      ? { $or: [{ _id: id }, { ticket_code: id }], owner_id: req.user.id }
      : { ticket_code: id, owner_id: req.user.id };

    const ticket = await Ticket.findOne(filter)
      .populate("event_id", "title venue_name")
      .populate("session_id", "name start_time end_time")
      .populate("tier_id", "name")
      .populate("seat_id", "section_name row_label seat_number");
    if (!ticket) return res.status(404).json({ success: false, message: "Không tìm thấy vé" });

    const seatLabel = ticket.seat_id
      ? `${ticket.seat_id.section_name} - Hàng ${ticket.seat_id.row_label} - Ghế ${ticket.seat_id.seat_number}`
      : "Vé đứng (GA)";

    res.json({
      success: true,
      ticket: {
        id: ticket._id,
        ticketCode: ticket.ticket_code,
        status: ticket.status,
        checkedInAt: ticket.checked_in_at,
        eventName: ticket.event_id?.title,
        venueName: ticket.event_id?.venue_name,
        sessionName: ticket.session_id?.name,
        sessionStart: ticket.session_id?.start_time,
        zoneName: ticket.tier_id?.name,
        seat: seatLabel,
      },
    });
  } catch (err) {
    fail(res, err);
  }
};

// GET /booking/refund-requests — Lịch sử hoàn tiền của khách (chỉ phát sinh khi sự kiện bị huỷ)
exports.getMyRefundRequests = async (req, res) => {
  try {
    const requests = await RefundRequest.find({ user_id: req.user.id })
      .populate({
        path: "order_id",
        select: "order_code total_amount event_id",
        populate: { path: "event_id", select: "title banner_url" },
      })
      .populate("ticket_id", "ticket_code")
      .sort({ created_at: -1 });

    res.json({
      success: true,
      refundRequests: requests.map((r) => ({
        id: r._id,
        orderCode: r.order_id?.order_code,
        eventName: r.order_id?.event_id?.title,
        ticketCode: r.ticket_id?.ticket_code,
        refundAmount: r.refund_amount,
        reason: r.reason,
        status: r.status,
        createdAt: r.created_at,
        processedAt: r.processed_at,
      })),
    });
  } catch (err) {
    fail(res, err);
  }
};

// GET /booking/staff/my-events — sự kiện được phân công soát vé (ADMIN: mọi sự kiện đang mở bán; ORGANIZER: sự kiện của mình)
exports.myStaffEvents = async (req, res) => {
  try {
    let filter;
    if (req.user.role === "ADMIN") filter = { status: { $in: ["PUBLISHED", "ENDED"] } };
    else {
      const ids = (await StaffAssignment.find({ staff_user_id: req.user.id, is_active: true }).select("event_id")).map((a) => a.event_id);
      filter = req.user.role === "ORGANIZER" ? { $or: [{ _id: { $in: ids } }, { organizer_id: req.user.id }] } : { _id: { $in: ids } };
    }
    const events = await Event.find(filter).sort({ start_time: -1 }).limit(100).select("title venue_name city start_time status");
    const eventIds = events.map((e) => e._id);
    const [gates, sessions] = await Promise.all([
      StaffAssignment.find({ staff_user_id: req.user.id, is_active: true }).select("event_id assigned_gate"),
      EventSession.find({ event_id: { $in: eventIds }, status: { $ne: "CANCELLED" } }).sort({ start_time: 1 }).select("event_id name start_time end_time status"),
    ]);

    const gateByEvent = new Map(gates.map((g) => [String(g.event_id), g.assigned_gate]));
    const sessionsByEvent = new Map();
    for (const s of sessions) {
      const eid = String(s.event_id);
      if (!sessionsByEvent.has(eid)) sessionsByEvent.set(eid, []);
      sessionsByEvent.get(eid).push({
        id: s._id,
        name: s.name,
        startTime: s.start_time,
        endTime: s.end_time,
        status: s.status,
      });
    }

    res.json({
      success: true,
      events: events.map((e) => ({
        id: e._id,
        title: e.title,
        venueName: e.venue_name,
        city: e.city,
        startTime: e.start_time,
        status: e.status,
        assignedGate: gateByEvent.get(String(e._id)) || null,
        sessions: sessionsByEvent.get(String(e._id)) || [],
      })),
    });
  } catch (err) {
    fail(res, err);
  }
};

// GET /booking/staff/events/:eventId/check-in-stats (UC36)
exports.getStaffCheckInStats = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Phân quyền: ADMIN hoặc ORGANIZER của sự kiện hoặc STAFF có phân công
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: "Không tìm thấy sự kiện" });

    // Phân quyền: STAFF chỉ xem được sự kiện được phân công; ORGANIZER xem sự kiện của mình hoặc được phân công; ADMIN xem tất cả
    if (req.user.role === "STAFF") {
      const assigned = await StaffAssignment.findOne({
        staff_user_id: req.user.id,
        event_id: eventId,
        is_active: true,
      });
      if (!assigned) {
        return res.status(403).json({
          success: false,
          message: "Bạn chỉ có thể xem thống kê của sự kiện được phân công",
        });
      }
    } else if (req.user.role === "ORGANIZER") {
      const isOrganizer = String(event.organizer_id) === String(req.user.id);
      if (!isOrganizer) {
        const assigned = await StaffAssignment.findOne({
          staff_user_id: req.user.id,
          event_id: eventId,
          is_active: true,
        });
        if (!assigned) {
          return res.status(403).json({
            success: false,
            message: "Bạn không có quyền xem thống kê sự kiện này",
          });
        }
      }
    } else if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem thống kê sự kiện này",
      });
    }

    const [totalValidAndUsed, checkedInCount, tiers] = await Promise.all([
      Ticket.countDocuments({ event_id: eventId, status: { $in: ["VALID", "USED"] } }),
      Ticket.countDocuments({ event_id: eventId, status: "USED" }),
      TicketTier.find({ event_id: eventId }),
    ]);

    const remainingCount = Math.max(0, totalValidAndUsed - checkedInCount);
    const checkInRatePct = totalValidAndUsed > 0 ? Math.round((checkedInCount / totalValidAndUsed) * 1000) / 10 : 0;

    // Phân bố theo hạng vé
    const tierStats = await Promise.all(
      tiers.map(async (t) => {
        const [totalTier, usedTier] = await Promise.all([
          Ticket.countDocuments({ event_id: eventId, tier_id: t._id, status: { $in: ["VALID", "USED"] } }),
          Ticket.countDocuments({ event_id: eventId, tier_id: t._id, status: "USED" }),
        ]);
        return {
          tierId: t._id,
          tierName: t.name,
          totalTickets: totalTier,
          checkedIn: usedTier,
          remaining: totalTier - usedTier,
        };
      }),
    );

    // Danh sách 10 lượt soát vé gần nhất
    const recentCheckIns = await Ticket.find({ event_id: eventId, status: "USED" })
      .populate("tier_id", "name")
      .populate("checked_in_by", "full_name username")
      .sort({ checked_in_at: -1 })
      .limit(10);

    res.json({
      success: true,
      stats: {
        totalTickets: totalValidAndUsed,
        checkedInCount,
        remainingCount,
        checkInRatePct,
        tierStats,
        tierBreakdown: tierStats,
        recentCheckIns: recentCheckIns.map((t) => ({
          ticketCode: t.ticket_code,
          tierName: t.tier_id?.name,
          checkedInAt: t.checked_in_at,
          checkedInBy: t.checked_in_by?.full_name || t.checked_in_by?.username,
        })),
      },
    });
  } catch (err) {
    fail(res, err);
  }
};
