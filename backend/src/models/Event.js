const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ref, options } = require("./_helpers");

function slugify(text) {
  return (text || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const schema = new Schema(
  {
    organizer_id: ref("User", { required: true }),
    category_id: ref("Category", { required: true }),
    title: { type: String, required: true, trim: true, maxlength: 255 },
    description: { type: String, default: "" },
    banner_url: { type: String, required: true },
    venue_name: { type: String, required: true, trim: true, maxlength: 255 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    start_time: { type: Date, required: true },
    end_time: { type: Date, required: true },
    has_seat_map: { type: Boolean, default: false }, // false = Vé đứng (GA), true = có sơ đồ ghế
    allow_resale: { type: Boolean, default: false },
    max_resale_markup_pct: { type: Number, default: 0, min: 0 },
    custom_form_schema: { type: Schema.Types.Mixed },
    legal_doc_url: { type: String },
    status: {
      type: String,
      enum: ["DRAFT", "PENDING", "APPROVED", "PUBLISHED", "CANCELLED", "ENDED"],
      default: "DRAFT",
      required: true,
    },
    is_featured_banner: { type: Boolean, default: false },

    // --- Trường mở rộng (ngoài đặc tả) ---
    slug: { type: String, lowercase: true, trim: true },
    thumbnail_url: { type: String },
    organizer_name: { type: String },
    organizer_info: { type: String },
    event_type: { type: String, enum: ["offline", "online"], default: "offline" },
    lowest_price: { type: Number, default: 0 },
    rejection_reason: { type: String },
    // Lịch sử đổi trạng thái (hiện ở tab "Lịch sử" của Organizer)
    status_history: {
      type: [{ _id: false, status: String, at: { type: Date, default: Date.now }, by: { type: Schema.Types.ObjectId, ref: "User" }, note: String }],
      default: [],
    },
    created_at: { type: Date, default: Date.now },
  },
  options,
);

schema.pre("validate", function (next) {
  if (!this.slug && this.title) {
    this.slug = `${slugify(this.title)}-${this._id.toString().slice(-6)}`;
  }
  if (this.start_time && this.end_time && this.end_time <= this.start_time) {
    return next(new Error("end_time phải sau start_time"));
  }
  next();
});

module.exports = mongoose.model("Event", schema, "events");
