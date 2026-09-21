const Event = require("../models/Event");
const Booking = require("../models/Booking");

/**
 * ĐIỂM QUAN TRỌNG NHẤT của toàn bộ backend: trừ kho vé một cách ATOMIC
 * để không bao giờ bán vượt quá số lượng có sẵn, kể cả khi nhiều người
 * đặt vé cùng lúc (race condition).
 *
 * Kỹ thuật: dùng $inc + arrayFilters với điều kiện $expr ngay trong CÙNG
 * MỘT lệnh update. MongoDB đảm bảo lệnh update trên 1 document là atomic,
 * nên nếu 2 request cùng chạy đồng thời, chỉ 1 request "thắng" khi kiểm
 * tra (sold + quantity <= stock), request còn lại sẽ có modifiedCount = 0.
 *
 * KHÔNG BAO GIỜ làm theo kiểu "đọc rồi ghi" (find -> check -> save) vì có
 * khoảng hở giữa 2 bước đó khiến 2 request có thể cùng lọt qua điều kiện.
 */
async function decrementStock(eventId, sessionId, ticketId, quantity) {
  const result = await Event.updateOne(
    { _id: eventId },
    {
      $inc: {
        "sessions.$[s].tickets.$[t].sold": quantity,
        "sessions.$[s].tickets.$[t].remaining": -quantity,
      },
    },
    {
      arrayFilters: [
        { "s._id": sessionId },
        { "t._id": ticketId, "t.remaining": { $gte: quantity } },
      ],
    },
  );
  return result.modifiedCount > 0;
}

async function restoreStock(eventId, sessionId, ticketId, quantity) {
  await Event.updateOne(
    { _id: eventId },
    {
      $inc: {
        "sessions.$[s].tickets.$[t].sold": -quantity,
        "sessions.$[s].tickets.$[t].remaining": quantity,
      },
    },
    { arrayFilters: [{ "s._id": sessionId }, { "t._id": ticketId }] },
  );
}

// POST /booking or POST /booking/carts/:eventId
exports.createBooking = async (req, res) => {
  try {
    const eventId = req.params.eventId || req.body.eventId;
    const rawItems = req.body.items || req.body.cartItems;
    const sessionId = req.body.sessionId || (Array.isArray(rawItems) && rawItems[0]?.sessionId);

    if (!eventId || !sessionId || !Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin đặt vé" });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: "Không tìm thấy sự kiện" });

    const session = event.sessions.id(sessionId);
    if (!session) return res.status(404).json({ success: false, message: "Không tìm thấy suất diễn" });

    const succeeded = []; // để rollback nếu 1 loại vé giữa chừng bị hết
    const bookingItems = [];
    let totalAmount = 0;

    for (const item of rawItems) {
      const ticket = session.tickets.id(item.ticketId);
      if (!ticket) {
        for (const s of succeeded) await restoreStock(eventId, sessionId, s.ticketId, s.quantity);
        return res.status(404).json({ success: false, message: "Không tìm thấy loại vé" });
      }

      const ok = await decrementStock(eventId, sessionId, ticket._id, item.quantity);
      if (!ok) {
        for (const s of succeeded) await restoreStock(eventId, sessionId, s.ticketId, s.quantity);
        return res
          .status(409)
          .json({ success: false, message: `Vé "${ticket.name}" không đủ số lượng` });
      }

      succeeded.push({ ticketId: ticket._id, quantity: item.quantity });
      bookingItems.push({
        sessionId: session._id,
        ticketId: ticket._id,
        ticketName: ticket.name,
        ticketPrice: ticket.price,
        quantity: item.quantity,
      });
      totalAmount += ticket.price * item.quantity;
    }

    const booking = await Booking.create({
      userId: req.user.id,
      eventId: event._id,
      eventName: event.eventName,
      items: bookingItems,
      totalAmount,
      status: "paid",
    });

    res.json({
      success: true,
      bookingId: booking._id,
      orderId: booking._id,
      totalAmount,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /booking/user/tickets  (MyTicketPage.jsx — yêu cầu đăng nhập)
exports.myTickets = async (req, res) => {
  const bookings = await Booking.find({ userId: req.user.id }).sort({ createdAt: -1 });
  const tickets = bookings.flatMap((b) =>
    b.items.map((it) => ({
      eventId: b.eventId,
      eventName: b.eventName,
      ticketName: it.ticketName,
      ticketPrice: it.ticketPrice,
      quantity: it.quantity,
      status: b.status,
      purchaseDate: b.purchaseDate,
    })),
  );
  res.json({ tickets });
};

// POST /booking/create-payment-intent (PaymentPage.jsx)
exports.createPaymentIntent = async (req, res) => {
  try {
    const { orderId } = req.body;
    const booking = await Booking.findById(orderId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }
    res.json({
      success: true,
      alreadyPaid: true,
      clientSecret: "demo_client_secret",
      order: booking,
      orderItems: booking.items,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /booking/orders/auth/:orderId (PaymentResult.jsx)
exports.getOrder = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.orderId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }
    res.json({
      success: true,
      status: "CONFIRMED",
      order: booking,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
