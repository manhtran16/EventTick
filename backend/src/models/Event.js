const mongoose = require("mongoose");
const { Schema } = mongoose;

// Một loại vé trong 1 suất diễn, vd: "Vé Thường", "Vé VIP"
const ticketSchema = new Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0 }, // tổng số vé loại này
    sold: { type: Number, default: 0, min: 0 }, // số đã bán — KHÔNG sửa trực tiếp, chỉ tăng qua bookingController (atomic $inc)
    minOrder: { type: Number, default: 1 },
    desc: String,
  },
  { _id: true },
);

// Một suất diễn (buổi diễn) của sự kiện
const sessionSchema = new Schema(
  {
    eventDate: { type: Date, required: true },
    startTime: { type: Date, required: true },
    tickets: [ticketSchema],
  },
  { _id: true },
);

const eventSchema = new Schema(
  {
    eventName: { type: String, required: true, trim: true },
    eventDesc: String,
    organizerInfo: String,
    organizerName: String,
    venueName: String,
    eventAddress: String,
    eventType: { type: String, enum: ["online", "offline"], default: "offline" },
    category: { type: String, default: "Khác" },

    backgroundImage: String, // ảnh banner lớn
    eventImage: String, // ảnh thumbnail

    ownerId: { type: Schema.Types.ObjectId, ref: "User" }, // người tạo sự kiện

    isSpecial: { type: Boolean, default: false },
    isTrending: { type: Boolean, default: false },

    sessions: [sessionSchema],

    // 3 field dưới đây được TỰ ĐỘNG tính lại mỗi lần save (xem pre("save") bên dưới).
    // Cache lại để query/sort nhanh (vd: EventDetails cần sort theo earliestDate)
    // mà không phải tính toán lại từ mảng sessions mỗi lần.
    lowestPrice: { type: Number, default: 0 },
    earliestDate: Date,
    lastDate: Date,
  },
  { timestamps: true },
);

eventSchema.pre("save", function (next) {
  const allTickets = this.sessions.flatMap((s) => s.tickets);
  this.lowestPrice = allTickets.length ? Math.min(...allTickets.map((t) => t.price)) : 0;

  const dates = this.sessions.map((s) => s.eventDate).filter(Boolean);
  if (dates.length) {
    this.earliestDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    this.lastDate = new Date(Math.max(...dates.map((d) => d.getTime())));
  }
  next();
});

module.exports = mongoose.model("Event", eventSchema);
