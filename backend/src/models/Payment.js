const mongoose = require("mongoose");
const { Schema } = mongoose;

const paymentSchema = new Schema(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    provider: {
      type: String,
      enum: ["VNPAY", "MOMO", "ZALOPAY", "STRIPE", "DEMO"],
      required: true,
    },
    transactionId: {
      type: String,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "PENDING",
    },
    rawResponse: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Payment", paymentSchema);
