const router = require("express").Router();
const ctrl = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

// API cho Top Stars (không cần auth)
router.get("/top-stars", ctrl.getTopStars);

// Cung cấp API chuẩn RESTful cho Profile
router.get("/profile", requireAuth, ctrl.getProfile);
router.put("/profile", requireAuth, ctrl.updateProfile);

module.exports = router;
