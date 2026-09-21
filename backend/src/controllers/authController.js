const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { signToken } = require("../utils/jwt");

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  secure: false, // đặt true khi deploy thật với HTTPS
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
};

// POST /auth/register
exports.register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin bắt buộc" });
    }

    const existed = await User.findOne({ $or: [{ username }, { email }] });
    if (existed) {
      return res.status(409).json({ success: false, message: "Username hoặc email đã tồn tại" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, passwordHash, role: role || "user" });

    res.json({ success: true, message: "Tạo tài khoản thành công", userId: user._id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /auth/login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ tài khoản và mật khẩu" });
    }

    const identifier = String(username).trim();
    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier.toLowerCase() }],
    });
    if (!user) {
      return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu" });
    }

    const token = signToken({ id: user._id.toString(), username: user.username });
    res.cookie("token", token, COOKIE_OPTS);
    res.json({ success: true, message: "Đăng nhập thành công" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /auth/logout
exports.logout = (req, res) => {
  res.clearCookie("token", COOKIE_OPTS);
  res.json({ success: true });
};

// GET /auth  -> Header.jsx gọi cái này để biết đã đăng nhập chưa
exports.me = async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const user = await User.findById(req.user.id).select("username");
  res.json({ user: user ? { username: user.username } : null });
};

// GET /auth/user  -> AccountPage.jsx dùng để lấy thông tin chi tiết (yêu cầu đăng nhập)
exports.getProfile = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy user" });
  res.json({
    success: true,
    user: {
      userName: user.username,
      name: user.name,
      phone: user.phone,
      dob: user.dob,
      gender: user.gender,
    },
  });
};

// POST /auth/user/my-account  -> cập nhật hồ sơ (yêu cầu đăng nhập)
exports.updateProfile = async (req, res) => {
  const { name, phone, dob, gender } = req.body;
  await User.findByIdAndUpdate(req.user.id, { name, phone, dob, gender });
  res.json({ success: true });
};
