const mongoose = require("mongoose");
const { Schema } = mongoose;

const zoneSchema = new Schema(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    totalCapacity: {
      type: Number,
      required: true,
      min: 1,
    },
    availableCapacity: {
      type: Number,
      required: true,
      min: 0,
    },
    saleStartTime: { type: Date },
    saleEndTime: { type: Date },
    maxPerOrder: {
      type: Number,
      default: 10,
      min: 1,
    },
    description: { type: String, trim: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Compound indexes
zoneSchema.index({ eventId: 1, sessionId: 1 });
zoneSchema.index({ availableCapacity: 1 });

// Virtual alias for frontend compatibility with ticket objects
zoneSchema.virtual("stock").get(function () {
  return this.totalCapacity;
});
zoneSchema.virtual("remaining").get(function () {
  return this.availableCapacity;
});
zoneSchema.virtual("sold").get(function () {
  return Math.max(0, this.totalCapacity - this.availableCapacity);
});
zoneSchema.virtual("soldOut").get(function () {
  return this.availableCapacity <= 0 ? "true" : "false";
});
zoneSchema.virtual("numberOfTicketLeft").get(function () {
  return this.availableCapacity;
});
zoneSchema.virtual("desc").get(function () {
  return this.description;
});

module.exports = mongoose.model("Zone", zoneSchema);
