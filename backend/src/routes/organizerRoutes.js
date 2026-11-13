const router = require("express").Router();
const upload = require("../utils/upload");
const { requireVerifiedOrganizer } = require("../middleware/auth");
const ev = require("../controllers/organizerEventController");
const vc = require("../controllers/voucherController");
const seatMapCtrl = require("../controllers/seatMapController");

// Mọi route dưới /v1/organizer (trừ kyc, contracts đã có router riêng) cần Nhà tổ chức đã được duyệt KYC.
router.use(requireVerifiedOrganizer);

// UC31: Dashboard tổng quan
router.get("/dashboard", ev.getDashboard);

// UC22, UC23: sự kiện
router.get("/events", ev.list);
router.get("/events/:id", ev.detail);
router.get("/events/:id/history", ev.history);
router.put("/events/:id", ev.update);
router.put("/events/:id/images", upload.any(), ev.images);
router.put("/events/:id/legal-doc", upload.single("document"), ev.legalDoc);
router.post("/events/:id/submit", ev.submit);
router.post("/events/:id/withdraw", ev.withdraw);
router.post("/events/:id/cancel", ev.cancel);

// UC24: file mẫu SVG / Excel và xem sơ đồ đã lưu (sơ đồ được tải lên cùng lúc tạo sự kiện, POST /events)
router.get("/seatmap/template.xlsx", seatMapCtrl.templateXlsx);
router.get("/seatmap/template.svg", seatMapCtrl.templateSvg);
router.get("/events/:id/seatmap", seatMapCtrl.adminGet);
router.post("/seatmap/parse", upload.any(), seatMapCtrl.parseSeated); // đọc SVG + Excel, trả hạng vé và bản xem trước (không ghi DB)
router.put("/events/:id/seatmap", upload.any(), seatMapCtrl.replaceLayout); // thay sơ đồ khi còn là bản nháp

// UC26: Biểu mẫu thông tin người tham dự (Custom Checkout Form)
router.put("/events/:id/custom-form", ev.updateCustomForm);

// UC29: Quản lý đơn hàng & Danh sách người tham dự
router.get("/events/:id/orders", ev.getEventOrders);
router.get("/events/:id/attendees", ev.getEventAttendees);

// UC30: Quản lý nhân viên soát vé
router.get("/events/:id/staff", ev.listStaff);
router.post("/events/:id/staff", ev.addStaff);
router.put("/staff-assignments/:assignmentId", ev.updateStaffAssignment);
router.delete("/staff-assignments/:assignmentId", ev.removeStaffAssignment);

// UC32: Thống kê doanh thu chi tiết
router.get("/events/:id/analytics", ev.getEventAnalytics);

// UC33: Xuất báo cáo dữ liệu (CSV)
router.get("/events/:id/export/attendees", ev.exportAttendees);
router.get("/events/:id/export/orders", ev.exportOrders);

// UC34: Đối soát & Rút tiền
router.get("/events/:id/payout-summary", ev.getPayoutSummary);
router.post("/events/:id/payout/request", ev.requestPayout);
router.get("/payouts", ev.listPayouts);

// Suất diễn (chỉ khi DRAFT)
router.post("/events/:id/sessions", ev.addSession);
router.put("/sessions/:sessionId", ev.updateSession);
router.delete("/sessions/:sessionId", ev.deleteSession);

// UC25: hạng vé
router.post("/sessions/:sessionId/tiers", ev.addTier);
router.put("/tiers/:tierId", ev.updateTier);
router.delete("/tiers/:tierId", ev.deleteTier);

// UC28: voucher & thống kê hiệu quả khuyến mãi
router.get("/events/:eventId/vouchers", vc.list);
router.get("/events/:eventId/vouchers/stats", vc.list);
router.post("/events/:eventId/vouchers", vc.create);
router.put("/vouchers/:id", vc.update);
router.delete("/vouchers/:id", vc.remove);

module.exports = router;
