const mongoose = require("mongoose");
const { Schema } = mongoose;

const bookingItemSchema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, required: true },
    ticketId: { type: Schema.Types.ObjectId, required: true },
    ticketName: String,
    ticketPrice: Number,
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const bookingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    eventName: String, // lưu lại tên sự kiện tại thời điểm đặt, phòng khi event bị sửa/xoá sau này
    items: [bookingItemSchema],
    totalAmount: Number,
    // demo: coi như thanh toán thành công ngay lúc tạo booking.
    // Khi nối Stripe/VNPay/MoMo thật, đổi default thành "pending" và
    // chỉ set "paid" sau khi nhận webhook xác nhận thanh toán.
    status: { type: String, enum: ["pending", "paid", "cancelled"], default: "paid" },
    purchaseDate: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Booking", bookingSchema);
