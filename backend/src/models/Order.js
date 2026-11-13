const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ref, options } = require("./_helpers");

// Snapshot hạng vé khách đặt: dùng cho cả Vé đứng (seat_ids rỗng) lẫn Vé ngồi
const itemSchema = new Schema(
  {
    tier_id: ref("TicketTier", { required: true }),
    tier_name: { type: String },
    unit_price: { type: Number, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    seat_ids: { type: [Schema.Types.ObjectId], default: [] },
  },
  { _id: false },
);

const schema = new Schema(
  {
    buyer_id: ref("User", { required: true }),
    event_id: ref("Event", { required: true }),
    session_id: ref("EventSession", { required: true }),
    voucher_id: ref("Voucher"),
    order_code: { type: String, required: true, maxlength: 50 },
    order_type: { type: String, enum: ["PRIMARY", "RESALE"], default: "PRIMARY", required: true },
    // Đơn RESALE: các tin bán lại được mua trong đơn (mỗi tin = 1 vé)
    resale_listing_ids: { type: [Schema.Types.ObjectId], default: undefined },
    items_snapshot: {
      type: [itemSchema],
      validate: { validator: (v) => Array.isArray(v) && v.length > 0, message: "Đơn hàng phải có ít nhất 1 hạng vé" },
    },
    subtotal_amount: { type: Number, required: true, min: 0 },
    discount_amount: { type: Number, default: 0, min: 0 },
    total_amount: { type: Number, required: true, min: 0 },
    attendee_form_answers: { type: Schema.Types.Mixed },
    vat_invoice_info: { type: Schema.Types.Mixed },
    refund_bank_info: {
      bank_name: { type: String, trim: true, maxlength: 100 },
      account_no: { type: String, trim: true, maxlength: 50 },
      account_holder: { type: String, trim: true, maxlength: 150 },
    },
    status: {
      type: String,
      enum: ["PENDING_PAYMENT", "PAID", "EXPIRED", "CANCELLED", "REFUNDED"],
      default: "PENDING_PAYMENT",
      required: true,
    },
    lock_expires_at: { type: Date, required: true },
    created_at: { type: Date, default: Date.now, required: true },
  },
  options,
);

module.exports = mongoose.model("Order", schema, "orders");
