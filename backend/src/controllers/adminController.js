const {
  User,
  Category,
  Event,
  EventSession,
  TicketTier,
  Seat,
  Ticket,
  Order,
  Payment,
  PayoutSettlement,
  RefundRequest,
  ResaleListing,
  OrganizerProfile,
  EContract,
} = require("../models");
const bookingService = require("../services/bookingService");
const { httpError, validId, ah, str } = require("../utils/http");
const { audit } = require("../utils/audit");
const { notify } = require("../services/notificationService");

// =====================================================================
// UC37: QUẢN LÝ NGƯỜI DÙNG & RBAC
// =====================================================================

// GET /v1/admin/users
exports.listUsers = ah(async (req, res) => {
  const { role, status, search, page = 1, limit = 20 } = req.query;
  const query = {};

  if (role) query.role = String(role).toUpperCase();
  if (status) query.status = String(status).toUpperCase();
  if (search) {
    const rx = { $regex: String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    query.$or = [{ username: rx }, { email: rx }, { full_name: rx }, { phone: rx }];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [total, users] = await Promise.all([
    User.countDocuments(query),
    User.find(query).select("-password_hash").sort({ created_at: -1 }).skip(skip).limit(limitNum),
  ]);

  res.json({
    success: true,
    users: users.map((u) => ({
      id: u._id,
      username: u.username,
      email: u.email,
      fullName: u.full_name,
      phone: u.phone,
      role: u.role,
      status: u.status,
      avatarUrl: u.avatar_url,
      createdAt: u.created_at,
    })),
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

// PUT /v1/admin/users/:id/status
exports.updateUserStatus = ah(async (req, res) => {
  const userId = validId(req.params.id, "ID người dùng");
  if (String(userId) === String(req.user.id)) {
    throw httpError("Không thể tự khoá tài khoản quản trị của chính mình", 400);
  }

  const { status } = req.body;
  if (!["ACTIVE", "BLOCKED"].includes(status)) {
    throw httpError("Trạng thái người dùng phải là ACTIVE hoặc BLOCKED", 400);
  }

  const user = await User.findById(userId);
  if (!user) throw httpError("Không tìm thấy người dùng", 404);

  const oldStatus = user.status;
  user.status = status;
  await user.save();

  await audit(req, "USER_STATUS_CHANGE", "users", user._id, { from: oldStatus, to: status });

  res.json({
    success: true,
    message: `Đã cập nhật trạng thái người dùng thành ${status}`,
    user: { id: user._id, username: user.username, email: user.email, status: user.status },
  });
});

// PUT /v1/admin/users/:id/role
exports.updateUserRole = ah(async (req, res) => {
  const userId = validId(req.params.id, "ID người dùng");
  if (String(userId) === String(req.user.id)) {
    throw httpError("Không thể tự thay đổi vai trò quản trị của chính mình", 400);
  }

  const { role } = req.body;
  const ALLOWED_ROLES = ["CUSTOMER", "ORGANIZER", "STAFF", "ADMIN"];
  if (!ALLOWED_ROLES.includes(role)) {
    throw httpError(`Vai trò không hợp lệ. Cho phép: ${ALLOWED_ROLES.join(", ")}`, 400);
  }

  const user = await User.findById(userId);
  if (!user) throw httpError("Không tìm thấy người dùng", 404);

  const oldRole = user.role;
  user.role = role;
  await user.save();

  await audit(req, "USER_ROLE_CHANGE", "users", user._id, { from: oldRole, to: role });

  res.json({
    success: true,
    message: `Đã phân quyền tài khoản thành ${role}`,
    user: { id: user._id, username: user.username, email: user.email, role: user.role },
  });
});

// =====================================================================
// UC40: CMS QUẢN LÝ DANH MỤC & TRANG CHỦ
// =====================================================================

// GET /v1/admin/categories
exports.listCategories = ah(async (req, res) => {
  const categories = await Category.find().sort({ created_at: -1 });
  res.json({ success: true, categories });
});

// POST /v1/admin/categories
exports.createCategory = ah(async (req, res) => {
  const { name, slug, iconUrl, isActive = true, defaultCommissionPct, default_commission_pct } = req.body;
  if (!name) throw httpError("Tên danh mục không được để trống", 400);

  const rawRate = defaultCommissionPct ?? default_commission_pct ?? 10;
  const rate = Number(rawRate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 50) {
    throw httpError("defaultCommissionPct phải từ 0 đến 50 (%)", 400);
  }

  const cleanName = String(name).trim();
  const cleanSlug = String(slug || cleanName)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const existing = await Category.findOne({ $or: [{ name: cleanName }, { slug: cleanSlug }] });
  if (existing) throw httpError("Tên hoặc đường dẫn slug của danh mục đã tồn tại", 409);

  const cat = await Category.create({
    name: cleanName,
    slug: cleanSlug,
    icon_url: iconUrl,
    is_active: Boolean(isActive),
    default_commission_pct: rate,
  });

  await audit(req, "CATEGORY_CREATE", "categories", cat._id, { name: cat.name, defaultCommissionPct: rate });
  res.status(201).json({ success: true, message: "Đã tạo danh mục thành công", category: cat });
});

// PUT /v1/admin/categories/:id
exports.updateCategory = ah(async (req, res) => {
  const cat = await Category.findById(validId(req.params.id, "ID danh mục"));
  if (!cat) throw httpError("Không tìm thấy danh mục", 404);

  const { name, slug, iconUrl, isActive, defaultCommissionPct, default_commission_pct } = req.body;
  if (name !== undefined) cat.name = String(name).trim();
  if (slug !== undefined) cat.slug = String(slug).trim().toLowerCase();
  if (iconUrl !== undefined) cat.icon_url = iconUrl;
  if (isActive !== undefined) cat.is_active = Boolean(isActive);
  if (defaultCommissionPct !== undefined || default_commission_pct !== undefined) {
    const rate = Number(defaultCommissionPct ?? default_commission_pct);
    if (!Number.isFinite(rate) || rate < 0 || rate > 50) {
      throw httpError("defaultCommissionPct phải từ 0 đến 50 (%)", 400);
    }
    cat.default_commission_pct = rate;
  }

  await cat.save();
  await audit(req, "CATEGORY_UPDATE", "categories", cat._id, { name: cat.name, defaultCommissionPct: cat.default_commission_pct });
  res.json({ success: true, message: "Đã cập nhật danh mục", category: cat });
});

// DELETE /v1/admin/categories/:id
exports.deleteCategory = ah(async (req, res) => {
  const cat = await Category.findById(validId(req.params.id, "ID danh mục"));
  if (!cat) throw httpError("Không tìm thấy danh mục", 404);

  const eventsCount = await Event.countDocuments({ category_id: cat._id });
  if (eventsCount > 0) {
    throw httpError(`Không thể xoá danh mục này vì đang có ${eventsCount} sự kiện liên kết. Bạn có thể vô hiệu hoá (isActive=false).`, 409);
  }

  await Category.deleteOne({ _id: cat._id });
  await audit(req, "CATEGORY_DELETE", "categories", cat._id);
  res.json({ success: true, message: "Đã xoá danh mục thành công" });
});

// PUT /v1/admin/events/:id/featured (Cài đặt hiển thị trang chủ)
exports.setEventFeatured = ah(async (req, res) => {
  const e = await Event.findById(validId(req.params.id, "ID sự kiện"));
  if (!e) throw httpError("Không tìm thấy sự kiện", 404);

  const { isFeaturedBanner, isTrending, isSpecial } = req.body;
  if (isFeaturedBanner !== undefined) e.is_featured_banner = Boolean(isFeaturedBanner);
  if (isTrending !== undefined) e.is_trending = Boolean(isTrending);
  if (isSpecial !== undefined) e.is_special = Boolean(isSpecial);

  await e.save();
  await audit(req, "EVENT_FEATURED_UPDATE", "events", e._id, {
    isFeaturedBanner: e.is_featured_banner,
    isTrending: e.is_trending,
    isSpecial: e.is_special,
  });

  res.json({
    success: true,
    message: "Đã cập nhật cấu hình hiển thị trang chủ cho sự kiện",
    event: {
      id: e._id,
      title: e.title,
      isFeaturedBanner: e.is_featured_banner,
      isTrending: e.is_trending,
      isSpecial: e.is_special,
    },
  });
});

// =====================================================================
// UC42: QUẢN LÝ ĐỐI SOÁT & GIẢI NGÂN (FINANCIAL SETTLEMENT)
// =====================================================================

// GET /v1/admin/payouts
exports.listPayouts = ah(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const query = {};
  if (status) query.status = String(status).toUpperCase();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [total, payouts] = await Promise.all([
    PayoutSettlement.countDocuments(query),
    PayoutSettlement.find(query)
      .populate("event_id", "title banner_url")
      .populate("organizer_id", "full_name username email phone")
      .populate("settled_by_admin", "full_name username")
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limitNum),
  ]);

  const organizerIds = payouts.map((p) => p.organizer_id?._id).filter(Boolean);
  const profiles = await OrganizerProfile.find({ user_id: { $in: organizerIds } });
  const profileMap = {};
  for (const p of profiles) profileMap[p.user_id.toString()] = p;

  res.json({
    success: true,
    payouts: payouts.map((p) => ({
      id: p._id,
      event: { id: p.event_id?._id, title: p.event_id?.title },
      organizer: {
        id: p.organizer_id?._id,
        name: p.organizer_id?.full_name || p.organizer_id?.username,
        email: p.organizer_id?.email,
        phone: p.organizer_id?.phone,
        bankAccount: (() => {
          const profile = profileMap[p.organizer_id?._id?.toString()];
          if (!profile) return null;
          return {
            bankName: profile.bank_name,
            accountNo: profile.bank_account_no,
            accountHolder: profile.bank_account_holder,
          };
        })(),
      },
      grossRevenue: p.gross_revenue,
      platformCommissionAmt: p.platform_commission_amt,
      netPayoutAmount: p.net_payout_amount,
      status: p.status,
      rejectionReason: p.rejection_reason,
      bankTransferReceiptUrl: p.bank_transfer_receipt_url,
      settledByAdmin: p.settled_by_admin?.full_name || p.settled_by_admin?.username,
      settledAt: p.settled_at,
      createdAt: p.created_at || p._id.getTimestamp(),
    })),
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

// PUT /v1/admin/payouts/:id/approve
exports.approvePayout = ah(async (req, res) => {
  const payout = await PayoutSettlement.findById(validId(req.params.id, "ID yêu cầu đối soát"));
  if (!payout) throw httpError("Không tìm thấy yêu cầu đối soát", 404);
  if (payout.status !== "REQUESTED") {
    throw httpError(`Chỉ duyệt được yêu cầu ở trạng thái REQUESTED (hiện: ${payout.status})`, 409);
  }

  payout.status = "APPROVED";
  await payout.save();

  await audit(req, "PAYOUT_APPROVE", "payout_settlements", payout._id);
  notify(payout.organizer_id, { type: "PAYOUT_APPROVED", title: "Yêu cầu đối soát đã được duyệt", body: "Admin sẽ chuyển khoản vào tài khoản ngân hàng trong hồ sơ KYC của bạn.", link: "/organizer/payouts" });
  res.json({ success: true, message: "Đã duyệt yêu cầu đối soát", payout });
});

// PUT /v1/admin/payouts/:id/reject  { reason } — trả yêu cầu về cho Organizer (số liệu sai, thiếu thông tin...)
exports.rejectPayout = ah(async (req, res) => {
  const reason = str(req.body?.reason, 1000, "lý do từ chối");
  const payout = await PayoutSettlement.findOneAndUpdate(
    { _id: validId(req.params.id, "ID yêu cầu đối soát"), status: { $in: ["REQUESTED", "APPROVED"] } },
    { status: "REJECTED", rejection_reason: reason, rejected_by_admin: req.user.id },
    { new: true },
  );
  if (!payout) {
    const exists = await PayoutSettlement.exists({ _id: req.params.id });
    throw httpError(exists ? "Chỉ từ chối được yêu cầu đang chờ duyệt hoặc chờ chuyển khoản" : "Không tìm thấy yêu cầu đối soát", exists ? 409 : 404);
  }
  await audit(req, "PAYOUT_REJECT", "payout_settlements", payout._id, { reason });
  notify(payout.organizer_id, { type: "PAYOUT_REJECTED", title: "Yêu cầu đối soát bị từ chối", body: `Lý do: ${reason}. Bạn có thể gửi lại yêu cầu.`, link: "/organizer/payouts" });
  res.json({ success: true, message: "Đã từ chối yêu cầu đối soát", payout });
});

// PUT /v1/admin/payouts/:id/settle
exports.settlePayout = ah(async (req, res) => {
  const payout = await PayoutSettlement.findById(validId(req.params.id, "ID yêu cầu đối soát"));
  if (!payout) throw httpError("Không tìm thấy yêu cầu đối soát", 404);
  if (!["REQUESTED", "APPROVED"].includes(payout.status)) {
    throw httpError(`Yêu cầu đối soát đang ở trạng thái ${payout.status}`, 409);
  }

  const { bankTransferReceiptUrl } = req.body;
  payout.status = "SETTLED";
  payout.bank_transfer_receipt_url = bankTransferReceiptUrl || "receipt_confirmed";
  payout.settled_by_admin = req.user.id;
  payout.settled_at = new Date();
  await payout.save();

  await audit(req, "PAYOUT_SETTLE", "payout_settlements", payout._id, {
    netPayoutAmount: payout.net_payout_amount,
  });
  notify(payout.organizer_id, { type: "PAYOUT_SETTLED", title: "Đã chuyển khoản đối soát", body: `Admin đã chuyển ${Number(payout.net_payout_amount).toLocaleString("vi-VN")} ₫ vào tài khoản của bạn.`, link: "/organizer/payouts" });

  res.json({ success: true, message: "Đã xác nhận giải ngân đối soát thành công", payout });
});

// =====================================================================
// UC43: QUẢN LÝ HOÀN TIỀN & HOÀN TIỀN HÀNG LOẠT
// =====================================================================

// GET /v1/admin/refunds
exports.listRefunds = ah(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const query = {};
  if (status) query.status = String(status).toUpperCase();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [total, refunds] = await Promise.all([
    RefundRequest.countDocuments(query),
    RefundRequest.find(query)
      .populate("user_id", "full_name username email phone")
      .populate("ticket_id", "ticket_code")
      .populate({
        path: "order_id",
        select: "order_code total_amount event_id refund_bank_info",
        populate: { path: "event_id", select: "title" },
      })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limitNum),
  ]);

  res.json({
    success: true,
    refunds: refunds.map((r) => ({
      id: r._id,
      user: {
        id: r.user_id?._id,
        name: r.user_id?.full_name || r.user_id?.username,
        email: r.user_id?.email,
        phone: r.user_id?.phone,
      },
      orderCode: r.order_id?.order_code,
      eventName: r.order_id?.event_id?.title,
      ticketCode: r.ticket_id?.ticket_code,
      refundType: r.refund_type,
      refundAmount: r.refund_amount,
      reason: r.reason,
      refundBankInfo: r.order_id?.refund_bank_info || null,
      status: r.status,
      transferReference: r.transfer_reference,
      createdAt: r.created_at,
      processedAt: r.processed_at,
    })),
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

// GET /v1/admin/refunds/:id — Trạng thái dùng để popup QR tự cập nhật
exports.getRefundStatus = ah(async (req, res) => {
  const refund = await RefundRequest.findById(validId(req.params.id, "ID yêu cầu hoàn tiền"))
    .select("status transfer_reference processed_at refund_amount order_id");
  if (!refund) throw httpError("Không tìm thấy yêu cầu hoàn tiền", 404);
  res.json({
    success: true,
    refund: {
      id: refund._id,
      status: refund.status,
      transferReference: refund.transfer_reference,
      processedAt: refund.processed_at,
      refundAmount: refund.refund_amount,
      orderId: refund.order_id,
    },
  });
});

// PUT /v1/admin/refunds/:id/complete — Admin xác nhận đã chuyển khoản thủ công
exports.completeRefund = ah(async (req, res) => {
  const transferReference = req.body?.transferReference ? str(req.body.transferReference, 255, "mã giao dịch chuyển khoản") : undefined;
  const note = req.body?.note ? str(req.body.note, 1000, "ghi chú") : undefined;
  const refund = await RefundRequest.findOneAndUpdate(
    { _id: validId(req.params.id, "ID yêu cầu hoàn tiền"), status: "PROCESSING" },
    {
      $set: {
        status: "COMPLETED",
        processed_by: req.user.id,
        processed_at: new Date(),
        ...(transferReference ? { transfer_reference: transferReference } : {}),
        ...(note ? { processing_note: note } : {}),
      },
    },
    { new: true },
  );
  if (!refund) throw httpError("Yêu cầu hoàn tiền không tồn tại hoặc đã được xử lý", 409);
  await audit(req, "REFUND_MARK_COMPLETED", "refund_requests", refund._id, { transferReference });
  res.json({ success: true, message: "Đã ghi nhận chuyển khoản hoàn tiền", refund });
});

// PUT /v1/admin/refunds/:id/reject — Admin báo lỗi thông tin nhận tiền
exports.rejectRefund = ah(async (req, res) => {
  const reason = str(req.body?.reason, 1000, "lý do báo lỗi");
  const refund = await RefundRequest.findOneAndUpdate(
    { _id: validId(req.params.id, "ID yêu cầu hoàn tiền"), status: "PROCESSING" },
    {
      $set: {
        status: "REJECTED",
        processing_note: reason,
        processed_by: req.user.id,
        processed_at: new Date(),
      },
    },
    { new: true },
  );
  if (!refund) throw httpError("Yêu cầu hoàn tiền không tồn tại hoặc đã được xử lý", 409);
  await audit(req, "REFUND_MARK_REJECTED", "refund_requests", refund._id, { reason });
  res.json({ success: true, message: "Đã đánh dấu yêu cầu hoàn tiền bị lỗi", refund });
});

// POST /v1/admin/events/:id/bulk-refund (Hoàn tiền hàng loạt sự kiện bị huỷ)
exports.bulkRefundEvent = ah(async (req, res) => {
  const eventId = validId(req.params.id, "ID sự kiện");
  const { reason = "Sự kiện bị huỷ theo quyết định của ban tổ chức / quản trị" } = req.body || {};

  const result = await bookingService.bulkRefundAndCancelEvent(eventId, reason);

  await audit(req, "EVENT_BULK_REFUND", "events", result.event._id, {
    refundedOrdersCount: result.refundedOrdersCount,
    totalRefundAmount: result.totalRefundAmount,
    releasedPendingOrders: result.releasedPendingOrders,
    cancelledResaleCount: result.cancelledResaleCount,
    notifiedBuyersCount: result.notifiedBuyersCount,
    reason,
  });

  res.json({
    success: true,
    message: `Đã hoàn tiền hàng loạt thành công cho ${result.refundedOrdersCount} đơn hàng`,
    refundedCount: result.refundedOrdersCount,
    totalRefundAmount: result.totalRefundAmount,
    releasedPendingOrders: result.releasedPendingOrders,
    cancelledResaleCount: result.cancelledResaleCount,
    notifiedBuyersCount: result.notifiedBuyersCount,
  });
});

// =====================================================================
// UC44: THỐNG KÊ DOANH THU TOÀN HỆ THỐNG THEO THÁNG
// =====================================================================

// GET /v1/admin/analytics/revenue?year=
exports.getRevenueAnalytics = ah(async (req, res) => {
  const targetYear = parseInt(req.query.year, 10) || new Date().getFullYear();
  const startOfYear = new Date(Date.UTC(targetYear, 0, 1));
  const endOfYear = new Date(Date.UTC(targetYear + 1, 0, 1));

  const [paidOrders, refundedOrders, allContracts] = await Promise.all([
    Order.find({ status: "PAID", created_at: { $gte: startOfYear, $lt: endOfYear } }),
    RefundRequest.find({ status: "COMPLETED", created_at: { $gte: startOfYear, $lt: endOfYear } }),
    EContract.find({ status: "SIGNED" }),
  ]);

  const contractMap = {};
  for (const c of allContracts) contractMap[c.event_id.toString()] = c.commission_rate_pct ?? c.platform_commission_pct ?? 10;

  const monthlyStats = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    grossMerchandiseValue: 0,
    refundAmount: 0,
    platformCommissionRevenue: 0,
    ordersCount: 0,
    ticketsCount: 0,
  }));

  for (const order of paidOrders) {
    const m = new Date(order.created_at).getMonth();
    const gmv = order.total_amount || 0;
    const commPct = contractMap[order.event_id?.toString()] || 10;
    const commAmt = Math.round((gmv * commPct) / 100);
    const tickets = (order.items_snapshot || []).reduce((sum, it) => sum + (it.quantity || 1), 0);

    monthlyStats[m].grossMerchandiseValue += gmv;
    monthlyStats[m].platformCommissionRevenue += commAmt;
    monthlyStats[m].ordersCount += 1;
    monthlyStats[m].ticketsCount += tickets;
  }

  for (const ref of refundedOrders) {
    const m = new Date(ref.created_at).getMonth();
    monthlyStats[m].refundAmount += ref.refund_amount || 0;
  }

  const yearlyGross = monthlyStats.reduce((s, m) => s + m.grossMerchandiseValue, 0);
  const yearlyRefund = monthlyStats.reduce((s, m) => s + m.refundAmount, 0);
  const yearlyCommission = monthlyStats.reduce((s, m) => s + m.platformCommissionRevenue, 0);

  res.json({
    success: true,
    year: targetYear,
    summary: {
      yearlyGross,
      yearlyRefund,
      yearlyNetGMV: yearlyGross - yearlyRefund,
      yearlyCommissionRevenue: yearlyCommission,
      totalOrders: monthlyStats.reduce((s, m) => s + m.ordersCount, 0),
      totalTickets: monthlyStats.reduce((s, m) => s + m.ticketsCount, 0),
    },
    monthlyStats,
  });
});

// GET /v1/admin/analytics/overview
exports.getOverviewAnalytics = ah(async (req, res) => {
  const [
    usersCount,
    usersByRole,
    eventsCount,
    eventsByStatus,
    paidOrders,
    pendingKYC,
    pendingPayouts,
    pendingRefunds,
    staleContracts,
    staleEvents,
    staleKyc,
  ] = await Promise.all([
    User.countDocuments(),
    User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
    Event.countDocuments(),
    Event.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Order.find({ status: "PAID" }),
    OrganizerProfile.countDocuments({ kyc_status: "PENDING" }),
    PayoutSettlement.countDocuments({ status: "REQUESTED" }),
    RefundRequest.countDocuments({ status: "PROCESSING" }),
    // Việc bị bỏ quên: hợp đồng chờ ký > 3 ngày, sự kiện / KYC chờ duyệt > 2 ngày
    EContract.countDocuments({ status: "WAITING_SIGN", _id: { $lt: require("mongoose").Types.ObjectId.createFromTime(Math.floor((Date.now() - 3 * 864e5) / 1000)) } }),
    Event.countDocuments({ status: "PENDING", created_at: { $lt: new Date(Date.now() - 2 * 864e5) } }),
    OrganizerProfile.countDocuments({ kyc_status: "PENDING", submitted_at: { $lt: new Date(Date.now() - 2 * 864e5) } }),
  ]);

  const totalGMV = paidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const estimatedCommission = Math.round(totalGMV * 0.1);

  const roleStats = {};
  for (const r of usersByRole) roleStats[r._id] = r.count;

  const eventStats = {};
  for (const e of eventsByStatus) eventStats[e._id] = e.count;

  res.json({
    success: true,
    overview: {
      users: { total: usersCount, byRole: roleStats },
      events: { total: eventsCount, byStatus: eventStats },
      financials: { totalGMV, estimatedCommission, paidOrdersCount: paidOrders.length },
      pendingActions: {
        kycProfiles: pendingKYC,
        pendingEvents: eventStats["PENDING"] || 0,
        payoutRequests: pendingPayouts,
        refundRequests: pendingRefunds,
      },
      overdue: { contractsWaitingSign3d: staleContracts, eventsPending2d: staleEvents, kycPending2d: staleKyc },
    },
  });
});
