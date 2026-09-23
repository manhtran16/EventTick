const { Booking, Ticket, Event } = require("../models");
const bookingService = require("../services/bookingService");

// POST /booking or POST /booking/carts/:eventId
exports.createBooking = async (req, res) => {
  try {
    const eventId = req.params.eventId || req.body.eventId;
    const rawItems = req.body.cartItems || req.body.items;
    const sessionId =
      req.body.sessionId || (Array.isArray(rawItems) && rawItems[0]?.sessionId);
    const voucherCode = req.body.voucherCode || req.body.voucher;

    if (!eventId || !sessionId || !Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin đặt vé" });
    }

    // Tự động quét và giải phóng các đơn đặt vé đã quá hạn 10 phút trước đó
    bookingService.releaseExpiredBookings().catch((e) => console.error("Lỗi giải phóng vé:", e));

    const booking = await bookingService.createBookingHold({
      customerId: req.user.id,
      eventId,
      sessionId,
      items: rawItems,
      voucherCode,
    });

    res.json({
      success: true,
      bookingId: booking._id,
      orderId: booking._id,
      totalAmount: booking.finalAmount,
      finalAmount: booking.finalAmount,
      discountAmount: booking.discountAmount,
      expiresAt: booking.expiresAt,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

// GET /booking/user/tickets (MyTicketPage.jsx — yêu cầu đăng nhập)
exports.myTickets = async (req, res) => {
  try {
    // 1. Tìm các vé điện tử độc lập đã phát hành
    const issuedTickets = await Ticket.find({ ownerId: req.user.id })
      .populate("eventId", "title bannerUrl location")
      .populate("zoneId", "name price")
      .sort({ createdAt: -1 });

    if (issuedTickets.length > 0) {
      const tickets = issuedTickets.map((t) => ({
        _id: t._id,
        ticketCode: t.ticketCode,
        eventId: t.eventId?._id || t.eventId,
        eventName: t.eventId?.title || "Sự kiện",
        ticketName: t.zoneId?.name || "Hạng vé",
        ticketPrice: t.unitPrice,
        quantity: 1,
        status: t.status === "UNUSED" ? "Chưa sử dụng" : t.status === "USED" ? "Đã check-in" : "Đã huỷ",
        rawStatus: t.status,
        purchaseDate: t.createdAt,
      }));
      return res.json({ tickets });
    }

    // 2. Fallback tìm từ Booking nếu chưa phát hành Ticket (đảm bảo không rỗng dữ liệu cũ)
    const bookings = await Booking.find({ customerId: req.user.id }).sort({ createdAt: -1 });
    const tickets = bookings.flatMap((b) =>
      (b.items || []).map((it) => ({
        eventId: b.eventId,
        eventName: b.eventName || "Sự kiện",
        ticketName: it.zoneName || "Vé",
        ticketPrice: it.unitPrice,
        quantity: it.quantity,
        status: b.paymentStatus === "SUCCESS" ? "Chưa sử dụng" : b.paymentStatus,
        rawStatus: b.paymentStatus,
        purchaseDate: b.createdAt,
      })),
    );
    res.json({ tickets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /booking/create-payment-intent (PaymentPage.jsx)
exports.createPaymentIntent = async (req, res) => {
  try {
    const { orderId, provider = "DEMO" } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, message: "Thiếu mã đơn hàng" });
    }

    const { booking, tickets } = await bookingService.confirmPaymentAndIssueTickets({
      bookingId: orderId,
      provider,
    });

    res.json({
      success: true,
      alreadyPaid: true,
      clientSecret: "demo_client_secret",
      order: booking,
      orderItems: booking.items,
      tickets,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

// GET /booking/orders/auth/:orderId (PaymentResult.jsx)
exports.getOrder = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.orderId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    const tickets = await Ticket.find({ bookingId: booking._id });

    res.json({
      success: true,
      status: "CONFIRMED",
      order: booking,
      tickets,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /booking/check-in (Staff check-in quét vé tại cổng)
exports.checkInTicket = async (req, res) => {
  try {
    const { ticketCode } = req.body;
    if (!ticketCode) {
      return res.status(400).json({ success: false, message: "Thiếu mã vé QR" });
    }

    const ticket = await Ticket.findOne({ ticketCode: ticketCode.trim().toUpperCase() })
      .populate("eventId", "title location")
      .populate("zoneId", "name");

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Mã vé không hợp lệ" });
    }

    if (ticket.status === "USED") {
      return res.status(409).json({
        success: false,
        message: `Vé này ĐÃ ĐƯỢC SỬ DỤNG vào lúc ${new Date(ticket.scannedAt).toLocaleString("vi-VN")}`,
      });
    }

    if (ticket.status === "CANCELLED") {
      return res.status(400).json({ success: false, message: "Vé này đã bị hủy" });
    }

    ticket.status = "USED";
    ticket.scannedBy = req.user?.id;
    ticket.scannedAt = new Date();
    await ticket.save();

    res.json({
      success: true,
      message: "Check-in thành công!",
      ticket: {
        ticketCode: ticket.ticketCode,
        eventName: ticket.eventId?.title,
        zoneName: ticket.zoneId?.name,
        scannedAt: ticket.scannedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
