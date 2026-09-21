const router = require("express").Router();
const ctrl = require("../controllers/eventController");
const upload = require("../utils/upload");
const { requireAuth } = require("../middleware/auth");

// LƯU Ý: các route cụ thể (in-banner, trending, search, ...) phải khai báo
// TRƯỚC route động "/:id", nếu không Express sẽ hiểu "in-banner" là 1 :id.
router.get("/in-banner", ctrl.inBanner);
router.get("/trending", ctrl.trending);
router.get("/in-special", ctrl.special);
router.get("/recommend", ctrl.recommend);
router.get("/latest/week", ctrl.latest);
router.get("/latest/month", ctrl.latest);
router.get("/search", ctrl.search);
router.get("/my-event", requireAuth, ctrl.myEvents);

router.post(
  "/",
  requireAuth,
  upload.any(),
  ctrl.create,
);

router.get("/:id", ctrl.getById);

module.exports = router;
