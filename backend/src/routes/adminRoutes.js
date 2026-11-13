const express = require("express");
const router = express.Router();
const { requireRole } = require("../middleware/auth");
const contractCtrl = require("../controllers/contractController");
const adminCtrl = require("../controllers/adminController");
const seatMapCtrl = require("../controllers/seatMapController");
const resaleCtrl = require("../controllers/resaleController");

router.use(requireRole("ADMIN"));

// UC39, UC41: Phê duyệt sự kiện & Quản lý hợp đồng
router.get("/events", contractCtrl.adminListEvents);
router.get("/events/:id", contractCtrl.adminEventDetail);
router.get("/events/:id/legal-doc", contractCtrl.adminLegalDoc);
router.put("/events/:id/approve", contractCtrl.approveEvent);
router.put("/events/:id/reject", contractCtrl.rejectEvent);
router.get("/contracts", contractCtrl.adminListContracts);
router.put("/contracts/:id/commission", contractCtrl.updateCommission);
router.get("/contracts/:id/pdf", contractCtrl.adminContractPdf);

// UC24: Admin xem sơ đồ chỗ ngồi do Organizer tải lên khi tạo sự kiện
router.get("/events/:id/seatmap", seatMapCtrl.adminGet);

// UC37: Quản lý người dùng, khóa tài khoản & phân quyền
router.get("/users", adminCtrl.listUsers);
router.put("/users/:id/status", adminCtrl.updateUserStatus);
router.put("/users/:id/role", adminCtrl.updateUserRole);

// UC40: CMS Danh mục & Trang chủ
router.get("/categories", adminCtrl.listCategories);
router.post("/categories", adminCtrl.createCategory);
router.put("/categories/:id", adminCtrl.updateCategory);
router.delete("/categories/:id", adminCtrl.deleteCategory);
router.put("/events/:id/featured", adminCtrl.setEventFeatured);

// UC42: Quản lý Đối soát & Giải ngân
router.get("/payouts", adminCtrl.listPayouts);
router.put("/payouts/:id/approve", adminCtrl.approvePayout);
router.put("/payouts/:id/settle", adminCtrl.settlePayout);
router.put("/payouts/:id/reject", adminCtrl.rejectPayout);

// UC43: Hoàn tiền — CHỈ khi sự kiện bị huỷ (hoàn hàng loạt). Không có hoàn vé lẻ.
router.get("/refunds", adminCtrl.listRefunds);
router.get("/refunds/:id", adminCtrl.getRefundStatus);
router.put("/refunds/:id/complete", adminCtrl.completeRefund);
router.put("/refunds/:id/reject", adminCtrl.rejectRefund);
router.post("/events/:id/bulk-refund", adminCtrl.bulkRefundEvent);

// Chợ vé bán lại: chi trả tiền cho người bán sau khi vé được mua
router.get("/resale/payouts", resaleCtrl.adminListPayouts);
router.put("/resale/payouts/:id/paid", resaleCtrl.adminMarkPayoutPaid);

// UC44: Thống kê doanh thu toàn hệ thống & Tổng quan
router.get("/analytics/revenue", adminCtrl.getRevenueAnalytics);
router.get("/analytics/overview", adminCtrl.getOverviewAnalytics);

module.exports = router;
