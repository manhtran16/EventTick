const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const { signToken } = require("../utils/jwt");
const { userToClient } = require("../utils/serializers");
const mailService = require("../utils/mailService");
const { saveUploadedFile } = require("../utils/upload");

const isProduction = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: isProduction ? "none" : "lax",
  secure: isProduction,
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
    const fullName = name || [lastName, firstName].filter(Boolean).join(" ") || trimmedUsername;

    // Sinh token kích hoạt email ngẫu nhiên (hạn 24h)
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await User.create({
      username: trimmedUsername,
      email: trimmedEmail,
      password_hash: passwordHash,
      role: role === "ORGANIZER" ? "ORGANIZER" : "CUSTOMER", // ADMIN/STAFF chỉ do Admin cấp
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      status: "PENDING",
      email_verification_token: verificationToken,
      email_verification_expires: verificationExpires,
    });

    // Gửi email xác thực
    await mailService.sendVerificationEmail(
      user.email,
      verificationToken,
      user.first_name || user.full_name || user.username,
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
      email_verification_token: token,
      email_verification_expires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Mã xác thực không hợp lệ hoặc đã hết hạn.",
      });
    }

    if (user.status === "PENDING") user.status = "ACTIVE";
    user.email_verification_token = undefined;
    user.email_verification_expires = undefined;
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

    if (user.status !== "PENDING") {
      return res.json({ success: true, message: "Tài khoản này đã được kích hoạt trước đó." });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.email_verification_token = verificationToken;
    user.email_verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    await mailService.sendVerificationEmail(
      user.email,
      verificationToken,
      user.first_name || user.full_name || user.username,
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

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu" });
    }

    // Kiểm tra kích hoạt email (nếu chưa kích hoạt -> cảnh báo kèm cờ unverified để front-end hiển thị nút resend)
    if (user.status === "BLOCKED") {
      return res.status(403).json({ success: false, message: "Tài khoản đã bị khóa" });
    }
    if (user.status === "PENDING") {
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
      token,
      user: userToClient(user),
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
  const user = await User.findById(req.user.id).select("username full_name role status");
  res.json({ user: user && user.status !== "BLOCKED" ? userToClient(user) : null });
};

// GET /auth/user  -> AccountPage.jsx dùng để lấy thông tin chi tiết (yêu cầu đăng nhập)
exports.getProfile = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy user" });
  res.json({
    success: true,
    user: {
      userName: user.username,
      name: user.full_name,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      phone: user.phone,
      dob: user.dob,
      gender: user.gender,
      role: user.role,
      isEmailVerified: user.status === "ACTIVE",
      avatarUrl: user.avatar_url,
    },
  });
};

// POST /auth/user/my-account, PUT /user/profile, POST /user/profile/avatar -> cập nhật hồ sơ & ảnh đại diện
exports.updateProfile = async (req, res) => {
  try {
    const { name, firstName, lastName, phone, dob, gender, avatarUrl, avatar_url } = req.body || {};
    const updateData = {};
    if (phone !== undefined) updateData.phone = phone;
    if (dob) updateData.dob = dob;
    if (gender !== undefined) updateData.gender = gender;
    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;
    if (name) {
      updateData.full_name = name;
    } else if (firstName !== undefined || lastName !== undefined) {
      const full = [lastName, firstName].filter(Boolean).join(" ");
      if (full) updateData.full_name = full;
    }
    if (req.file) {
      updateData.avatar_url = await saveUploadedFile(req, req.file);
    } else if (avatarUrl !== undefined || avatar_url !== undefined) {
      updateData.avatar_url = String(avatarUrl ?? avatar_url).trim() || null;
    }
    const updated = await User.findByIdAndUpdate(req.user.id, updateData, { new: true, runValidators: true });
    res.json({
      success: true,
      message: "Cập nhật hồ sơ thành công",
      avatarUrl: updated?.avatar_url || null,
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
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
    user.password_reset_token = resetToken;
    user.password_reset_expires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút
    await user.save();

    // Gửi email đặt lại mật khẩu
    await mailService.sendPasswordResetEmail(
      user.email,
      resetToken,
      user.first_name || user.full_name || user.username,
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
      password_reset_token: token,
      password_reset_expires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.",
      });
    }

    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.password_reset_token = undefined;
    user.password_reset_expires = undefined;
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

    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) {
      return res.status(400).json({ success: false, message: "Mật khẩu hiện tại không chính xác" });
    }

    user.password_hash = await bcrypt.hash(newPassword, 10);
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
