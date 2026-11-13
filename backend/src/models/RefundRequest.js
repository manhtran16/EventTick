const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ref, options } = require("./_helpers");

const schema = new Schema(
  {
    order_id: ref("Order", { required: true }),
    ticket_id: ref("Ticket"),
    user_id: ref("User", { required: true }),
    // Chỉ hoàn tiền khi sự kiện bị huỷ (hoàn hàng loạt). Không hỗ trợ khách tự hoàn vé lẻ.
    refund_type: { type: String, enum: ["EVENT_BULK_REFUND"], default: "EVENT_BULK_REFUND", required: true },
    refund_amount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true },
    status: { type: String, enum: ["PROCESSING", "COMPLETED", "REJECTED"], default: "PROCESSING", required: true },
    transfer_reference: { type: String, trim: true, maxlength: 255 },
    processed_by: ref("User"),
    processing_note: { type: String, trim: true, maxlength: 1000 },
    processed_at: { type: Date },
  },
  options,
);

module.exports = mongoose.model("RefundRequest", schema, "refund_requests");
