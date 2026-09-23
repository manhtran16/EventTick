const mongoose = require("mongoose");
const { Schema } = mongoose;

const ticketSchema = new Schema(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    zoneId: {
      type: Schema.Types.ObjectId,
      ref: "Zone",
      required: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    ticketCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    attendeeName: { type: String, trim: true },
    attendeeEmail: { type: String, trim: true, lowercase: true },
    seatNumber: { type: String, trim: true },
    status: {
      type: String,
      enum: ["UNUSED", "USED", "CANCELLED"],
      default: "UNUSED",
    },
    scannedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    scannedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for fast check-in scanning & customer history
ticketSchema.index({ eventId: 1, status: 1 });

module.exports = mongoose.model("Ticket", ticketSchema);
