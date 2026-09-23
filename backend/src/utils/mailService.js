const nodemailer = require("nodemailer");

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// Cấu hình transporter linh hoạt
let transporter;

if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true", // true cho port 465, false cho 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
} else {
  // Chế độ DEV: in trực tiếp ra console nếu chưa điền key SMTP
  transporter = null;
}

const FROM_EMAIL = process.env.EMAIL_FROM || '"Ticketerra Support" <no-reply@ticketerra.com>';

/**
 * Gửi email kích hoạt tài khoản
 */
async function sendVerificationEmail(toEmail, token, name = "bạn") {
  const verifyUrl = `${CLIENT_URL}/verify-email?token=${token}`;

  const mailOptions = {
    from: FROM_EMAIL,
    to: toEmail,
    subject: "🎟 [Ticketerra] Xác thực tài khoản của bạn",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4f46e5; text-align: center;">Chào mừng ${name} đến với Ticketerra!</h2>
        <p>Cảm ơn bạn đã đăng ký tài khoản. Vui lòng bấm vào nút bên dưới để kích hoạt tài khoản của bạn:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Kích hoạt tài khoản</a>
        </div>
        <p style="color: #666; font-size: 14px;">Hoặc copy đường dẫn này vào trình duyệt:</p>
        <p style="background: #f3f4f6; padding: 10px; word-break: break-all; font-size: 13px;">${verifyUrl}</p>
        <p style="color: #888; font-size: 12px; margin-top: 30px;">Liên kết này có hiệu lực trong vòng 24 giờ. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
      </div>
    `,
  };

  if (transporter) {
    try {
      await transporter.sendMail(mailOptions);
      console.log(`✉️ Đã gửi email xác thực đến: ${toEmail}`);
    } catch (err) {
      console.error(`❌ Gửi email thất bại:`, err.message);
      console.log(`👉 Link kích hoạt dự phòng: ${verifyUrl}`);
    }
  } else {
    console.log(`\n============================================================`);
    console.log(`📧 [MÔ PHỎNG GỬI EMAIL XÁC THỰC TÀI KHOẢN]`);
    console.log(`Gửi tới: ${toEmail}`);
    console.log(`👉 Link kích hoạt: ${verifyUrl}`);
    console.log(`============================================================\n`);
  }
}

/**
 * Gửi email đặt lại mật khẩu (Quên mật khẩu)
 */
async function sendPasswordResetEmail(toEmail, token, name = "bạn") {
  const resetUrl = `${CLIENT_URL}/reset-password?token=${token}`;

  const mailOptions = {
    from: FROM_EMAIL,
    to: toEmail,
    subject: "🔒 [Ticketerra] Yêu cầu đặt lại mật khẩu",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #ef4444; text-align: center;">Yêu cầu đặt lại mật khẩu</h2>
        <p>Xin chào ${name}, chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với email này.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Đặt lại mật khẩu</a>
        </div>
        <p style="color: #666; font-size: 14px;">Hoặc copy đường dẫn này vào trình duyệt:</p>
        <p style="background: #f3f4f6; padding: 10px; word-break: break-all; font-size: 13px;">${resetUrl}</p>
        <p style="color: #888; font-size: 12px; margin-top: 30px;">⚠️ Liên kết này chỉ có hiệu lực trong vòng <strong>15 phút</strong>. Nếu bạn không gửi yêu cầu này, vui lòng bỏ qua email và mật khẩu của bạn vẫn an toàn.</p>
      </div>
    `,
  };

  if (transporter) {
    try {
      await transporter.sendMail(mailOptions);
      console.log(`✉️ Đã gửi email reset mật khẩu đến: ${toEmail}`);
    } catch (err) {
      console.error(`❌ Gửi email thất bại:`, err.message);
      console.log(`👉 Link đặt lại mật khẩu dự phòng: ${resetUrl}`);
    }
  } else {
    console.log(`\n============================================================`);
    console.log(`📧 [MÔ PHỎNG GỬI EMAIL ĐẶT LẠI MẬT KHẨU]`);
    console.log(`Gửi tới: ${toEmail}`);
    console.log(`👉 Link đặt lại mật khẩu: ${resetUrl}`);
    console.log(`============================================================\n`);
  }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
