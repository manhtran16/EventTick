/**
 * Khởi tạo database EventTick trên MongoDB theo eventtick_database_specification.md
 * - Tạo 18 collections với $jsonSchema validator (kiểu dữ liệu, required, enum)
 * - Tạo index (unique / FK lookup / TTL-like query)
 *
 * PK `xxx_id` trong spec được ánh xạ thành `_id` (ObjectId) của MongoDB.
 * Chạy lại nhiều lần an toàn: collection đã tồn tại sẽ được cập nhật validator (collMod).
 *
 * Usage: node src/db/initDatabase.js [mongoUri]
 *   Mặc định: EVENTTICK_MONGODB_URI hoặc mongodb://localhost:27017/eventtick
 */
require("dotenv").config();
const mongoose = require("mongoose");

const uri =
  process.argv[2] ||
  process.env.EVENTTICK_MONGODB_URI ||
  "mongodb://localhost:27017/eventtick";

// ---------- helpers ----------
const oid = { bsonType: "objectId" };
const oidN = { bsonType: ["objectId", "null"] };
const str = (maxLength) => (maxLength ? { bsonType: "string", maxLength } : { bsonType: "string" });
const strN = (maxLength) => ({ bsonType: ["string", "null"], ...(maxLength ? { maxLength } : {}) });
const num = { bsonType: ["double", "int", "long", "decimal"] };
const numN = { bsonType: ["double", "int", "long", "decimal", "null"] };
const nonNeg = { ...num, minimum: 0 };
const int = { bsonType: ["int", "long"] };
const intN = { bsonType: ["int", "long", "null"] };
const bool = { bsonType: "bool" };
const date = { bsonType: "date" };
const dateN = { bsonType: ["date", "null"] };
const json = { bsonType: ["object", "array"] };
const jsonN = { bsonType: ["object", "array", "null"] };
const enumOf = (...values) => ({ bsonType: "string", enum: values });

const schema = (required, properties) => ({
  $jsonSchema: { bsonType: "object", required, properties: { _id: oid, ...properties } },
});

// ---------- collections ----------
const collections = {
  users: {
    validator: schema(["email", "password_hash", "full_name", "role", "status", "created_at"], {
      email: str(255),
      password_hash: str(255),
      full_name: str(150),
      phone: strN(20),
      avatar_url: strN(),
      role: enumOf("CUSTOMER", "ORGANIZER", "STAFF", "ADMIN"),
      status: enumOf("ACTIVE", "BLOCKED", "PENDING"),
      google_id: strN(100),
      default_vat_info: jsonN,
      created_at: date,
    }),
    indexes: [
      [{ email: 1 }, { unique: true }],
      [{ username: 1 }, { unique: true, partialFilterExpression: { username: { $type: "string" } } }],
      [{ google_id: 1 }, { unique: true, partialFilterExpression: { google_id: { $type: "string" } } }],
      [{ role: 1, status: 1 }],
    ],
  },

  organizer_profiles: {
    validator: schema(
      ["user_id", "organization_name", "business_type", "tax_code", "id_card_or_license_url",
        "bank_name", "bank_account_no", "bank_account_holder", "kyc_status"],
      {
        user_id: oid,
        organization_name: str(255),
        business_type: enumOf("INDIVIDUAL", "ENTERPRISE"),
        tax_code: str(50),
        id_card_or_license_url: str(),
        bank_name: str(100),
        bank_account_no: str(50),
        bank_account_holder: str(150),
        kyc_status: enumOf("PENDING", "VERIFIED", "REJECTED"),
        verified_by: oidN,
        verified_at: dateN,
      }
    ),
    indexes: [[{ user_id: 1 }, { unique: true }], [{ kyc_status: 1 }]],
  },

  staff_assignments: {
    validator: schema(["staff_user_id", "organizer_id", "event_id", "is_active"], {
      staff_user_id: oid,
      organizer_id: oid,
      event_id: oid,
      assigned_gate: strN(100),
      is_active: bool,
    }),
    indexes: [[{ staff_user_id: 1, event_id: 1 }, { unique: true }], [{ event_id: 1 }], [{ organizer_id: 1 }]],
  },

  categories: {
    validator: schema(["name", "slug", "is_active"], {
      name: str(100),
      slug: str(100),
      is_active: bool,
      default_commission_pct: { ...numN, minimum: 0, maximum: 50 },
    }),
    indexes: [[{ slug: 1 }, { unique: true }]],
  },

  events: {
    validator: schema(
      ["organizer_id", "category_id", "title", "description", "banner_url", "venue_name", "city",
        "start_time", "end_time", "status"],
      {
        organizer_id: oid,
        category_id: oid,
        title: str(255),
        description: str(),
        banner_url: str(),
        venue_name: str(255),
        city: str(100),
        start_time: date,
        end_time: date,
        has_seat_map: bool,
        allow_resale: bool,
        max_resale_markup_pct: { ...num, minimum: 0, maximum: 999.99 },
        custom_form_schema: jsonN,
        legal_doc_url: strN(),
        status: enumOf("DRAFT", "PENDING", "APPROVED", "PUBLISHED", "CANCELLED", "ENDED"),
        is_featured_banner: bool,
      }
    ),
    indexes: [
      [{ organizer_id: 1 }],
      [{ category_id: 1 }],
      [{ status: 1, start_time: 1 }],
      [{ city: 1 }],
      [{ is_featured_banner: 1 }],
      [{ title: "text", description: "text" }],
    ],
  },

  e_contracts: {
    validator: schema(["event_id", "organizer_id", "commission_rate_pct", "contract_terms_html", "status"], {
      event_id: oid,
      organizer_id: oid,
      approved_by_admin: oidN,
      commission_rate_pct: { ...num, minimum: 0, maximum: 100 },
      contract_terms_html: str(),
      organizer_signature_url: strN(),
      signed_pdf_url: strN(),
      signer_ip: strN(45),
      signed_at: dateN,
      rejection_reason: strN(1000),
      status: enumOf("WAITING_SIGN", "SIGNED", "REJECTED"),
    }),
    indexes: [[{ event_id: 1 }, { unique: true }], [{ organizer_id: 1 }]],
  },

  // events (1) -> (N) event_sessions (1) -> (N) ticket_tiers & seats
  event_sessions: {
    validator: schema(["event_id", "name", "start_time", "end_time", "status"], {
      event_id: oid,
      name: str(255),
      start_time: date,
      end_time: date,
      status: enumOf("SCHEDULED", "CANCELLED", "ENDED"),
      seat_map: jsonN,
    }),
    indexes: [[{ event_id: 1, start_time: 1 }], [{ start_time: 1 }]],
  },

  ticket_tiers: {
    validator: schema(
      ["event_id", "session_id", "name", "price", "total_quantity", "available_quantity", "sale_start_time", "sale_end_time"],
      {
        event_id: oid,
        session_id: oid,
        name: str(150),
        price: nonNeg,
        total_quantity: { ...int, minimum: 0 },
        available_quantity: { ...int, minimum: 0 },
        min_per_order: { ...int, minimum: 1 },
        max_per_order: { ...int, minimum: 1 },
        sale_start_time: date,
        sale_end_time: date,
        zone_color: strN(20),
        zone_type: enumOf("GA", "SEATED"),
      }
    ),
    indexes: [[{ event_id: 1 }], [{ session_id: 1 }]],
  },

  seats: {
    validator: schema(["event_id", "session_id", "tier_id", "section_name", "row_label", "seat_number", "status"], {
      event_id: oid,
      session_id: oid,
      tier_id: oid,
      section_name: str(100),
      row_label: str(20),
      seat_number: str(20),
      coord_x: numN,
      coord_y: numN,
      status: enumOf("AVAILABLE", "LOCKED", "SOLD"),
      locked_by_user_id: oidN,
      lock_expires_at: dateN,
    }),
    indexes: [
      [{ session_id: 1, section_name: 1, row_label: 1, seat_number: 1 }, { unique: true }],
      [{ session_id: 1, status: 1 }],
      [{ event_id: 1 }],
      [{ tier_id: 1 }],
      [{ status: 1, lock_expires_at: 1 }],
    ],
  },

  seatmap_layouts: {
    validator: schema(["event_id", "svg_content", "sections"], {
      event_id: oid,
      svg_content: str(),
      stage_ids: json,
      sections: json,
      updated_by: oidN,
      updated_at: date,
    }),
    indexes: [[{ event_id: 1 }, { unique: true }]],
  },

  vouchers: {
    validator: schema(
      ["event_id", "code", "discount_type", "discount_value", "usage_limit", "used_count", "max_per_user",
        "valid_from", "valid_until", "is_active"],
      {
        event_id: oid,
        code: str(50),
        discount_type: enumOf("PERCENT", "FIXED"),
        discount_value: nonNeg,
        max_discount_amount: numN,
        min_order_amount: nonNeg,
        usage_limit: { ...int, minimum: 0 },
        used_count: { ...int, minimum: 0 },
        max_per_user: { ...int, minimum: 1 },
        valid_from: date,
        valid_until: date,
        is_active: bool,
      }
    ),
    indexes: [[{ event_id: 1, code: 1 }, { unique: true }]],
  },

  orders: {
    validator: schema(
      ["buyer_id", "event_id", "session_id", "order_code", "order_type", "items_snapshot", "subtotal_amount",
        "discount_amount", "total_amount", "status", "lock_expires_at", "created_at"],
      {
        buyer_id: oid,
        event_id: oid,
        session_id: oid, // 1 đơn hàng thuộc đúng 1 suất diễn
        voucher_id: oidN,
        order_code: str(50),
        order_type: enumOf("PRIMARY", "RESALE"),
        items_snapshot: {
          bsonType: "array",
          minItems: 1,
          items: {
            bsonType: "object",
            required: ["tier_id", "quantity", "seat_ids"],
            properties: {
              tier_id: oid,
              tier_name: { bsonType: "string" },
              unit_price: nonNeg,
              quantity: { ...int, minimum: 1 },
              seat_ids: { bsonType: "array", items: oid },
            },
          },
        },
        subtotal_amount: nonNeg,
        discount_amount: nonNeg,
        total_amount: nonNeg,
        attendee_form_answers: jsonN,
        vat_invoice_info: jsonN,
        refund_bank_info: jsonN,
        resale_listing_ids: { bsonType: ["array", "null"], items: oid },
        status: enumOf("PENDING_PAYMENT", "PAID", "EXPIRED", "CANCELLED", "REFUNDED"),
        lock_expires_at: date,
        created_at: date,
      }
    ),
    indexes: [
      [{ order_code: 1 }, { unique: true }],
      [{ buyer_id: 1, created_at: -1 }],
      [{ event_id: 1, status: 1 }],
      [{ session_id: 1, status: 1 }],
      [{ status: 1, lock_expires_at: 1 }],
      [{ voucher_id: 1 }],
    ],
  },

  payments: {
    validator: schema(["order_id", "gateway", "transaction_ref", "amount", "status"], {
      order_id: oid,
      gateway: enumOf("VNPAY", "VIETQR", "MOMO", "STRIPE"),
      transaction_ref: str(100),
      amount: nonNeg,
      status: enumOf("INITIATED", "SUCCESS", "FAILED", "REFUNDED"),
      webhook_payload: jsonN,
      paid_at: dateN,
    }),
    indexes: [[{ order_id: 1 }, { unique: true }], [{ transaction_ref: 1 }, { unique: true }]],
  },

  tickets: {
    validator: schema(
      ["order_id", "event_id", "session_id", "tier_id", "owner_id", "ticket_code", "qr_hash_signature", "status"],
      {
        order_id: oid,
        event_id: oid,
        session_id: oid,
        tier_id: oid,
        seat_id: oidN, // null = Vé đứng (GA)
        owner_id: oid,
        ticket_code: str(50),
        qr_hash_signature: str(255),
        status: enumOf("VALID", "USED", "LISTED_RESALE", "RESOLD_INVALID", "REFUNDED"),
        checked_in_at: dateN,
        checked_in_by: oidN,
      }
    ),
    indexes: [
      [{ ticket_code: 1 }, { unique: true }],
      [{ qr_hash_signature: 1 }, { unique: true }],
      [{ order_id: 1 }],
      [{ owner_id: 1 }],
      [{ event_id: 1, status: 1 }],
      [{ seat_id: 1 }],
      [{ session_id: 1, status: 1 }],
    ],
  },

  resale_listings: {
    validator: schema(["ticket_id", "seller_id", "original_price", "resale_price", "status", "created_at"], {
      ticket_id: oid,
      seller_id: oid,
      buyer_order_id: oidN,
      original_price: nonNeg,
      resale_price: nonNeg,
      status: enumOf("ACTIVE", "RESERVED", "SOLD", "CANCELLED"),
      reserved_until: dateN,
      bundle_code: strN(20),
      allow_partial: { bsonType: ["bool", "null"] },
      payout_bank: jsonN,
      payout_amount: numN,
      payout_status: { bsonType: ["string", "null"], enum: ["NONE", "PENDING", "PAID", null] },
      payout_ref: strN(255),
      paid_out_at: dateN,
      paid_out_by: oidN,
      created_at: date,
    }),
    indexes: [[{ ticket_id: 1 }, { unique: true }], [{ seller_id: 1 }], [{ status: 1, created_at: -1 }], [{ bundle_code: 1 }]],
  },

  refund_requests: {
    validator: schema(["order_id", "user_id", "refund_type", "refund_amount", "reason", "status"], {
      order_id: oid,
      ticket_id: oidN,
      user_id: oid,
      refund_type: enumOf("EVENT_BULK_REFUND"),
      refund_amount: nonNeg,
      reason: str(),
      status: enumOf("PROCESSING", "COMPLETED", "REJECTED"),
      transfer_reference: strN(255),
      processed_by: oidN,
      processing_note: strN(1000),
      processed_at: dateN,
    }),
    indexes: [[{ order_id: 1 }], [{ user_id: 1 }], [{ status: 1 }]],
  },

  payout_settlements: {
    validator: schema(
      ["event_id", "organizer_id", "contract_id", "gross_revenue", "total_refunded",
        "platform_commission_amt", "net_payout_amount", "status"],
      {
        event_id: oid,
        organizer_id: oid,
        contract_id: oid,
        gross_revenue: nonNeg,
        total_refunded: nonNeg,
        platform_commission_amt: nonNeg,
        net_payout_amount: num,
        bank_transfer_receipt_url: strN(),
        status: enumOf("REQUESTED", "APPROVED", "SETTLED", "REJECTED"),
        rejection_reason: strN(1000),
        rejected_by_admin: oidN,
        settled_by_admin: oidN,
        settled_at: dateN,
      }
    ),
    indexes: [[{ event_id: 1 }, { unique: true }], [{ organizer_id: 1 }], [{ status: 1 }]],
  },

  // Thông báo trong ứng dụng (chuông ở Dashboard)
  notifications: {
    validator: schema(["user_id", "type", "title", "created_at"], {
      user_id: oid,
      type: str(50),
      title: str(200),
      body: strN(1000),
      link: strN(300),
      read_at: dateN,
      created_at: date,
    }),
    indexes: [[{ user_id: 1, created_at: -1 }], [{ user_id: 1, read_at: 1 }]],
  },
};

// ---------- run ----------
/** Tạo/cập nhật 18 collection + validator + index trên kết nối mongoose đang mở. */
async function initDatabase(connection = mongoose.connection) {
  const db = connection.db;

  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

  for (const [name, { validator, indexes }] of Object.entries(collections)) {
    const opts = { validator, validationLevel: "strict", validationAction: "error" };
    if (existing.has(name)) {
      await db.command({ collMod: name, ...opts });
    } else {
      await db.createCollection(name, opts);
    }
    // Index unique cũ của seats (chưa có session_id) chặn sự kiện nhiều suất diễn: bỏ nếu còn sót
    if (name === "seats" && existing.has(name)) {
      await db.collection(name).dropIndex("event_id_1_section_name_1_row_label_1_seat_number_1").catch(() => {});
    }
    for (const [keys, options = {}] of indexes) {
      await db.collection(name).createIndex(keys, options);
    }
    console.log(`  ${existing.has(name) ? "updated" : "created"}  ${name}  (${indexes.length} indexes)`);
  }

  console.log(`Done: ${Object.keys(collections).length} collections.`);
}

module.exports = initDatabase;

if (require.main === module) {
  (async () => {
    await mongoose.connect(uri);
    console.log(`Connected: ${uri} (db: ${mongoose.connection.db.databaseName})`);
    await initDatabase();
    await mongoose.disconnect();
  })().catch(async (err) => {
    console.error("Init failed:", err.message);
    await mongoose.disconnect();
    process.exit(1);
  });
}
