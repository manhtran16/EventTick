const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ref, options } = require('./_helpers');

// Tài khoản nhận tiền của người bán lại (Admin chuyển khoản sau khi người mua thanh toán)
const payoutBankSchema = new Schema(
  {
    bank_name: { type: String, trim: true, maxlength: 100 },
    account_no: { type: String, trim: true, maxlength: 50 },
    account_holder: { type: String, trim: true, maxlength: 150 },
  },
  { _id: false },
);

const schema = new Schema(
  {
    ticket_id: ref('Ticket', { required: true }),
    seller_id: ref('User', { required: true }),
    buyer_order_id: ref('Order'),
    original_price: { type: Number, required: true, min: 0 },
    resale_price: { type: Number, required: true, min: 0 },
    // Gói vé: nhiều vé cùng hạng/suất đăng chung 1 mã (RSL…). allow_partial=false -> người mua phải mua hết gói
    bundle_code: { type: String, maxlength: 20, index: true },
    allow_partial: { type: Boolean, default: true },
    // ACTIVE: đang bán | RESERVED: có người đang thanh toán (giữ 10 phút) | SOLD | CANCELLED
    status: { type: String, enum: ['ACTIVE', 'RESERVED', 'SOLD', 'CANCELLED'], default: 'ACTIVE', required: true },
    reserved_until: { type: Date },
    // Hướng C: seller bấm huỷ trong lúc có buyer đang giữ chỗ thanh toán -> huỷ trì hoãn
    cancel_requested: { type: Boolean, default: false },

    // Chi trả cho người bán (sau khi bán thành công)
    payout_bank: { type: payoutBankSchema },
    payout_amount: { type: Number, min: 0 },
    payout_status: { type: String, enum: ['NONE', 'PENDING', 'PAID'], default: 'NONE' },
    payout_ref: { type: String, maxlength: 255 },
    paid_out_at: { type: Date },
    paid_out_by: ref('User'),

    created_at: { type: Date, default: Date.now, required: true },
  },
  options,
);

module.exports = mongoose.model('ResaleListing', schema, 'resale_listings');
