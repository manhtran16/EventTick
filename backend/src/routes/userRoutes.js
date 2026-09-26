const router = require("express").Router();
const ctrl = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

// Cung cấp API chuẩn RESTful cho Profile
router.get("/profile", requireAuth, ctrl.getProfile);
router.put("/profile", requireAuth, ctrl.updateProfile);

module.exports = router;
