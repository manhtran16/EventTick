const { verifyToken } = require("../utils/jwt");

/**
 * Đọc cookie "token" (nếu có) và gắn req.user = { id, username } | null.
 * Áp dụng cho MỌI request — để route nào cũng biết được ai đang đăng nhập
 * mà không bắt buộc phải đăng nhập (vd: GET /auth dùng cho Header.jsx).
 */
function attachUser(req, res, next) {
  const token = req.cookies?.token;
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch (err) {
      req.user = null; // token hết hạn hoặc không hợp lệ -> coi như chưa đăng nhập
    }
  } else {
    req.user = null;
  }
  next();
}

/** Chặn request nếu chưa đăng nhập — dùng cho các route cần bảo vệ. */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Bạn cần đăng nhập" });
  }
  next();
}

module.exports = { attachUser, requireAuth };
