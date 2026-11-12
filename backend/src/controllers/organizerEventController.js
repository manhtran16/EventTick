const ExcelJS = require("exceljs");
const {
  Event,
  EventSession,
  TicketTier,
  Seat,
  Order,
  Category,
  EContract,
  Voucher,
  Ticket,
  StaffAssignment,
  PayoutSettlement,
  User,
  OrganizerProfile,
} = require("../models");
const { savePrivate } = require("../services/privateStorage");
const { saveUploadedFile } = require("../utils/upload");
const bookingService = require("../services/bookingService");
const { sniff, resourceTypeOf } = require("../utils/fileType");
const { httpError, validId, ah, str, intIn, date } = require("../utils/http");
const { audit } = require("../utils/audit");
const { notifyAdmins } = require("../services/notificationService");
const { logEventStatus } = require("../utils/eventHistory");

const HOUR = 3600 * 1000;
const SELLING = ["DRAFT", "APPROVED", "PUBLISHED"]; // trạng thái cho phép chỉnh hạng vé / sơ đồ
const COLOR = /^#[0-9a-fA-F]{6}$/;

const num = (v, min, max, label) => {
  const n = Number(v);
  if (v === "" || v === null || v === undefined || !Number.isFinite(n) || n < min || n > max) {
    throw httpError(`${label} phải là số từ ${min} đến ${max}`, 400);
  }
  return n;
};
const bool = (v) => v === true || v === "true";

// ------------------------------------------------------------------ quyền sở hữu
async function ownEvent(req, id) {
  const e = await Event.findOne({ _id: validId(id, "ID sự kiện"), organizer_id: req.user.id });
  if (!e) throw httpError("Không tìm thấy sự kiện", 404);
  return e;
}
async function ownSession(req, id) {
  const s = await EventSession.findById(validId(id, "ID suất diễn"));
  const e = s && (await Event.findOne({ _id: s.event_id, organizer_id: req.user.id }));
  if (!s || !e) throw httpError("Không tìm thấy suất diễn", 404);
  return { session: s, event: e };
}
async function ownTier(req, id) {
  const t = await TicketTier.findById(validId(id, "ID hạng vé"));
  const e = t && (await Event.findOne({ _id: t.event_id, organizer_id: req.user.id }));
  if (!t || !e) throw httpError("Không tìm thấy hạng vé", 404);
  return { tier: t, event: e };
}
const assertSelling = (event) => {
  if (!SELLING.includes(event.status)) {
    throw httpError(
      event.status === "PENDING"
        ? "Sự kiện đang chờ duyệt, hãy rút lại (POST /events/:id/withdraw) trước khi chỉnh sửa"
        : `Không chỉnh sửa được khi sự kiện ở trạng thái ${event.status}`,
      409,
    );
  }
};

// ------------------------------------------------------------------ chuẩn hoá dữ liệu vào
function parseSession(raw, i = 0, { requireFuture = true } = {}) {
  const r = raw || {};
  const start = date(r.startTime ?? r.eventDate, `Suất ${i + 1}: thời gian bắt đầu`);
  const end = r.endTime ? date(r.endTime, `Suất ${i + 1}: thời gian kết thúc`) : new Date(start.getTime() + 3 * HOUR);
  if (end <= start) throw httpError(`Suất ${i + 1}: giờ kết thúc phải sau giờ bắt đầu`, 400);
  if (requireFuture && start <= new Date()) {
    throw httpError(`Suất ${i + 1}: thời gian bắt đầu (${start.toLocaleString("vi-VN")}) phải diễn ra trong tương lai`, 400);
  }
  return { name: str(r.name || `Suất diễn ${i + 1}`, 255, "tên suất"), start_time: start, end_time: end };
}

function parseTier(raw, sessionStart, label = "Hạng vé") {
  const r = raw || {};
  const total = intIn(r.totalQuantity ?? r.quantity ?? r.stock ?? r.totalCapacity, 1, 100000, `${label}: số lượng`);
  const min = intIn(r.minPerOrder ?? r.minOrder ?? 1, 1, 100, `${label}: tối thiểu mỗi đơn`);
  const rawMax = r.maxPerOrder ?? r.maxOrder;
  const max = intIn(rawMax !== undefined ? rawMax : Math.max(10, min), 1, 100, `${label}: tối đa mỗi đơn`);
  if (min > max) throw httpError(`${label}: số vé tối thiểu mỗi đơn (${min}) không được lớn hơn tối đa (${max})`, 400);
  const from = r.saleStartTime ? date(r.saleStartTime, `${label}: giờ mở bán`) : new Date();
  const to = r.saleEndTime ? date(r.saleEndTime, `${label}: giờ đóng bán`) : (sessionStart || new Date(from.getTime() + 7 * 24 * HOUR));
  let safeTo = to;
  if (to <= from) {
    console.warn(`⚠️ [parseTier] ${label}: giờ đóng bán (${to.toISOString()}) <= giờ mở bán (${from.toISOString()}), tự động điều chỉnh đóng bán sau mở bán 1 giờ`);
    safeTo = new Date(from.getTime() + HOUR);
  }
  if (r.zoneColor && !COLOR.test(r.zoneColor)) throw httpError(`${label}: zoneColor phải dạng #RRGGBB`, 400);
  const rawZoneType = String(r.zoneType ?? r.zone_type ?? "GA").toUpperCase();
  if (!["GA", "SEATED"].includes(rawZoneType)) {
    throw httpError(`${label}: zoneType phải là "GA" hoặc "SEATED"`, 400);
  }
  return {
    name: str(r.name, 150, `${label}: tên`),
    price: num(r.price, 0, 100_000_000, `${label}: giá`),
    total_quantity: total,
    available_quantity: total,
    zone_type: rawZoneType,
    min_per_order: min,
    max_per_order: max,
    sale_start_time: from,
    sale_end_time: safeTo,
    zone_color: r.zoneColor || undefined,
    description: str(r.description ?? r.desc, 500, `${label}: mô tả`, { required: false }) || "",
  };
}

function parseForm(schema) {
  if (schema === null || schema === undefined) return null;
  const list = Array.isArray(schema) ? schema : [];
  if (list.length > 20) throw httpError("Form tùy chỉnh tối đa 20 câu hỏi", 400);
  const keys = new Set();
  return list.map((f, i) => {
    const key = String(f?.key || f?.fieldName || "");
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key)) throw httpError(`Câu hỏi ${i + 1}: key phải bắt đầu bằng chữ, chỉ gồm chữ/số/_ (tối đa 40)`, 400);
    if (keys.has(key)) throw httpError(`Câu hỏi ${i + 1}: key "${key}" bị trùng`, 400);
    keys.add(key);
    const type = String(f?.type || f?.fieldType || "text");
    if (!["text", "textarea", "select", "checkbox", "number"].includes(type)) throw httpError(`Câu hỏi ${i + 1}: type không hợp lệ`, 400);
    const required = f?.required !== undefined ? bool(f.required) : bool(f?.isRequired);
    const out = { key, label: str(f.label, 200, `Câu hỏi ${i + 1}: nhãn`), type, required };
    if (type === "select") {
      if (!Array.isArray(f.options) || f.options.length < 2 || f.options.length > 20) throw httpError(`Câu hỏi ${i + 1}: select cần 2–20 lựa chọn`, 400);
      out.options = f.options.map((o) => str(o, 100, `Câu hỏi ${i + 1}: lựa chọn`));
    }
    return out;
  });
}

async function findCategory(name) {
  if (!name) {
    const fallback = await Category.findOne({ slug: "khac" }) || await Category.findOne();
    return fallback;
  }
  let c = await Category.findOne({ $or: [{ name }, { slug: name }] });
  if (!c) {
    c = await Category.findOne({ name: new RegExp(`^${name.trim()}$`, "i") });
  }
  if (!c) {
    c = (await Category.findOne({ slug: "khac" })) || (await Category.findOne());
  }
  if (!c) throw httpError(`Không tìm thấy danh mục phù hợp cho "${name}"`, 400);
  return c;
}

/** Cập nhật các trường tổng hợp của sự kiện sau khi đổi suất / hạng vé. */
async function recalcEvent(eventId) {
  const { SeatmapLayout } = require("../models");
  const [sessions, tiers, layout] = await Promise.all([
    EventSession.find({ event_id: eventId }),
    TicketTier.find({ event_id: eventId }),
    SeatmapLayout.exists({ event_id: eventId }),
  ]);
  const upd = { lowest_price: tiers.length ? Math.min(...tiers.map((t) => t.price)) : 0, has_seat_map: Boolean(layout) || tiers.some((t) => t.zone_type === "SEATED") };
  if (sessions.length) {
    upd.start_time = new Date(Math.min(...sessions.map((s) => s.start_time)));
    upd.end_time = new Date(Math.max(...sessions.map((s) => s.end_time)));
  }
  await Event.updateOne({ _id: eventId }, upd);
}

const usedOf = (t) => t.total_quantity - t.available_quantity; // đã bán + đang giữ chỗ

function tierToClient(t) {
  const o = t.toObject ? t.toObject() : t;
  return {
    _id: o._id, sessionId: o.session_id, name: o.name, price: o.price, totalQuantity: o.total_quantity,
    availableQuantity: o.available_quantity, used: usedOf(o), minPerOrder: o.min_per_order, maxPerOrder: o.max_per_order,
    saleStartTime: o.sale_start_time, saleEndTime: o.sale_end_time, zoneColor: o.zone_color, zoneType: o.zone_type || "GA",
    zone_type: o.zone_type || "GA", description: o.description,
  };
}

// ------------------------------------------------------------------ UC22: tạo sự kiện
// POST /v1/events (multipart: data = JSON, backgroundImage, eventImage)
exports.create = ah(async (req, res) => {
  console.log(`\n================================================================`);
  console.log(`🚀 [Tạo sự kiện] Nhận request POST /v1/events từ User: ${req.user?.username || req.user?.id || "Ẩn danh"}`);

  let payload;
  try {
    payload = JSON.parse(req.body?.data || "{}");
  } catch (parseErr) {
    console.error("❌ [Tạo sự kiện] Lỗi parse JSON trường data:", parseErr.message);
    throw httpError("Trường data không phải JSON hợp lệ", 400);
  }

  const files = Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat();
  const bgFile = files.find((f) => f.fieldname === "backgroundImage");
  const thumbFile = files.find((f) => f.fieldname === "eventImage");

  console.log(`📝 [Tạo sự kiện] Tên: "${payload.title || payload.eventName || "(chưa đặt tên)"}" | Danh mục: "${payload.category || "(mặc định)"}" | Số suất diễn: ${payload.sessions?.length || 0} | File ảnh tải lên: ${files.length}`);

  for (const f of [bgFile, thumbFile].filter(Boolean)) {
    const fileKind = sniff(f.buffer);
    if (!["jpeg", "png", "webp"].includes(fileKind)) {
      console.error(`❌ [Tạo sự kiện] File "${f.originalname}" không đúng định dạng: ${fileKind}`);
      throw httpError(`Ảnh "${f.originalname}" phải là định dạng JPG, PNG hoặc WEBP`, 400);
    }
  }

  const draft = bool(payload.saveAsDraft);
  if (!draft) {
    throw httpError("Gửi duyệt cần có giấy phép tổ chức sự kiện: hãy lưu bản nháp, tải giấy phép lên rồi bấm Gửi duyệt", 400);
  }
  const title = str(payload.title || payload.eventName, 255, "tên sự kiện");
  const category = await findCategory(payload.category || "Khác");
  console.log(`📂 [Tạo sự kiện] Khớp danh mục DB: "${category.name}" (ID: ${category._id})`);

  const rawSessions = Array.isArray(payload.sessions) ? payload.sessions : [];
  if (!rawSessions.length) throw httpError("Cần ít nhất 1 suất diễn", 400);
  if (rawSessions.length > 30) throw httpError("Tối đa 30 suất diễn", 400);
  const sessionDefs = rawSessions.map((s, i) => parseSession(s, i, { requireFuture: !draft }));
  const tierLists = rawSessions.map((s, i) => {
    const list = s.tickets || s.zones || [];
    if (!draft && !list.length) throw httpError(`Suất ${i + 1}: cần ít nhất 1 hạng vé`, 400);
    return list.map((t, j) => parseTier(t, sessionDefs[i].start_time, `Suất ${i + 1}, hạng vé ${j + 1}`));
  });

  const venue = str(payload.venueName || payload.location || payload.eventAddress, 255, "địa điểm");
  const city = str(payload.city || (venue ? venue.split(",").pop().trim() : "") || "Toàn quốc", 100, "thành phố");
  const form = parseForm(payload.customFormSchema);
  const markup = num(payload.maxResaleMarkupPct ?? 0, 0, 100, "maxResaleMarkupPct");

  let bannerUrl = payload.backgroundImage || payload.bannerUrl || "https://picsum.photos/seed/default/800/450";
  let thumbUrl = payload.eventImage || payload.thumbnailUrl;
  try {
    if (bgFile) bannerUrl = await saveUploadedFile(req, bgFile);
    if (thumbFile) thumbUrl = await saveUploadedFile(req, thumbFile);
  } catch (e) {
    console.error("❌ [Tạo sự kiện] Upload ảnh lỗi:", e.message || e);
    throw httpError("Không tải được ảnh lên (hãy thử lại hoặc kiểm tra ảnh)", 502);
  }

  const created = { event: null };
  try {
    const event = await Event.create({
      organizer_id: req.user.id,
      category_id: category._id,
      title,
      description: String(payload.description || payload.eventDesc || "").slice(0, 20000),
      banner_url: bannerUrl,
      thumbnail_url: thumbUrl || bannerUrl,
      venue_name: venue,
      city,
      start_time: new Date(Math.min(...sessionDefs.map((s) => s.start_time))),
      end_time: new Date(Math.max(...sessionDefs.map((s) => s.end_time))),
      allow_resale: bool(payload.allowResale),
      max_resale_markup_pct: markup,
      custom_form_schema: form || undefined,
      organizer_name: payload.organizerName || req.user.username,
      organizer_info: payload.organizerInfo || "",
      event_type: payload.eventType === "online" ? "online" : "offline",
      status: draft ? "DRAFT" : "PENDING",
    });
    created.event = event;

    const sessions = await EventSession.insertMany(sessionDefs.map((s) => ({ ...s, event_id: event._id })));
    const tiers = tierLists.flatMap((list, i) => list.map((t) => ({ ...t, event_id: event._id, session_id: sessions[i]._id })));
    if (tiers.length) await TicketTier.insertMany(tiers);
    await recalcEvent(event._id);

    // Lưu thông tin thanh toán của Organizer nếu có gửi kèm
    if (payload.paymentInfo && req.user.id) {
      const { accountOwner, accountNumber, bankName, branch } = payload.paymentInfo;
      if (accountOwner || accountNumber || bankName) {
        await OrganizerProfile.findOneAndUpdate(
          { user_id: req.user.id },
          {
            $set: {
              bank_account_name: accountOwner,
              bank_account_number: accountNumber,
              bank_name: bankName,
              bank_branch: branch,
            },
          },
          { upsert: false }
        ).catch((e) => console.warn("⚠️ Lưu paymentInfo organizer thất bại:", e.message));
      }
    }

    await audit(req, draft ? "EVENT_CREATE_DRAFT" : "EVENT_CREATE", "events", event._id);
    await logEventStatus(event._id, event.status, { by: req.user.id, note: draft ? "Tạo bản nháp" : "Tạo và gửi duyệt" });
    if (!draft) notifyAdmins({ type: "EVENT_SUBMITTED", title: "Sự kiện mới chờ duyệt", body: `"${event.title}" vừa được gửi duyệt.`, link: "/admin/events" });

    console.log(`✅ [Tạo sự kiện THÀNH CÔNG] Event ID: ${event._id} | Tiêu đề: "${event.title}" | Trạng thái: ${event.status}`);
    console.log(`================================================================\n`);

    res.status(201).json({
      success: true,
      message: draft ? "Đã lưu bản nháp." : "Tạo sự kiện thành công! Sự kiện đang chờ Admin phê duyệt.",
      eventId: event._id,
      status: event.status,
    });
  } catch (err) {
    console.error(`💥 [Tạo sự kiện THẤT BẠI]:`, err.message || err);
    if (created.event) {
      console.log(`🧹 [Rollback] Đang dọn dẹp eventId: ${created.event._id}`);
      await TicketTier.deleteMany({ event_id: created.event._id });
      await EventSession.deleteMany({ event_id: created.event._id });
      await Event.deleteOne({ _id: created.event._id });
    }
    throw err;
  }
});

// GET /v1/organizer/events
exports.list = ah(async (req, res) => {
  const events = await Event.find({ organizer_id: req.user.id }).sort({ _id: -1 })
    .select("title status start_time end_time venue_name city banner_url rejection_reason lowest_price has_seat_map");
  res.json({ success: true, events });
});

// GET /v1/organizer/events/:id — chi tiết đầy đủ để chỉnh sửa
exports.detail = ah(async (req, res) => {
  const e = await ownEvent(req, req.params.id);
  const [sessions, tiers, contract, vouchers] = await Promise.all([
    EventSession.find({ event_id: e._id }).sort({ start_time: 1 }),
    TicketTier.find({ event_id: e._id }).sort({ price: 1 }),
    EContract.findOne({ event_id: e._id }).select("status commission_rate_pct signed_at rejection_reason"),
    Voucher.countDocuments({ event_id: e._id }),
  ]);
  const o = e.toObject();
  res.json({
    success: true,
    event: {
      _id: o._id, title: o.title, description: o.description, organizerInfo: o.organizer_info, venueName: o.venue_name, city: o.city,
      bannerUrl: o.banner_url, thumbnailUrl: o.thumbnail_url, status: o.status, rejectionReason: o.rejection_reason,
      startTime: o.start_time, endTime: o.end_time, hasSeatMap: o.has_seat_map, hasLegalDoc: Boolean(o.legal_doc_url),
      allowResale: o.allow_resale, maxResaleMarkupPct: o.max_resale_markup_pct,
      customFormSchema: o.custom_form_schema || [],
      sessions: sessions.map((s) => ({
        _id: s._id, name: s.name, startTime: s.start_time, endTime: s.end_time, status: s.status, seatMap: s.seat_map,
        tiers: tiers.filter((t) => t.session_id.equals(s._id)).map(tierToClient),
      })),
      contract: contract ? { status: contract.status, commissionRatePct: contract.commission_rate_pct, signedAt: contract.signed_at, rejectionReason: contract.rejection_reason } : null,
      voucherCount: vouchers,
    },
  });
});

// GET /v1/organizer/events/:id/history — các mốc trạng thái của sự kiện (mới nhất trước)
exports.history = ah(async (req, res) => {
  const e = await ownEvent(req, req.params.id);
  const history = [...(e.status_history || [])].sort((a, b) => new Date(b.at) - new Date(a.at));
  // Sự kiện tạo trước khi có tính năng này: vẫn hiện được mốc tạo
  if (!history.length) history.push({ status: e.status, at: e.created_at, note: "Chưa có lịch sử chi tiết" });
  res.json({ success: true, status: e.status, history: history.map((h) => ({ status: h.status, at: h.at, note: h.note })) });
});

// ------------------------------------------------------------------ UC23: sửa / rút / huỷ
const STRUCTURAL = ["title", "venueName", "city", "category", "allowResale", "maxResaleMarkupPct", "customFormSchema", "eventType"];

// PUT /v1/organizer/events/:id
exports.update = ah(async (req, res) => {
  const e = await ownEvent(req, req.params.id);
  if (["CANCELLED", "ENDED"].includes(e.status)) throw httpError(`Sự kiện đã ${e.status === "ENDED" ? "kết thúc" : "bị huỷ"}, không thể sửa`, 409);
  const b = req.body || {};
  const touchesStructure = STRUCTURAL.some((k) => b[k] !== undefined);
  if (touchesStructure && e.status !== "DRAFT") {
    throw httpError(
      e.status === "PENDING"
        ? "Sự kiện đang chờ duyệt. Hãy rút lại (POST /events/:id/withdraw) rồi sửa."
        : "Sự kiện đã được duyệt, chỉ sửa được mô tả và thông tin tổ chức (tiêu đề, địa điểm, chính sách đã nằm trong hợp đồng).",
      409,
    );
  }
  const set = {};
  if (b.description !== undefined) set.description = String(b.description).slice(0, 20000);
  if (b.organizerInfo !== undefined) set.organizer_info = String(b.organizerInfo).slice(0, 5000);
  if (b.title !== undefined) set.title = str(b.title, 255, "tên sự kiện");
  if (b.venueName !== undefined) set.venue_name = str(b.venueName, 255, "địa điểm");
  if (b.city !== undefined) set.city = str(b.city, 100, "thành phố");
  if (b.category !== undefined) set.category_id = (await findCategory(String(b.category)))._id;
  if (b.allowResale !== undefined) set.allow_resale = bool(b.allowResale);
  if (b.maxResaleMarkupPct !== undefined) set.max_resale_markup_pct = num(b.maxResaleMarkupPct, 0, 100, "maxResaleMarkupPct");
  if (b.eventType !== undefined) set.event_type = b.eventType === "online" ? "online" : "offline";
  if (b.customFormSchema !== undefined) set.custom_form_schema = parseForm(b.customFormSchema) || [];
  if (!Object.keys(set).length) throw httpError("Không có trường nào để cập nhật", 400);

  const updated = await Event.findOneAndUpdate({ _id: e._id, status: e.status }, { $set: set }, { new: true });
  if (!updated) throw httpError("Trạng thái sự kiện vừa thay đổi, hãy tải lại", 409);
  await audit(req, "EVENT_UPDATE", "events", e._id, { fields: Object.keys(set) });
  res.json({ success: true, message: "Đã cập nhật sự kiện", status: updated.status });
});

// PUT /v1/organizer/events/:id/images (multipart: backgroundImage, eventImage)
exports.images = ah(async (req, res) => {
  const e = await ownEvent(req, req.params.id);
  if (["CANCELLED", "ENDED"].includes(e.status)) throw httpError("Sự kiện đã kết thúc hoặc bị huỷ", 409);
  const files = req.files || [];
  const bg = files.find((f) => f.fieldname === "backgroundImage");
  const th = files.find((f) => f.fieldname === "eventImage");
  if (!bg && !th) throw httpError("Thiếu ảnh (backgroundImage hoặc eventImage)", 400);
  for (const f of [bg, th].filter(Boolean)) if (!["jpeg", "png", "webp"].includes(sniff(f.buffer))) throw httpError("Ảnh phải là JPG, PNG hoặc WEBP", 400);
  const set = {};
  try {
    if (bg) set.banner_url = await saveUploadedFile(req, bg);
    if (th) set.thumbnail_url = await saveUploadedFile(req, th);
  } catch (err) {
    console.error("Upload ảnh lỗi:", err.message || err);
    throw httpError("Không tải được ảnh lên (kiểm tra cấu hình Cloudinary trong .env)", 502);
  }
  await Event.updateOne({ _id: e._id }, { $set: set });
  res.json({ success: true, bannerUrl: set.banner_url, thumbnailUrl: set.thumbnail_url });
});

// PUT /v1/organizer/events/:id/legal-doc (multipart: document) — giấy phép biểu diễn, lưu riêng tư
exports.legalDoc = ah(async (req, res) => {
  const e = await ownEvent(req, req.params.id);
  if (!["DRAFT", "PENDING"].includes(e.status)) throw httpError("Chỉ nộp / thay giấy phép khi sự kiện ở DRAFT hoặc PENDING", 409);
  if (!req.file) throw httpError("Thiếu tệp giấy phép (field document)", 400);
  const kind = sniff(req.file.buffer);
  if (!["jpeg", "png", "webp", "pdf"].includes(kind)) throw httpError("Giấy phép phải là ảnh JPG/PNG/WEBP hoặc PDF", 400);
  let ref;
  try {
    ref = await savePrivate(req.file.buffer, { filename: req.file.originalname, folder: "eventtick_legal", resourceType: resourceTypeOf(kind) });
  } catch (err) {
    console.error("Upload giấy phép lỗi:", err.message || err);
    throw httpError("Không lưu được tệp (kiểm tra cấu hình Cloudinary trong .env)", 502);
  }
  await Event.updateOne({ _id: e._id }, { $set: { legal_doc_url: ref } });
  await audit(req, "EVENT_LEGAL_DOC_UPLOAD", "events", e._id);
  res.json({ success: true, message: "Đã lưu giấy phép", hasLegalDoc: true });
});

// POST /v1/organizer/events/:id/submit — DRAFT -> PENDING (gửi Admin duyệt)
exports.submit = ah(async (req, res) => {
  const e = await ownEvent(req, req.params.id);
  if (e.status !== "DRAFT") throw httpError(`Chỉ gửi duyệt được sự kiện DRAFT (hiện: ${e.status})`, 409);
  if (!e.legal_doc_url) throw httpError("Cần tải lên giấy phép tổ chức sự kiện trước khi gửi duyệt (vào Chỉnh sửa, bước Thông tin)", 400);
  const [sessions, tiers] = await Promise.all([EventSession.find({ event_id: e._id }), TicketTier.find({ event_id: e._id })]);
  if (!sessions.length) throw httpError("Cần ít nhất 1 suất diễn", 400);
  for (const s of sessions) {
    if (s.start_time <= new Date()) throw httpError(`Suất "${s.name}" đã qua, hãy sửa giờ hoặc xoá suất`, 400);
    if (!tiers.some((t) => t.session_id.equals(s._id))) throw httpError(`Suất "${s.name}" chưa có hạng vé nào`, 400);
  }
  const claimed = await Event.findOneAndUpdate({ _id: e._id, status: "DRAFT" }, { status: "PENDING", $unset: { rejection_reason: 1 } }, { new: true });
  if (!claimed) throw httpError("Trạng thái sự kiện vừa thay đổi", 409);
  await audit(req, "EVENT_SUBMIT", "events", e._id);
  await logEventStatus(e._id, "PENDING", { by: req.user.id, note: "Gửi Admin duyệt" });
  notifyAdmins({ type: "EVENT_SUBMITTED", title: "Sự kiện mới chờ duyệt", body: `"${e.title}" vừa được gửi duyệt.`, link: "/admin/events" });
  res.json({ success: true, message: "Đã gửi Admin duyệt", status: claimed.status });
});

// POST /v1/organizer/events/:id/withdraw — PENDING -> DRAFT (rút lại để chỉnh sửa)
exports.withdraw = ah(async (req, res) => {
  const e = await ownEvent(req, req.params.id);
  const claimed = await Event.findOneAndUpdate({ _id: e._id, status: "PENDING" }, { status: "DRAFT" }, { new: true });
  if (!claimed) throw httpError(`Chỉ rút lại được sự kiện đang chờ duyệt (hiện: ${e.status})`, 409);
  await audit(req, "EVENT_WITHDRAW", "events", e._id);
  await logEventStatus(e._id, "DRAFT", { by: req.user.id, note: "Organizer rút lại để chỉnh sửa" });
  res.json({ success: true, message: "Đã rút lại, sự kiện trở về bản nháp", status: claimed.status });
});

// POST /v1/organizer/events/:id/cancel — UC23: huỷ sự kiện & tự động kích hoạt hoàn tiền hàng loạt (UC43) nếu đã có đơn PAID
exports.cancel = ah(async (req, res) => {
  const e = await ownEvent(req, req.params.id);
  if (["CANCELLED", "ENDED"].includes(e.status)) throw httpError(`Sự kiện đã ở trạng thái ${e.status}`, 409);
  const reason = str(req.body?.reason, 1000, "lý do huỷ", { required: false }) || "Ban tổ chức hủy sự kiện";
  const paid = await Order.countDocuments({ event_id: e._id, status: "PAID" });

  if (paid > 0) {
    if (req.body?.autoRefund === false) {
      throw httpError(`Sự kiện đã có ${paid} đơn đã thanh toán. Bỏ cờ autoRefund=false hoặc liên hệ Admin để hoàn tiền hàng loạt (UC43).`, 409);
    }
    const bulkResult = await bookingService.bulkRefundAndCancelEvent(e._id, reason);
    await audit(req, "EVENT_CANCEL_WITH_BULK_REFUND", "events", e._id, {
      refundedOrdersCount: bulkResult.refundedOrdersCount,
      totalRefundAmount: bulkResult.totalRefundAmount,
      releasedPendingOrders: bulkResult.releasedPendingOrders,
      reason,
    });
    return res.json({
      success: true,
      message: `Đã hủy sự kiện và hoàn tiền hàng loạt cho ${bulkResult.refundedOrdersCount} đơn hàng`,
      status: "CANCELLED",
      releasedOrders: bulkResult.releasedPendingOrders,
      refundedCount: bulkResult.refundedOrdersCount,
      totalRefundAmount: bulkResult.totalRefundAmount,
      notifiedBuyersCount: bulkResult.notifiedBuyersCount,
    });
  }

  const claimed = await Event.findOneAndUpdate({ _id: e._id, status: { $in: ["DRAFT", "PENDING", "APPROVED", "PUBLISHED"] } }, { status: "CANCELLED" }, { new: true });
  if (!claimed) throw httpError("Trạng thái sự kiện vừa thay đổi", 409);
  const released = await bookingService.cancelPendingOrdersOfEvent(e._id);
  await EventSession.updateMany({ event_id: e._id }, { status: "CANCELLED" });
  await EContract.updateOne({ event_id: e._id, status: "WAITING_SIGN" }, { status: "REJECTED" });
  await audit(req, "EVENT_CANCEL", "events", e._id, { releasedOrders: released, reason });
  await logEventStatus(e._id, "CANCELLED", { by: req.user.id, note: `Organizer huỷ: ${reason}` });
  res.json({ success: true, message: "Đã huỷ sự kiện", status: "CANCELLED", releasedOrders: released, refundedCount: 0 });
});

// ------------------------------------------------------------------ suất diễn (chỉ khi DRAFT)
exports.addSession = ah(async (req, res) => {
  const e = await ownEvent(req, req.params.id);
  if (e.status !== "DRAFT") throw httpError("Chỉ thêm / sửa / xoá suất diễn khi sự kiện ở DRAFT (suất diễn nằm trong hợp đồng)", 409);
  if ((await EventSession.countDocuments({ event_id: e._id })) >= 30) throw httpError("Tối đa 30 suất diễn", 400);
  const s = await EventSession.create({ ...parseSession(req.body, 0), event_id: e._id });
  await recalcEvent(e._id);
  res.status(201).json({ success: true, sessionId: s._id });
});

exports.updateSession = ah(async (req, res) => {
  const { session, event } = await ownSession(req, req.params.sessionId);
  if (event.status !== "DRAFT") throw httpError("Chỉ sửa suất diễn khi sự kiện ở DRAFT", 409);
  const b = req.body || {};
  // Đổi giờ bắt đầu mà không gửi giờ kết thúc: dời giờ kết thúc theo, giữ nguyên thời lượng cũ
  let endTime = b.endTime ?? session.end_time;
  if (b.startTime !== undefined && b.endTime === undefined) {
    const newStart = date(b.startTime, "thời gian bắt đầu");
    endTime = new Date(newStart.getTime() + (session.end_time - session.start_time));
  }
  const merged = parseSession({ name: b.name ?? session.name, startTime: b.startTime ?? session.start_time, endTime });
  await EventSession.updateOne({ _id: session._id }, { $set: merged });
  await recalcEvent(event._id);
  res.json({ success: true, message: "Đã cập nhật suất diễn" });
});

exports.deleteSession = ah(async (req, res) => {
  const { session, event } = await ownSession(req, req.params.sessionId);
  if (event.status !== "DRAFT") throw httpError("Chỉ xoá suất diễn khi sự kiện ở DRAFT", 409);
  if ((await EventSession.countDocuments({ event_id: event._id })) <= 1) throw httpError("Sự kiện phải còn ít nhất 1 suất diễn", 409);
  if (await Order.countDocuments({ session_id: session._id })) throw httpError("Suất diễn đã có đơn hàng, không xoá được", 409);
  await Seat.deleteMany({ session_id: session._id });
  await TicketTier.deleteMany({ session_id: session._id });
  await EventSession.deleteOne({ _id: session._id });
  await recalcEvent(event._id);
  res.json({ success: true, message: "Đã xoá suất diễn" });
});

// ------------------------------------------------------------------ UC25: hạng vé
exports.addTier = ah(async (req, res) => {
  const { session, event } = await ownSession(req, req.params.sessionId);
  assertSelling(event);
  if ((await TicketTier.countDocuments({ session_id: session._id })) >= 50) throw httpError("Tối đa 50 hạng vé mỗi suất", 400);
  const tier = await TicketTier.create({ ...parseTier(req.body, session.start_time), event_id: event._id, session_id: session._id });
  await recalcEvent(event._id);
  await audit(req, "TIER_CREATE", "ticket_tiers", tier._id, { eventId: event._id });
  res.status(201).json({ success: true, tier: tierToClient(tier) });
});

exports.updateTier = ah(async (req, res) => {
  const { tier, event } = await ownTier(req, req.params.tierId);
  assertSelling(event);
  const session = await EventSession.findById(tier.session_id);
  const b = req.body || {};
  const set = {};
  if (b.name !== undefined) set.name = str(b.name, 150, "tên hạng vé");
  if (b.price !== undefined) set.price = num(b.price, 0, 100_000_000, "giá");
  if (b.description !== undefined) set.description = str(b.description, 500, "mô tả", { required: false }) || "";
  if (b.zoneColor !== undefined) {
    if (!COLOR.test(b.zoneColor)) throw httpError("zoneColor phải dạng #RRGGBB", 400);
    set.zone_color = b.zoneColor;
  }
  if (b.zoneType !== undefined || b.zone_type !== undefined) {
    const rawZoneType = String(b.zoneType ?? b.zone_type).toUpperCase();
    if (!["GA", "SEATED"].includes(rawZoneType)) throw httpError("zoneType phải là GA hoặc SEATED", 400);
    set.zone_type = rawZoneType;
  }
  const min = b.minPerOrder !== undefined ? intIn(b.minPerOrder, 1, 100, "minPerOrder") : tier.min_per_order;
  const max = b.maxPerOrder !== undefined ? intIn(b.maxPerOrder, 1, 100, "maxPerOrder") : tier.max_per_order;
  if (min > max) throw httpError("minPerOrder không được lớn hơn maxPerOrder", 400);
  set.min_per_order = min;
  set.max_per_order = max;
  const from = b.saleStartTime !== undefined ? date(b.saleStartTime, "giờ mở bán") : tier.sale_start_time;
  const to = b.saleEndTime !== undefined ? date(b.saleEndTime, "giờ đóng bán") : tier.sale_end_time;
  if (to <= from) throw httpError("Giờ đóng bán phải sau giờ mở bán", 400);
  set.sale_start_time = from;
  set.sale_end_time = to;

  if (b.totalQuantity !== undefined) {
    if (tier.zone_type === "SEATED") throw httpError("Hạng vé bán theo ghế: số lượng bằng số ghế, do Admin dựng sơ đồ (SVG + Excel) quyết định, không sửa tay được", 400);
    const n = intIn(b.totalQuantity, 1, 100000, "totalQuantity");
    // Nguyên tử: chỉ cho giảm tới mức đã bán + đang giữ chỗ
    const q = await TicketTier.findOneAndUpdate(
      { _id: tier._id, $expr: { $lte: [{ $subtract: ["$total_quantity", "$available_quantity"] }, n] } },
      [{ $set: { total_quantity: n, available_quantity: { $subtract: [n, { $subtract: ["$total_quantity", "$available_quantity"] }] } } }],
      { new: true },
    );
    if (!q) throw httpError(`Không giảm xuống ${n}: đã bán / đang giữ ${usedOf(tier)} vé`, 409);
  }
  await TicketTier.updateOne({ _id: tier._id }, { $set: set });
  await recalcEvent(event._id);
  await audit(req, "TIER_UPDATE", "ticket_tiers", tier._id, { fields: Object.keys(b), session: session?._id });
  res.json({ success: true, tier: tierToClient(await TicketTier.findById(tier._id)) });
});

exports.deleteTier = ah(async (req, res) => {
  const { tier, event } = await ownTier(req, req.params.tierId);
  assertSelling(event);
  if (usedOf(tier) > 0) throw httpError(`Hạng vé đã bán hoặc đang được giữ ${usedOf(tier)} vé, không xoá được`, 409);
  if (await Seat.countDocuments({ tier_id: tier._id, status: { $ne: "AVAILABLE" } })) throw httpError("Hạng vé có ghế đang được giữ / đã bán", 409);
  if (event.status !== "DRAFT" && (await TicketTier.countDocuments({ event_id: event._id })) <= 1) {
    throw httpError("Sự kiện đã duyệt phải còn ít nhất 1 hạng vé", 409);
  }
  await Seat.deleteMany({ tier_id: tier._id });
  await TicketTier.deleteOne({ _id: tier._id });
  await recalcEvent(event._id);
  await audit(req, "TIER_DELETE", "ticket_tiers", tier._id);
  res.json({ success: true, message: "Đã xoá hạng vé" });
});

// ------------------------------------------------------------------ UC26: custom form
// PUT /v1/organizer/events/:id/custom-form
exports.updateCustomForm = ah(async (req, res) => {
  const e = await ownEvent(req, req.params.id);
  const questions = req.body.attendeeFormSchema || req.body.customFormSchema || req.body.questions || (Array.isArray(req.body) ? req.body : []);
  const parsed = parseForm(questions);
  if (!parsed) throw httpError("Cấu trúc biểu mẫu tuỳ chỉnh không hợp lệ", 400);

  e.custom_form_schema = parsed;
  await e.save();
  await audit(req, "EVENT_CUSTOM_FORM_UPDATE", "events", e._id, { questionCount: parsed.length });

  res.json({
    success: true,
    message: "Đã lưu biểu mẫu thông tin người tham dự",
    customFormSchema: parsed,
    attendeeFormSchema: parsed,
  });
});

// ------------------------------------------------------------------ UC29: orders & attendees
// GET /v1/organizer/events/:id/orders
exports.getEventOrders = ah(async (req, res) => {
  const e = await ownEvent(req, req.params.id);
  const { status, search, page = 1, limit = 20 } = req.query;

  const query = { event_id: e._id };
  if (status) query.status = status;
  if (search) {
    const rx = { $regex: String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    query.$or = [{ order_code: rx }];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [total, orders] = await Promise.all([
    Order.countDocuments(query),
    Order.find(query)
      .populate("buyer_id", "full_name username email phone")
      .populate("session_id", "name start_time")
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limitNum),
  ]);

  res.json({
    success: true,
    orders: orders.map((o) => ({
      id: o._id,
      orderCode: o.order_code,
      buyer: {
        id: o.buyer_id?._id,
        name: o.buyer_id?.full_name || o.buyer_id?.username,
        email: o.buyer_id?.email,
        phone: o.buyer_id?.phone,
      },
      session: o.session_id,
      items: o.items_snapshot,
      subtotalAmount: o.subtotal_amount,
      discountAmount: o.discount_amount,
      totalAmount: o.total_amount,
      status: o.status,
      attendeeFormAnswers: o.attendee_form_answers,
      vatInvoiceInfo: o.vat_invoice_info,
      createdAt: o.created_at,
    })),
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

// GET /v1/organizer/events/:id/attendees
exports.getEventAttendees = ah(async (req, res) => {
  const e = await ownEvent(req, req.params.id);
  const { status, search, sessionId, tierId, page = 1, limit = 50 } = req.query;

  const query = { event_id: e._id };
  if (status) query.status = status;
  if (sessionId) query.session_id = sessionId;
  if (tierId) query.tier_id = tierId;
  if (search) {
    const rx = { $regex: String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    query.ticket_code = rx;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [total, tickets] = await Promise.all([
    Ticket.countDocuments(query),
    Ticket.find(query)
      .populate("owner_id", "full_name username email phone")
      .populate("tier_id", "name price")
      .populate("seat_id", "section_name row_label seat_number")
      .populate("session_id", "name start_time")
      .populate("order_id", "order_code attendee_form_answers vat_invoice_info")
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limitNum),
  ]);

  res.json({
    success: true,
    attendees: tickets.map((t) => ({
      ticketId: t._id,
      ticketCode: t.ticket_code,
      owner: {
        id: t.owner_id?._id,
        name: t.owner_id?.full_name || t.owner_id?.username,
        email: t.owner_id?.email,
        phone: t.owner_id?.phone,
      },
      tierName: t.tier_id?.name,
      price: t.tier_id?.price,
      seat: t.seat_id ? `${t.seat_id.section_name}-${t.seat_id.row_label}${t.seat_id.seat_number}` : "GA",
      sessionName: t.session_id?.name,
      status: t.status,
      checkedInAt: t.checked_in_at,
      orderCode: t.order_id?.order_code,
      attendeeFormAnswers: t.order_id?.attendee_form_answers,
      vatInvoiceInfo: t.order_id?.vat_invoice_info,
    })),
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

// ------------------------------------------------------------------ UC30: staff management
// GET /v1/organizer/events/:id/staff
exports.listStaff = ah(async (req, res) => {
  const e = await ownEvent(req, req.params.id);
  const assignments = await StaffAssignment.find({ event_id: e._id })
    .populate("staff_user_id", "full_name username email phone avatar_url")
    .sort({ created_at: -1 });

  const mapped = assignments.map((a) => ({
    assignmentId: a._id,
    assignedGate: a.assigned_gate,
    isActive: a.is_active,
    staffUser: {
      id: a.staff_user_id?._id,
      name: a.staff_user_id?.full_name || a.staff_user_id?.username,
      username: a.staff_user_id?.username,
      email: a.staff_user_id?.email,
      phone: a.staff_user_id?.phone,
      avatarUrl: a.staff_user_id?.avatar_url,
    },
    createdAt: a.created_at,
  }));

  res.json({
    success: true,
    staff: mapped,
    staffList: mapped,
  });
});

// POST /v1/organizer/events/:id/staff
exports.addStaff = ah(async (req, res) => {
  const e = await ownEvent(req, req.params.id);
  const { email, username, staffUserId, assignedGate = "Cổng chính" } = req.body;
  if (!email && !username && !staffUserId) throw httpError("Cần cung cấp email, username hoặc ID của nhân viên", 400);

  const query = {};
  if (staffUserId) query._id = staffUserId;
  else if (email) query.email = String(email).trim().toLowerCase();
  else query.username = String(username).trim();

  let user = await User.findOne(query);
  if (!user) throw httpError("Không tìm thấy người dùng với thông tin này", 404);

  if (user.role === "CUSTOMER") {
    user.role = "STAFF";
    await user.save();
  }

  const existing = await StaffAssignment.findOne({ event_id: e._id, staff_user_id: user._id });
  if (existing) {
    if (!existing.is_active) {
      existing.is_active = true;
      existing.assigned_gate = assignedGate;
      await existing.save();
      return res.json({
        success: true,
        message: "Đã kích hoạt lại nhân viên soát vé",
        assignmentId: existing._id,
        assignment: { id: existing._id, assigned_gate: existing.assigned_gate, isActive: existing.is_active },
      });
    }
    throw httpError("Nhân viên này đã được phân công vào sự kiện", 409);
  }

  const assignment = await StaffAssignment.create({
    event_id: e._id,
    organizer_id: req.user.id,
    staff_user_id: user._id,
    assigned_gate: assignedGate,
    is_active: true,
  });

  await audit(req, "STAFF_ASSIGN", "staff_assignments", assignment._id, { eventId: e._id, staffId: user._id });

  res.status(201).json({
    success: true,
    message: "Đã phân công nhân viên soát vé thành công",
    assignmentId: assignment._id,
    assignment: {
      id: assignment._id,
      assigned_gate: assignment.assigned_gate,
      isActive: assignment.is_active,
    },
    staff: {
      id: user._id,
      name: user.full_name || user.username,
      email: user.email,
      assignedGate,
    },
  });
});

// PUT /v1/organizer/staff-assignments/:assignmentId
exports.updateStaffAssignment = ah(async (req, res) => {
  const assignment = await StaffAssignment.findById(req.params.assignmentId).populate("event_id");
  if (!assignment) throw httpError("Không tìm thấy phân công nhân viên", 404);
  if (String(assignment.event_id?.organizer_id) !== String(req.user.id)) {
    throw httpError("Không có quyền chỉnh sửa phân công của sự kiện này", 403);
  }

  const { assignedGate, isActive } = req.body;
  if (assignedGate !== undefined) assignment.assigned_gate = String(assignedGate).trim();
  if (isActive !== undefined) assignment.is_active = Boolean(isActive);

  await assignment.save();
  await audit(req, "STAFF_ASSIGNMENT_UPDATE", "staff_assignments", assignment._id, { assignedGate, isActive });

  res.json({ success: true, message: "Đã cập nhật phân công nhân viên", assignment });
});

// DELETE /v1/organizer/staff-assignments/:assignmentId
exports.removeStaffAssignment = ah(async (req, res) => {
  const assignment = await StaffAssignment.findById(req.params.assignmentId).populate("event_id");
  if (!assignment) throw httpError("Không tìm thấy phân công nhân viên", 404);
  if (String(assignment.event_id?.organizer_id) !== String(req.user.id)) {
    throw httpError("Không có quyền xoá phân công của sự kiện này", 403);
  }

  await StaffAssignment.deleteOne({ _id: assignment._id });
  await audit(req, "STAFF_ASSIGNMENT_DELETE", "staff_assignments", assignment._id);

  res.json({ success: true, message: "Đã xoá nhân viên khỏi sự kiện" });
});

// ------------------------------------------------------------------ UC31: organizer dashboard
// GET /v1/organizer/dashboard
exports.getDashboard = ah(async (req, res) => {
  const orgEvents = await Event.find({ organizer_id: req.user.id });
  const eventIds = orgEvents.map((e) => e._id);

  const [paidOrders, totalTicketsSold, checkedInTickets] = await Promise.all([
    Order.find({ event_id: { $in: eventIds }, status: "PAID" }),
    Ticket.countDocuments({ event_id: { $in: eventIds }, status: { $in: ["VALID", "USED"] } }),
    Ticket.countDocuments({ event_id: { $in: eventIds }, status: "USED" }),
  ]);

  const totalGrossRevenue = paidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const eventCounts = {
    total: orgEvents.length,
    draft: orgEvents.filter((e) => e.status === "DRAFT").length,
    pending: orgEvents.filter((e) => e.status === "PENDING").length,
    approved: orgEvents.filter((e) => e.status === "APPROVED").length,
    published: orgEvents.filter((e) => e.status === "PUBLISHED").length,
    ended: orgEvents.filter((e) => e.status === "ENDED").length,
    cancelled: orgEvents.filter((e) => e.status === "CANCELLED").length,
  };

  const upcomingEvents = orgEvents
    .filter((e) => ["APPROVED", "PUBLISHED"].includes(e.status) && (!e.start_time || e.start_time >= new Date()))
    .slice(0, 5)
    .map((e) => ({
      id: e._id,
      title: e.title,
      bannerUrl: e.banner_url,
      startTime: e.start_time,
      status: e.status,
    }));

  const [recentOrders] = await Promise.all([
    Order.find({ event_id: { $in: eventIds } })
      .sort({ created_at: -1 })
      .limit(10)
      .populate("buyer_id", "full_name username")
      .populate("event_id", "title"),
  ]);

  res.json({
    success: true,
    stats: {
      totalEvents: eventCounts.total,
      eventCounts,
      totalTicketsSold,
      checkedInTickets,
      checkInRatePct: totalTicketsSold > 0 ? Math.round((checkedInTickets / totalTicketsSold) * 1000) / 10 : 0,
      totalGrossRevenue,
    },
    summary: {
      totalRevenue: totalGrossRevenue,
      totalEvents: eventCounts.total,
      totalTicketsSold,
      checkedInTickets,
    },
    recentOrders: recentOrders.map((o) => ({
      orderId: o._id,
      orderCode: o.order_code,
      totalAmount: o.total_amount,
      status: o.status,
      buyerName: o.buyer_id?.full_name || o.buyer_id?.username,
      eventTitle: o.event_id?.title,
      createdAt: o.created_at,
    })),
    upcomingEvents,
  });
});

// ------------------------------------------------------------------ UC32: event analytics
// GET /v1/organizer/events/:id/analytics
exports.getEventAnalytics = ah(async (req, res) => {
  const e = await ownEvent(req, req.params.id);
  const [sessions, tiers, paidOrders, contract, checkedInCount, totalTicketsSold] = await Promise.all([
    EventSession.find({ event_id: e._id }),
    TicketTier.find({ event_id: e._id }),
    Order.find({ event_id: e._id, status: "PAID" }),
    EContract.findOne({ event_id: e._id, status: { $in: ["WAITING_SIGN", "SIGNED"] } }),
    Ticket.countDocuments({ event_id: e._id, status: "USED" }),
    Ticket.countDocuments({ event_id: e._id, status: { $in: ["VALID", "USED"] } }),
  ]);

  const grossRevenue = paidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const totalDiscount = paidOrders.reduce((sum, o) => sum + (o.discount_amount || 0), 0);

  const commissionRatePct = contract ? (contract.commission_rate_pct ?? contract.platform_commission_pct ?? 10) : 10;
  const platformCommissionAmt = Math.round((grossRevenue * commissionRatePct) / 100);
  const netEarnings = Math.max(0, grossRevenue - platformCommissionAmt);

  const sessionAnalytics = sessions.map((s) => {
    const sOrders = paidOrders.filter((o) => String(o.session_id) === String(s._id));
    const sRevenue = sOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    return {
      sessionId: s._id,
      sessionName: s.name,
      startTime: s.start_time,
      ordersCount: sOrders.length,
      revenue: sRevenue,
    };
  });

  const tierAnalytics = tiers.map((t) => {
    const sold = t.total_quantity - t.available_quantity;
    return {
      tierId: t._id,
      tierName: t.name,
      price: t.price,
      totalQuantity: t.total_quantity,
      soldQuantity: Math.max(0, sold),
      availableQuantity: t.available_quantity,
      revenue: Math.max(0, sold) * t.price,
    };
  });

  const finSummary = {
    grossRevenue,
    platformCommission: platformCommissionAmt,
    commissionRatePct,
    estimatedNetPayout: netEarnings,
  };

  res.json({
    success: true,
    analytics: {
      eventId: e._id,
      title: e.title,
      grossRevenue,
      totalDiscount,
      commissionRatePct,
      platformCommissionAmt,
      netEarnings,
      totalTicketsSold,
      checkedInCount,
      checkInRatePct: totalTicketsSold > 0 ? Math.round((checkedInCount / totalTicketsSold) * 1000) / 10 : 0,
      sessionAnalytics,
      tierAnalytics,
      tierBreakdown: tierAnalytics,
      financialSummary: finSummary,
    },
    tierBreakdown: tierAnalytics,
    financialSummary: finSummary,
  });
});

// ------------------------------------------------------------------ UC33: data export (Excel)
// GET /v1/organizer/events/:id/export/attendees
exports.exportAttendees = ah(async (req, res) => {
  const e = await ownEvent(req, req.params.id);
  const tickets = await Ticket.find({ event_id: e._id })
    .populate("owner_id", "full_name username email phone")
    .populate("tier_id", "name price")
    .populate("seat_id", "section_name row_label seat_number")
    .populate("session_id", "name")
    .sort({ created_at: -1 });

  const statusMap = {
    VALID: "Hợp lệ",
    USED: "Đã soát vé",
    LISTED_RESALE: "Đang bán lại",
    RESOLD_INVALID: "Đã sang nhượng",
    REFUNDED: "Đã hoàn tiền",
  };

  const dataRows = tickets.map((t, index) => [
    index + 1,
    t.owner_id?.full_name || t.owner_id?.username || "—",
    t.owner_id?.phone || "—",
    t.owner_id?.email || "—",
    t.tier_id?.name || "—",
    t.seat_id ? `${t.seat_id.section_name}-${t.seat_id.row_label}${t.seat_id.seat_number}` : "GA",
    t.ticket_code,
    t.session_id?.name || "—",
    statusMap[t.status] || t.status,
    t.checked_in_at ? new Date(t.checked_in_at).toLocaleString("vi-VN") : "—",
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "EventTick";
  wb.created = new Date();
  const ws = wb.addWorksheet("Nguoi_tham_du");

  ws.columns = [
    { header: "STT", key: "stt", width: 8 },
    { header: "H\u1ECD v\u00E0 t\u00EAn", key: "name", width: 25 },
    { header: "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i", key: "phone", width: 16 },
    { header: "Email", key: "email", width: 28 },
    { header: "H\u1EA1ng v\u00E9", key: "tier", width: 18 },
    { header: "V\u1ECB tr\u00ED gh\u1EBF", key: "seat", width: 14 },
    { header: "M\u00E3 v\u00E9", key: "code", width: 28 },
    { header: "Su\u1EA5t di\u1EC5n", key: "session", width: 22 },
    { header: "Tr\u1EA1ng th\u00E1i", key: "status", width: 16 },
    { header: "Th\u1EDDi gian so\u00E1t v\u00E9", key: "checkedIn", width: 22 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF18181B" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  dataRows.forEach((row) => {
    const r = ws.addRow(row);
    r.height = 22;
    r.alignment = { vertical: "middle" };
    r.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
    r.getCell(6).alignment = { vertical: "middle", horizontal: "center" };
    r.getCell(9).alignment = { vertical: "middle", horizontal: "center" };
  });

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="attendees-${e._id}.xlsx"`);
  res.send(buffer);
});

// GET /v1/organizer/events/:id/export/orders
exports.exportOrders = ah(async (req, res) => {
  const e = await ownEvent(req, req.params.id);
  const orders = await Order.find({ event_id: e._id })
    .populate("buyer_id", "full_name username email phone")
    .populate("session_id", "name")
    .sort({ created_at: -1 });

  const statusMap = {
    PAID: "Đã thanh toán",
    PENDING_PAYMENT: "Chờ thanh toán",
    EXPIRED: "Hết hạn",
    CANCELLED: "Đã huỷ",
    REFUNDED: "Đã hoàn tiền",
  };

  const dataRows = orders.map((o, index) => [
    index + 1,
    o.order_code,
    o.buyer_id?.full_name || o.buyer_id?.username || "—",
    o.buyer_id?.phone || "—",
    o.buyer_id?.email || "—",
    o.session_id?.name || "—",
    o.subtotal_amount || 0,
    o.discount_amount || 0,
    o.total_amount || 0,
    statusMap[o.status] || o.status,
    o.created_at ? new Date(o.created_at).toLocaleString("vi-VN") : "—",
    o.vat_invoice_info?.company_name || "—",
    o.vat_invoice_info?.tax_code || "—",
    o.vat_invoice_info?.company_address || "—",
    o.vat_invoice_info?.invoice_email || "—",
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "EventTick";
  wb.created = new Date();
  const ws = wb.addWorksheet("Don_hang");

  ws.columns = [
    { header: "STT", key: "stt", width: 8 },
    { header: "M\u00E3 \u0111\u01A1n", key: "orderCode", width: 26 },
    { header: "H\u1ECD t\u00EAn kh\u00E1ch", key: "buyerName", width: 24 },
    { header: "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i", key: "phone", width: 16 },
    { header: "Email", key: "email", width: 28 },
    { header: "Su\u1EA5t di\u1EC5n", key: "session", width: 22 },
    { header: "T\u1ED5ng ti\u1EC1n (\u0111)", key: "subtotal", width: 16 },
    { header: "Gi\u1EA3m gi\u00E1 (\u0111)", key: "discount", width: 16 },
    { header: "Th\u1EF1c thu (\u0111)", key: "total", width: 16 },
    { header: "Tr\u1EA1ng th\u00E1i", key: "status", width: 16 },
    { header: "Ng\u00E0y t\u1EA1o", key: "createdAt", width: 22 },
    { header: "C\u00F4ng ty xu\u1EA5t VAT", key: "vatCompany", width: 30 },
    { header: "MST VAT", key: "vatTax", width: 16 },
    { header: "\u0110\u1ECBa ch\u1EC9 VAT", key: "vatAddress", width: 35 },
    { header: "Email nh\u1EADn VAT", key: "vatEmail", width: 26 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF18181B" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  dataRows.forEach((row) => {
    const r = ws.addRow(row);
    r.height = 22;
    r.alignment = { vertical: "middle" };
    r.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
    r.getCell(7).numFmt = "#,##0";
    r.getCell(8).numFmt = "#,##0";
    r.getCell(9).numFmt = "#,##0";
    r.getCell(10).alignment = { vertical: "middle", horizontal: "center" };
  });

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="orders-${e._id}.xlsx"`);
  res.send(buffer);
});

// ------------------------------------------------------------------ UC34: payout settlement
// GET /v1/organizer/events/:id/payout-summary
exports.getPayoutSummary = ah(async (req, res) => {
  const e = await ownEvent(req, req.params.id);
  const [paidOrders, contract, profile, existingSettlement] = await Promise.all([
    Order.find({ event_id: e._id, status: "PAID" }),
    EContract.findOne({ event_id: e._id, status: "SIGNED" }),
    OrganizerProfile.findOne({ user_id: req.user.id }),
    PayoutSettlement.findOne({ event_id: e._id }),
  ]);

  const grossRevenue = paidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const commissionRatePct = contract ? (contract.commission_rate_pct ?? contract.platform_commission_pct ?? 10) : 10;
  const platformCommissionAmt = Math.round((grossRevenue * commissionRatePct) / 100);
  const netPayoutAmount = Math.max(0, grossRevenue - platformCommissionAmt);

  const payoutData = {
    eventId: e._id,
    title: e.title,
    grossRevenue,
    commissionRatePct,
    platformCommissionAmt,
    netPayoutAmount,
    bankAccount: profile?.bank_account_info || null,
    existingSettlement: existingSettlement
      ? {
          id: existingSettlement._id,
          status: existingSettlement.status,
          rejectionReason: existingSettlement.rejection_reason,
          netPayoutAmount: existingSettlement.net_payout_amount,
          settledAt: existingSettlement.settled_at,
        }
      : null,
  };

  res.json({
    success: true,
    payoutSummary: payoutData,
    summary: payoutData,
  });
});

// POST /v1/organizer/events/:id/payout/request
exports.requestPayout = ah(async (req, res) => {
  const e = await ownEvent(req, req.params.id);

  const existingSettlement = await PayoutSettlement.findOne({ event_id: e._id });
  // Yêu cầu bị Admin từ chối thì được gửi lại (cập nhật bản ghi cũ vì mỗi sự kiện chỉ có một yêu cầu)
  if (existingSettlement && existingSettlement.status !== "REJECTED") {
    throw httpError(`Sự kiện này đã có yêu cầu đối soát ở trạng thái ${existingSettlement.status}`, 409);
  }

  const contract = await EContract.findOne({ event_id: e._id, status: "SIGNED" });
  if (!contract) throw httpError("Sự kiện chưa có hợp đồng đã ký, chưa thể yêu cầu đối soát", 409);

  const paidOrders = await Order.find({ event_id: e._id, status: "PAID" });
  const grossRevenue = paidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const commissionRatePct = contract.commission_rate_pct ?? contract.platform_commission_pct ?? 10;
  const platformCommissionAmt = Math.round((grossRevenue * commissionRatePct) / 100);
  const netPayoutAmount = Math.max(0, grossRevenue - platformCommissionAmt);

  const payoutData = {
    organizer_id: req.user.id,
    contract_id: contract._id,
    gross_revenue: grossRevenue,
    total_refunded: 0,
    platform_commission_amt: platformCommissionAmt,
    net_payout_amount: netPayoutAmount,
    status: "REQUESTED",
  };
  let settlement;
  if (existingSettlement) {
    settlement = await PayoutSettlement.findOneAndUpdate(
      { _id: existingSettlement._id, status: "REJECTED" },
      { ...payoutData, $unset: { rejection_reason: 1, rejected_by_admin: 1 } },
      { new: true },
    );
    if (!settlement) throw httpError("Yêu cầu đối soát vừa thay đổi, hãy tải lại", 409);
  } else {
    settlement = await PayoutSettlement.create({ event_id: e._id, ...payoutData });
  }

  await audit(req, "PAYOUT_REQUEST_CREATE", "payout_settlements", settlement._id, {
    eventId: e._id,
    netPayoutAmount,
  });
  notifyAdmins({ type: "PAYOUT_REQUESTED", title: "Yêu cầu đối soát mới", body: `"${e.title}" yêu cầu đối soát ${netPayoutAmount.toLocaleString("vi-VN")} ₫.`, link: "/admin/payouts" });

  res.status(201).json({
    success: true,
    message: "Đã gửi yêu cầu đối soát và rút tiền thành công!",
    settlementId: settlement._id,
    netPayoutAmount,
    status: settlement.status,
  });
});

// GET /v1/organizer/payouts
exports.listPayouts = ah(async (req, res) => {
  const settlements = await PayoutSettlement.find({ organizer_id: req.user.id })
    .populate("event_id", "title banner_url")
    .sort({ created_at: -1 });

  res.json({
    success: true,
    payouts: settlements.map((s) => ({
      id: s._id,
      eventId: s.event_id?._id,
      eventTitle: s.event_id?.title,
      grossRevenue: s.gross_revenue,
      platformCommissionAmt: s.platform_commission_amt,
      netPayoutAmount: s.net_payout_amount,
      status: s.status,
      rejectionReason: s.rejection_reason,
      bankTransferReceiptUrl: s.bank_transfer_receipt_url,
      settledAt: s.settled_at,
      createdAt: s.created_at,
    })),
  });
});

exports._helpers = { ownEvent, ownSession, ownTier, assertSelling, recalcEvent, tierToClient, usedOf, num, bool, COLOR, SELLING };
