const router = require("express").Router();
const ctrl = require("../controllers/eventController");
const upload = require("../utils/upload");
const { requireAuth } = require("../middleware/auth");

// LƯU Ý: Các route cố định phải đặt TRƯỚC route động "/:id"
router.get("/in-banner", ctrl.inBanner);
router.get("/trending", ctrl.trending);
router.get("/in-special", ctrl.special);
router.get("/recommend", ctrl.recommend);
router.get("/latest/week", ctrl.latest);
router.get("/latest/month", ctrl.latest);
router.get("/search", ctrl.search);
router.get("/my-event", requireAuth, ctrl.myEvents);

// Tạo sự kiện mới (Bất kỳ user nào đăng nhập đều có quyền tạo sự kiện)
router.post("/", requireAuth, upload.any(), ctrl.create);

// Admin duyệt/từ chối sự kiện
router.put("/:id/approve", requireAuth, ctrl.approve);
router.put("/:id/reject", requireAuth, ctrl.reject);

// Chi tiết sự kiện theo ID
router.get("/:id", ctrl.getById);

module.exports = router;
