const mongoose = require("mongoose");
const { Schema } = mongoose;

const bookingItemSchema = new Schema(
  {
    zoneId: {
      type: Schema.Types.ObjectId,
      ref: "Zone",
      required: true,
    },
    zoneName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  {
    _id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual aliases for backward compatibility with older ticket fields
bookingItemSchema.virtual("ticketId").get(function () {
  return this.zoneId;
});
bookingItemSchema.virtual("ticketName").get(function () {
  return this.zoneName;
});
bookingItemSchema.virtual("ticketPrice").get(function () {
  return this.unitPrice;
});

const bookingSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    eventName: { type: String }, // Snapshot of event name at booking time
    sessionId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    items: {
      type: [bookingItemSchema],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: "Đơn đặt vé phải có ít nhất 1 loại vé",
      },
    },
    voucherId: {
      type: Schema.Types.ObjectId,
      ref: "Voucher",
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: [
        "PENDING",
        "SUCCESS",
        "FAILED",
        "EXPIRED",
        "REFUNDED",
        "paid",
        "cancelled",
        "pending",
      ],
      default: "PENDING",
    },
    expiresAt: {
      type: Date,
      required: true,
      default: function () {
        // Default 10 minutes hold
        return new Date(Date.now() + 10 * 60 * 1000);
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Compound indexes
bookingSchema.index({ customerId: 1, createdAt: -1 });
bookingSchema.index({ paymentStatus: 1, expiresAt: 1 });

// Backward compatibility virtuals
bookingSchema.virtual("userId").get(function () {
  return this.customerId;
});
bookingSchema.virtual("status").get(function () {
  if (this.paymentStatus === "SUCCESS" || this.paymentStatus === "paid") return "paid";
  if (this.paymentStatus === "CANCELLED" || this.paymentStatus === "cancelled" || this.paymentStatus === "EXPIRED")
    return "cancelled";
  return "pending";
});
bookingSchema.virtual("purchaseDate").get(function () {
  return this.createdAt;
});

// Pre-validate hook to support legacy userId
bookingSchema.pre("validate", function (next) {
  if (!this.customerId && this.get("userId")) {
    this.customerId = this.get("userId");
  }
  if (this.finalAmount === undefined || this.finalAmount === null) {
    this.finalAmount = Math.max(0, (this.totalAmount || 0) - (this.discountAmount || 0));
  }
  next();
});

module.exports = mongoose.model("Booking", bookingSchema);
