const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const { signToken } = require("../utils/jwt");
const mailService = require("../utils/mailService");

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  secure: false, // đặt true khi deploy thật với HTTPS
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
};

// UC 1.1: POST /auth/register
exports.register = async (req, res) => {
  try {
    const { username, email, password, role, name, firstName, lastName } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin bắt buộc" });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedUsername = username.trim();

    const existed = await User.findOne({
      $or: [{ username: trimmedUsername }, { email: trimmedEmail }],
    });
    if (existed) {
      return res.status(409).json({ success: false, message: "Tên đăng nhập hoặc email đã tồn tại" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const fullName = name || [lastName, firstName].filter(Boolean).join(" ");

    // Sinh token kích hoạt email ngẫu nhiên (hạn 24h)
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await User.create({
      username: trimmedUsername,
      email: trimmedEmail,
      passwordHash,
      role: role === "admin" ? "admin" : "user",
      name: fullName,
      firstName,
      lastName,
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    });

    // Gửi email xác thực
    await mailService.sendVerificationEmail(
      user.email,
      verificationToken,
      user.firstName || user.name || user.username,
    );

    res.json({
      success: true,
      message: "Đăng ký thành công! Vui lòng kiểm tra email để kích hoạt tài khoản.",
      userId: user._id,
      email: user.email,
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// UC 1.2: GET /auth/verify-email?token=...
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, message: "Thiếu mã xác thực (token)" });
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Mã xác thực không hợp lệ hoặc đã hết hạn.",
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Tài khoản của bạn đã được kích hoạt thành công! Bạn có thể đăng nhập ngay bây giờ.",
    });
  } catch (err) {
    console.error("Verify email error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /auth/resend-verification
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Vui lòng cung cấp email" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản với email này" });
    }

    if (user.isEmailVerified) {
      return res.json({ success: true, message: "Tài khoản này đã được kích hoạt trước đó." });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    await mailService.sendVerificationEmail(
      user.email,
      verificationToken,
      user.firstName || user.name || user.username,
    );

    res.json({
      success: true,
      message: "Đã gửi lại email kích hoạt. Vui lòng kiểm tra hòm thư của bạn.",
    });
  } catch (err) {
    console.error("Resend verification error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// UC 1.3: POST /auth/login
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

    // Kiểm tra kích hoạt email (nếu chưa kích hoạt -> cảnh báo kèm cờ unverified để front-end hiển thị nút resend)
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        unverified: true,
        email: user.email,
        message: "Tài khoản chưa được kích hoạt qua email. Vui lòng kiểm tra hộp thư hoặc gửi lại mã kích hoạt.",
      });
    }

    const token = signToken({ id: user._id.toString(), username: user.username, role: user.role });
    res.cookie("token", token, COOKIE_OPTS);
    res.json({
      success: true,
      message: "Đăng nhập thành công",
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /auth/logout
exports.logout = (req, res) => {
  res.clearCookie("token", COOKIE_OPTS);
  res.json({ success: true, message: "Đã đăng xuất" });
};

// GET /auth  -> Header.jsx gọi cái này để biết đã đăng nhập chưa
exports.me = async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const user = await User.findById(req.user.id).select("username name role");
  res.json({
    user: user ? { id: user._id, username: user.username, name: user.name, role: user.role } : null,
  });
};

// GET /auth/user  -> AccountPage.jsx dùng để lấy thông tin chi tiết (yêu cầu đăng nhập)
exports.getProfile = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy user" });
  res.json({
    success: true,
    user: {
      userName: user.username,
      name: user.name || [user.lastName, user.firstName].filter(Boolean).join(" "),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      dob: user.dob,
      gender: user.gender,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    },
  });
};

// POST /auth/user/my-account  -> cập nhật hồ sơ (yêu cầu đăng nhập)
exports.updateProfile = async (req, res) => {
  try {
    const { name, firstName, lastName, phone, dob, gender } = req.body;
    const updateData = { phone, dob, gender };
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (name !== undefined) {
      updateData.fullName = name;
    } else if (firstName !== undefined || lastName !== undefined) {
      updateData.fullName = [lastName, firstName].filter(Boolean).join(" ");
    }
    await User.findByIdAndUpdate(req.user.id, updateData);
    res.json({ success: true, message: "Cập nhật hồ sơ thành công" });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// UC 1.4: POST /auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập địa chỉ email" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      // Để bảo mật, không báo lộ rằng email không tồn tại
      return res.json({
        success: true,
        message: "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến bạn.",
      });
    }

    // Sinh token reset ngẫu nhiên (hạn 15 phút)
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút
    await user.save();

    // Gửi email đặt lại mật khẩu
    await mailService.sendPasswordResetEmail(
      user.email,
      resetToken,
      user.firstName || user.name || user.username,
    );

    res.json({
      success: true,
      message: "Hướng dẫn đặt lại mật khẩu đã được gửi đến email của bạn.",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// UC 1.5: POST /auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin bắt buộc" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu mới phải có ít nhất 6 ký tự" });
    }

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.",
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.",
    });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// UC 1.6: POST /auth/change-password  (yêu cầu đăng nhập)
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập mật khẩu hiện tại và mật khẩu mới" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu mới phải có ít nhất 6 ký tự" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      return res.status(400).json({ success: false, message: "Mật khẩu hiện tại không chính xác" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({
      success: true,
      message: "Đổi mật khẩu thành công!",
    });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
