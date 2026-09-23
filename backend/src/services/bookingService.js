const crypto = require("crypto");
const { Booking, Event, Zone, Voucher, Ticket, Payment } = require("../models");

/**
 * 1. GIỮ CHỖ TẠM THỜI (10 PHÚT) & TRỪ KHO VÉ ATOMIC
 * Chống overselling: trừ Zone.availableCapacity bằng findOneAndUpdate {$gte}.
 * Chống gian lận voucher: trần giảm giá maxDiscountAmount & giới hạn lượt dùng theo user.
 */
async function createBookingHold({
  customerId,
  eventId,
  sessionId,
  items,
  voucherCode,
}) {
  // 1. Kiểm tra sự kiện & suất diễn
  const event = await Event.findById(eventId);
  if (!event) {
    const error = new Error("Không tìm thấy sự kiện");
    error.statusCode = 404;
    throw error;
  }

  const session = (event.sessions || []).id(sessionId);
  if (!session) {
    const error = new Error("Không tìm thấy suất diễn này của sự kiện");
    error.statusCode = 404;
    throw error;
  }

  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error("Đơn hàng phải có ít nhất 1 vé");
    error.statusCode = 400;
    throw error;
  }

  // 2. Trừ kho atomic từng hạng vé (Zone)
  const reservedZones = []; // lưu lại để rollback nếu loại vé tiếp theo không đủ
  const bookingItems = [];
  let totalAmount = 0;

  try {
    for (const item of items) {
      const zoneId = item.zoneId || item.ticketId;
      const quantity = Number(item.quantity);

      if (!zoneId || isNaN(quantity) || quantity <= 0) {
        throw new Error("Thông tin loại vé hoặc số lượng không hợp lệ");
      }

      // Atomic decrement: chỉ thành công nếu availableCapacity >= quantity
      const updatedZone = await Zone.findOneAndUpdate(
        {
          _id: zoneId,
          sessionId: session._id,
          availableCapacity: { $gte: quantity },
        },
        { $inc: { availableCapacity: -quantity } },
        { new: true },
      );

      if (!updatedZone) {
        // Lấy thông tin zone để báo tên vé rõ ràng
        const existingZone = await Zone.findById(zoneId);
        const zoneName = existingZone ? existingZone.name : "Hạng vé";
        const error = new Error(`Hạng vé "${zoneName}" không đủ số lượng còn lại`);
        error.statusCode = 409;
        throw error;
      }

      reservedZones.push({ zoneId: updatedZone._id, quantity });

      const unitPrice = updatedZone.price;
      const subtotal = unitPrice * quantity;
      totalAmount += subtotal;

      bookingItems.push({
        zoneId: updatedZone._id,
        zoneName: updatedZone.name,
        quantity,
        unitPrice,
        subtotal,
      });
    }
  } catch (err) {
    // Rollback các zone đã trừ thành công trước đó
    for (const resZone of reservedZones) {
      await Zone.findByIdAndUpdate(resZone.zoneId, {
        $inc: { availableCapacity: resZone.quantity },
      });
    }
    throw err;
  }

  // 3. Xử lý Voucher (nếu có)
  let voucherDoc = null;
  let discountAmount = 0;

  if (voucherCode && voucherCode.trim()) {
    const cleanCode = voucherCode.trim().toUpperCase();
    const voucher = await Voucher.findOne({ code: cleanCode });

    if (!voucher || !voucher.isActive) {
      const err = new Error("Mã giảm giá không tồn tại hoặc đã bị vô hiệu hóa");
      err.statusCode = 400;
      await rollbackReservedZones(reservedZones);
      throw err;
    }

    if (new Date(voucher.expiresAt) < new Date()) {
      const err = new Error("Mã giảm giá đã hết hạn sử dụng");
      err.statusCode = 400;
      await rollbackReservedZones(reservedZones);
      throw err;
    }

    if (voucher.eventId && voucher.eventId.toString() !== eventId.toString()) {
      const err = new Error("Mã giảm giá không áp dụng cho sự kiện này");
      err.statusCode = 400;
      await rollbackReservedZones(reservedZones);
      throw err;
    }

    if (voucher.usedCount >= voucher.maxUsage) {
      const err = new Error("Mã giảm giá đã đạt giới hạn sử dụng toàn sàn");
      err.statusCode = 400;
      await rollbackReservedZones(reservedZones);
      throw err;
    }

    if (totalAmount < (voucher.minOrderValue || 0)) {
      const err = new Error(
        `Đơn hàng chưa đạt giá trị tối thiểu ${voucher.minOrderValue.toLocaleString()} ₫ để dùng mã này`,
      );
      err.statusCode = 400;
      await rollbackReservedZones(reservedZones);
      throw err;
    }

    // Chống lạm dụng: Giới hạn số lần dùng mỗi User
    const userUsageCount = (voucher.usedUsers || []).filter(
      (u) => u.userId?.toString() === customerId.toString(),
    ).length;

    if (userUsageCount >= (voucher.maxUsagePerUser || 1)) {
      const err = new Error(
        `Bạn đã hết số lần sử dụng mã giảm giá này (Tối đa ${voucher.maxUsagePerUser || 1} lần)`,
      );
      err.statusCode = 400;
      await rollbackReservedZones(reservedZones);
      throw err;
    }

    // Tính toán số tiền giảm
    if (voucher.discountType === "PERCENT") {
      discountAmount = Math.round((totalAmount * voucher.discountValue) / 100);
      if (voucher.maxDiscountAmount && voucher.maxDiscountAmount > 0) {
        discountAmount = Math.min(discountAmount, voucher.maxDiscountAmount);
      }
    } else {
      discountAmount = Math.min(voucher.discountValue, totalAmount);
    }

    // Cập nhật atomic số lượt dùng voucher
    await Voucher.findByIdAndUpdate(voucher._id, {
      $inc: { usedCount: 1 },
      $push: { usedUsers: { userId: customerId, usedAt: new Date() } },
    });

    voucherDoc = voucher;
  }

  const finalAmount = Math.max(0, totalAmount - discountAmount);

  // 4. Tạo Booking với thời hạn giữ chỗ 10 phút
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const booking = await Booking.create({
    customerId,
    eventId: event._id,
    eventName: event.title || event.eventName,
    sessionId: session._id,
    items: bookingItems,
    voucherId: voucherDoc ? voucherDoc._id : undefined,
    totalAmount,
    discountAmount,
    finalAmount,
    paymentStatus: "PENDING",
    expiresAt,
  });

  return booking;
}

async function rollbackReservedZones(reservedZones) {
  for (const resZone of reservedZones) {
    await Zone.findByIdAndUpdate(resZone.zoneId, {
      $inc: { availableCapacity: resZone.quantity },
    });
  }
}

/**
 * 2. TỰ ĐỘNG GIẢI PHÓNG KHO VÉ CỦA ĐƠN HÀNG HẾT HẠN GIỮ CHỖ (10 PHÚT)
 * KHÔNG dùng TTL index để xóa Booking, mà chuyển paymentStatus = "EXPIRED"
 * và hoàn trả availableCapacity vào Zone để đối soát kế toán.
 */
async function releaseExpiredBookings() {
  const now = new Date();
  const expiredBookings = await Booking.find({
    paymentStatus: "PENDING",
    expiresAt: { $lt: now },
  });

  for (const booking of expiredBookings) {
    booking.paymentStatus = "EXPIRED";
    await booking.save();

    // Hoàn trả số lượng vé vào Zone
    for (const item of booking.items || []) {
      await Zone.findByIdAndUpdate(item.zoneId, {
        $inc: { availableCapacity: item.quantity },
      });
    }

    // Hoàn trả lượt voucher nếu có
    if (booking.voucherId) {
      await Voucher.findByIdAndUpdate(booking.voucherId, {
        $inc: { usedCount: -1 },
        $pull: { usedUsers: { userId: booking.customerId } },
      });
    }

    console.log(`[BookingService] Đã hoàn trả kho vé cho đơn quá hạn: ${booking._id}`);
  }

  return expiredBookings.length;
}

/**
 * 3. XÁC NHẬN THANH TOÁN THÀNH CÔNG & PHÁT HÀNH VÉ QR ĐỘC LẬP
 * Tạo bản ghi Payment và tạo Ticket riêng cho từng vé được mua.
 */
async function confirmPaymentAndIssueTickets({
  bookingId,
  provider = "DEMO",
  transactionId,
  rawResponse,
}) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const error = new Error("Không tìm thấy đơn đặt vé");
    error.statusCode = 404;
    throw error;
  }

  // Nếu đã thành công từ trước, trả về vé đã phát hành
  if (booking.paymentStatus === "SUCCESS" || booking.paymentStatus === "paid") {
    const existingTickets = await Ticket.find({ bookingId: booking._id });
    return { booking, tickets: existingTickets };
  }

  // Nếu đã hết hạn giữ chỗ
  if (booking.paymentStatus === "EXPIRED" || new Date(booking.expiresAt) < new Date()) {
    booking.paymentStatus = "EXPIRED";
    await booking.save();
    const error = new Error(
      "Đơn hàng đã hết hạn giữ chỗ (10 phút). Kho vé đã được hoàn trả, vui lòng đặt lại.",
    );
    error.statusCode = 410;
    throw error;
  }

  // Cập nhật trạng thái Booking
  booking.paymentStatus = "SUCCESS";
  await booking.save();

  // 1. Lưu Payment history
  const payment = await Payment.create({
    bookingId: booking._id,
    amount: booking.finalAmount,
    provider,
    transactionId: transactionId || `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    status: "SUCCESS",
    rawResponse,
  });

  // 2. Phát hành từng vé QR điện tử độc lập
  const ticketsToCreate = [];
  for (const item of booking.items || []) {
    for (let i = 0; i < item.quantity; i++) {
      const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
      const ticketCode = `TK-${Date.now().toString(36).toUpperCase()}-${randomHex}`;

      ticketsToCreate.push({
        bookingId: booking._id,
        eventId: booking.eventId,
        sessionId: booking.sessionId,
        zoneId: item.zoneId,
        ownerId: booking.customerId,
        ticketCode,
        unitPrice: item.unitPrice,
        status: "UNUSED",
      });
    }
  }

  const createdTickets = await Ticket.insertMany(ticketsToCreate);

  return {
    booking,
    payment,
    tickets: createdTickets,
  };
}

module.exports = {
  createBookingHold,
  releaseExpiredBookings,
  confirmPaymentAndIssueTickets,
};
