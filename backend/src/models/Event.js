const mongoose = require("mongoose");
const { Schema } = mongoose;

function slugify(text) {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Subdocument Session (suất diễn)
const sessionSchema = new Schema(
  {
    name: { type: String, trim: true },
    eventDate: { type: Date, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
  },
  { _id: true },
);

const eventSchema = new Schema(
  {
    organizerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      index: true,
    },
    category: { type: String, default: "Khác" },

    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String }, // HTML description

    location: { type: String, required: true, trim: true },
    bannerUrl: { type: String, required: true },
    thumbnailUrl: { type: String },

    organizerName: { type: String, trim: true },
    organizerInfo: { type: String },
    eventType: { type: String, enum: ["offline", "online"], default: "offline" },

    sessions: {
      type: [sessionSchema],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: "Sự kiện phải có ít nhất 1 suất diễn (session)",
      },
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "APPROVED",
        "REJECTED",
        "CANCELLED",
        "COMPLETED",
        "pending",
        "approved",
        "rejected",
      ],
      default: "PENDING",
      index: true,
    },
    rejectionReason: { type: String },

    isSpecial: { type: Boolean, default: false },
    isTrending: { type: Boolean, default: false },

    lowestPrice: { type: Number, default: 0 },
    earliestDate: { type: Date },
    lastDate: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
eventSchema.index({ status: 1, createdAt: -1 });

// Virtual aliases for frontend backward compatibility
eventSchema.virtual("eventName").get(function () {
  return this.title;
});
eventSchema.virtual("eventDesc").get(function () {
  return this.description;
});
eventSchema.virtual("venueName").get(function () {
  return this.location;
});
eventSchema.virtual("eventAddress").get(function () {
  return this.location;
});
eventSchema.virtual("backgroundImage").get(function () {
  return this.bannerUrl;
});
eventSchema.virtual("eventImage").get(function () {
  return this.thumbnailUrl || this.bannerUrl;
});
eventSchema.virtual("ownerId").get(function () {
  return this.organizerId;
});

// Pre-validation / Pre-save hooks
eventSchema.pre("validate", function (next) {
  // Support legacy field names during assignment
  if (!this.title && this.get("eventName")) {
    this.title = this.get("eventName");
  }
  if (!this.location && (this.get("venueName") || this.get("eventAddress"))) {
    this.location = this.get("venueName") || this.get("eventAddress");
  }
  if (!this.bannerUrl && this.get("backgroundImage")) {
    this.bannerUrl = this.get("backgroundImage");
  }
  if (!this.thumbnailUrl && this.get("eventImage")) {
    this.thumbnailUrl = this.get("eventImage");
  }
  if (!this.organizerId && this.get("ownerId")) {
    this.organizerId = this.get("ownerId");
  }
  if (!this.description && this.get("eventDesc")) {
    this.description = this.get("eventDesc");
  }

  // Auto-generate slug if missing
  if (!this.slug && this.title) {
    const baseSlug = slugify(this.title);
    const suffix = (this._id || Date.now()).toString().slice(-6);
    this.slug = `${baseSlug}-${suffix}`;
  }

  // Normalize status
  if (this.status) {
    this.status = this.status.toUpperCase();
  }

  // Compute earliestDate & lastDate
  if (this.sessions && this.sessions.length > 0) {
    const dates = this.sessions.map((s) => new Date(s.eventDate).getTime()).filter(Boolean);
    if (dates.length) {
      this.earliestDate = new Date(Math.min(...dates));
      this.lastDate = new Date(Math.max(...dates));
    }
  }

  next();
});

module.exports = mongoose.model("Event", eventSchema);
