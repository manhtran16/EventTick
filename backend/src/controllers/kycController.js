const { User, OrganizerProfile } = require("../models");
const { savePrivate, sendPrivate } = require("../services/privateStorage");
const { sniff, resourceTypeOf } = require("../utils/fileType");
const { httpError, validId, ah, str } = require("../utils/http");
const { audit } = require("../utils/audit");
const { notify, notifyAdmins } = require("../services/notificationService");

const ALLOWED_DOC = ["jpeg", "png", "webp", "pdf"];

/** Không bao giờ trả ref nội bộ của giấy tờ ra ngoài; chỉ báo có/không. */
function profileToClient(p, { withOwner = false } = {}) {
  const o = p.toObject ? p.toObject() : p;
  const out = {
    _id: o._id,
    userId: o.user_id?._id || o.user_id,
    organizationName: o.organization_name,
    businessType: o.business_type,
    taxCode: o.tax_code,
    phone: o.user_id?.phone,
    bankName: o.bank_name,
    bankAccountNo: o.bank_account_no,
    bankAccountHolder: o.bank_account_holder,
    hasDocument: Boolean(o.id_card_or_license_url),
    kycStatus: o.kyc_status,
    rejectionReason: o.rejection_reason,
    submittedAt: o.submitted_at,
    verifiedAt: o.verified_at,
  };
  if (withOwner && o.user_id?.email) {
    out.owner = { id: o.user_id._id, email: o.user_id.email, fullName: o.user_id.full_name, phone: o.user_id.phone };
  }
  return out;
}

// ---------------------------------------------------------------- Organizer (UC21)

// POST /v1/organizer/kyc   multipart/form-data: document (file) + các field văn bản
exports.submit = ah(async (req, res) => {
  const user = await User.findById(req.user.id).select("role status");
  if (!user || user.status === "BLOCKED") throw httpError("Tài khoản không khả dụng", 403);
  if (!["CUSTOMER", "ORGANIZER"].includes(user.role)) {
    throw httpError("Tài khoản này không thể đăng ký làm Nhà tổ chức", 403);
  }

  const b = req.body || {};
  const data = {
    organization_name: str(b.organizationName, 255, "tên đơn vị tổ chức"),
    business_type: String(b.businessType || "").toUpperCase(),
    tax_code: str(b.taxCode, 50, "mã số thuế"),
    phone: str(b.phone, 20, "số điện thoại"),
    bank_name: str(b.bankName, 100, "tên ngân hàng"),
    bank_account_no: str(b.bankAccountNo, 50, "số tài khoản"),
    bank_account_holder: str(b.bankAccountHolder, 150, "tên chủ tài khoản"),
  };
  if (!["INDIVIDUAL", "ENTERPRISE"].includes(data.business_type)) {
    throw httpError("businessType phải là INDIVIDUAL hoặc ENTERPRISE", 400);
  }
  // MST Việt Nam: 10 số (doanh nghiệp / cá nhân) hoặc 13 số dạng 10 số-3 số (chi nhánh)
  if (!/^\d{10}(-?\d{3})?$/.test(data.tax_code)) throw httpError("Mã số thuế phải gồm 10 hoặc 13 chữ số", 400);
  if (!/^[0-9+\s]{8,15}$/.test(data.phone)) throw httpError("Số điện thoại không hợp lệ", 400);
  if (!/^\d{6,20}$/.test(data.bank_account_no)) throw httpError("Số tài khoản chỉ gồm 6–20 chữ số", 400);

  const file = req.file;
  const existing = await OrganizerProfile.findOne({ user_id: user._id });
  if (existing?.kyc_status === "PENDING") throw httpError("Hồ sơ đang chờ duyệt, không thể gửi lại", 409);
  if (existing?.kyc_status === "VERIFIED") throw httpError("Hồ sơ đã được duyệt", 409);
  if (!file && !existing) throw httpError("Thiếu tệp giấy tờ (field document: CCCD hoặc giấy phép ĐKKD)", 400);

  let docRef = existing?.id_card_or_license_url;
  if (file) {
    const kind = sniff(file.buffer);
    if (!kind || !ALLOWED_DOC.includes(kind)) throw httpError("Giấy tờ phải là ảnh JPG/PNG/WEBP hoặc PDF", 400);
    docRef = await savePrivate(file.buffer, {
      filename: file.originalname,
      folder: "eventtick_kyc",
      resourceType: resourceTypeOf(kind),
    });
  }
  const payload = { ...data, id_card_or_license_url: docRef, kyc_status: "PENDING", submitted_at: new Date() };
  let profile;
  if (existing) {
    // Gửi lại sau khi bị từ chối
    existing.set(payload);
    existing.set("rejection_reason", undefined);
    existing.set("verified_by", undefined);
    existing.set("verified_at", undefined);
    profile = await existing.save();
  } else {
    profile = await OrganizerProfile.create({ user_id: user._id, ...payload });
  }
  await User.updateOne({ _id: user._id }, { $set: { phone: data.phone } });

  await audit(req, "KYC_SUBMIT", "organizer_profiles", profile._id);
  notifyAdmins({ type: "KYC_SUBMITTED", title: "Hồ sơ KYC mới chờ duyệt", body: `${profile.organization_name} vừa gửi hồ sơ xác minh nhà tổ chức.`, link: "/admin/kyc" });
  res.status(201).json({
    success: true,
    message: "Đã gửi hồ sơ KYC, vui lòng chờ Admin duyệt.",
    profile: profileToClient(profile),
  });
});

// GET /v1/organizer/kyc — xem trạng thái hồ sơ của chính mình
exports.mine = ah(async (req, res) => {
  const profile = await OrganizerProfile.findOne({ user_id: req.user.id }).populate("user_id", "phone");
  res.json({ success: true, profile: profile ? profileToClient(profile) : null });
});

// GET /v1/organizer/kyc/document — chính chủ xem lại giấy tờ của mình
exports.myDocument = ah(async (req, res) => {
  const profile = await OrganizerProfile.findOne({ user_id: req.user.id });
  if (!profile) throw httpError("Chưa có hồ sơ KYC", 404);
  return sendPrivate(res, profile.id_card_or_license_url);
});

// ---------------------------------------------------------------- Admin (UC38)

// GET /v1/admin/kyc?status=PENDING&page=1&limit=20
exports.list = ah(async (req, res) => {
  const filter = {};
  if (req.query.status) {
    const st = String(req.query.status).toUpperCase();
    if (!["PENDING", "VERIFIED", "REJECTED"].includes(st)) throw httpError("status không hợp lệ", 400);
    filter.kyc_status = st;
  }
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const [items, total] = await Promise.all([
    OrganizerProfile.find(filter)
      .populate("user_id", "email full_name phone")
      .sort({ submitted_at: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    OrganizerProfile.countDocuments(filter),
  ]);
  res.json({ success: true, page, limit, total, items: items.map((p) => profileToClient(p, { withOwner: true })) });
});

// GET /v1/admin/kyc/:id
exports.detail = ah(async (req, res) => {
  const profile = await OrganizerProfile.findById(validId(req.params.id, "ID hồ sơ")).populate("user_id", "email full_name phone");
  if (!profile) throw httpError("Không tìm thấy hồ sơ", 404);
  res.json({ success: true, profile: profileToClient(profile, { withOwner: true }) });
});

// GET /v1/admin/kyc/:id/document — Admin xem giấy tờ (link ký có hạn 5 phút, hoặc stream tệp local)
exports.document = ah(async (req, res) => {
  const profile = await OrganizerProfile.findById(validId(req.params.id, "ID hồ sơ"));
  if (!profile) throw httpError("Không tìm thấy hồ sơ", 404);
  await audit(req, "KYC_VIEW_DOCUMENT", "organizer_profiles", profile._id);
  return sendPrivate(res, profile.id_card_or_license_url);
});

// PUT /v1/admin/kyc/:id/approve — duyệt: kyc_status = VERIFIED, nâng role lên ORGANIZER
exports.approve = ah(async (req, res) => {
  const profile = await OrganizerProfile.findOneAndUpdate(
    { _id: validId(req.params.id, "ID hồ sơ"), kyc_status: "PENDING" },
    { kyc_status: "VERIFIED", verified_by: req.user.id, verified_at: new Date(), $unset: { rejection_reason: 1 } },
    { new: true },
  );
  if (!profile) {
    const exists = await OrganizerProfile.exists({ _id: req.params.id });
    throw httpError(exists ? "Hồ sơ không ở trạng thái chờ duyệt" : "Không tìm thấy hồ sơ", exists ? 409 : 404);
  }
  // Chỉ nâng CUSTOMER lên ORGANIZER; không hạ quyền ADMIN/STAFF
  await User.updateOne({ _id: profile.user_id, role: "CUSTOMER" }, { role: "ORGANIZER" });
  await audit(req, "KYC_APPROVE", "organizer_profiles", profile._id, { userId: profile.user_id });
  notify(profile.user_id, { type: "KYC_APPROVED", title: "Hồ sơ KYC đã được duyệt", body: "Bạn đã trở thành nhà tổ chức và có thể tạo sự kiện.", link: "/organizer/events" });
  res.json({ success: true, message: "Đã duyệt hồ sơ KYC", profile: profileToClient(profile) });
});

// PUT /v1/admin/kyc/:id/reject  { reason }
exports.reject = ah(async (req, res) => {
  const reason = str(req.body?.reason, 1000, "lý do từ chối");
  const profile = await OrganizerProfile.findOneAndUpdate(
    { _id: validId(req.params.id, "ID hồ sơ"), kyc_status: "PENDING" },
    { kyc_status: "REJECTED", rejection_reason: reason, verified_by: req.user.id, verified_at: new Date() },
    { new: true },
  );
  if (!profile) {
    const exists = await OrganizerProfile.exists({ _id: req.params.id });
    throw httpError(exists ? "Hồ sơ không ở trạng thái chờ duyệt" : "Không tìm thấy hồ sơ", exists ? 409 : 404);
  }
  await audit(req, "KYC_REJECT", "organizer_profiles", profile._id, { reason });
  notify(profile.user_id, { type: "KYC_REJECTED", title: "Hồ sơ KYC bị từ chối", body: `Lý do: ${reason}. Bạn có thể chỉnh sửa và gửi lại.`, link: "/organizer/kyc" });
  res.json({ success: true, message: "Đã từ chối hồ sơ KYC", profile: profileToClient(profile) });
});
