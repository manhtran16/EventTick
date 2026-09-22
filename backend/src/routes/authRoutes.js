const router = require("express").Router();
const ctrl = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

// Đăng ký & Kích hoạt email
router.post("/register", ctrl.register);
router.get("/verify-email", ctrl.verifyEmail);
router.post("/resend-verification", ctrl.resendVerification);

// Đăng nhập & Đăng xuất
router.post("/login", ctrl.login);
router.get("/logout", ctrl.logout);
router.get("/", ctrl.me);

// Hồ sơ cá nhân
router.get("/user", requireAuth, ctrl.getProfile);
router.post("/user/my-account", requireAuth, ctrl.updateProfile);

// Quên mật khẩu & Đổi mật khẩu
router.post("/forgot-password", ctrl.forgotPassword);
router.post("/reset-password", ctrl.resetPassword);
router.post("/change-password", requireAuth, ctrl.changePassword);

module.exports = router;
