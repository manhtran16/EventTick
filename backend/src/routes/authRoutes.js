const router = require("express").Router();
const ctrl = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

router.post("/register", ctrl.register);
router.post("/login", ctrl.login);
router.get("/logout", ctrl.logout);
router.get("/", ctrl.me);
router.get("/user", requireAuth, ctrl.getProfile);
router.post("/user/my-account", requireAuth, ctrl.updateProfile);

module.exports = router;
