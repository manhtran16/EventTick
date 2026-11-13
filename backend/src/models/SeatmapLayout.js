const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ref, options } = require("./_helpers");

/**
 * Sơ đồ tĩnh của 1 sự kiện (tự vẽ từ hạng vé, hoặc dựng từ file SVG + Excel do Organizer / Admin tải lên).
 * Ghế cụ thể của từng suất nằm ở bảng seats (section_name = section_id); hạng vé ở ticket_tiers.
 */
const RowSchema = new Schema(
  { label: String, from: Number, to: Number, aisles: [Number], blocked: [Number] },
  { _id: false },
);

const SectionSchema = new Schema(
  {
    section_id: { type: String, required: true }, // = id="SEC_..." trong SVG
    name: { type: String, required: true },
    type: { type: String, enum: ["SEATED", "GA"], required: true },
    tier_name: { type: String, required: true },
    layout: { type: String, enum: ["STRAIGHT", "ARC"], default: "STRAIGHT" }, // ARC: hàng ghế cong quanh sân khấu
    capacity: { type: Number, required: true, min: 0 },
    rows: { type: [RowSchema], default: [] },
  },
  { _id: false },
);

const schema = new Schema(
  {
    event_id: ref("Event", { required: true }),
    svg_content: { type: String, required: true },
    stage_ids: { type: [String], default: [] },
    sections: { type: [SectionSchema], default: [] },
    updated_by: ref("User"),
    updated_at: { type: Date, default: Date.now },
  },
  options,
);

module.exports = mongoose.model("SeatmapLayout", schema, "seatmap_layouts");
