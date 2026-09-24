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

const FROM_EMAIL = process.env.EMAIL_FROM || `"Hệ thống Ticketerra" <${process.env.SMTP_USER || 'no-reply@ticketerra.com'}>`;

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
      <div style="background-color: #f3f4f6; padding: 40px 20px; font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">Xác Thực Tài Khoản</h1>
            <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">Ticketerra - Khám phá sự kiện đỉnh cao</p>
          </div>

          <!-- Content -->
          <div style="padding: 40px 30px;">
            <h2 style="color: #1f2937; font-size: 22px; margin-top: 0;">Xin chào ${name} 👋,</h2>
            <p style="color: #4b5563; font-size: 16px;">Cảm ơn bạn đã lựa chọn <strong>Ticketerra</strong>. Chúng tôi rất hào hứng được đồng hành cùng bạn trong những sự kiện sắp tới.</p>
            <p style="color: #4b5563; font-size: 16px;">Để hoàn tất đăng ký, vui lòng kích hoạt tài khoản của bạn bằng cách nhấn vào nút dưới đây:</p>
            
            <div style="text-align: center; margin: 35px 0;">
              <a href="${verifyUrl}" style="background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 15px 35px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);">
                Kích Hoạt Tài Khoản Ngay
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px; margin-top: 30px; border-top: 1px solid #f3f4f6; padding-top: 20px;">Hoặc sao chép đường dẫn này vào trình duyệt của bạn:</p>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; font-size: 13px; color: #64748b; word-break: break-all; border: 1px solid #e2e8f0;">
              ${verifyUrl}
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px 0;">⚠️ Liên kết này chỉ có hiệu lực trong 24 giờ.</p>
            <p style="color: #94a3b8; font-size: 13px; margin: 0;">Nếu bạn không tạo tài khoản này, vui lòng bỏ qua email. Mọi thắc mắc xin liên hệ hỗ trợ.</p>
            <p style="color: #cbd5e1; font-size: 12px; margin: 15px 0 0 0;">© ${new Date().getFullYear()} Ticketerra.</p>
          </div>

        </div>
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
      <div style="background-color: #f3f4f6; padding: 40px 20px; font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); padding: 40px 20px; text-align: center;">
            <div style="font-size: 40px; margin-bottom: 10px;">🔒</div>
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">Khôi Phục Mật Khẩu</h1>
          </div>

          <!-- Content -->
          <div style="padding: 40px 30px;">
            <h2 style="color: #1f2937; font-size: 22px; margin-top: 0;">Xin chào ${name},</h2>
            <p style="color: #4b5563; font-size: 16px;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>Ticketerra</strong> của bạn.</p>
            <p style="color: #4b5563; font-size: 16px;">Vui lòng nhấn vào nút bên dưới để tạo mật khẩu mới. Đừng chia sẻ liên kết này với bất kỳ ai.</p>
            
            <div style="text-align: center; margin: 35px 0;">
              <a href="${resetUrl}" style="background-color: #ef4444; color: #ffffff; text-decoration: none; padding: 15px 35px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);">
                Đặt Lại Mật Khẩu
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px; margin-top: 30px; border-top: 1px solid #f3f4f6; padding-top: 20px;">Hoặc sao chép đường dẫn này vào trình duyệt của bạn:</p>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; font-size: 13px; color: #64748b; word-break: break-all; border: 1px solid #e2e8f0;">
              ${resetUrl}
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #ef4444; font-size: 13px; margin: 0 0 8px 0; font-weight: bold;">⚠️ Liên kết này sẽ hết hạn trong vòng 15 phút.</p>
            <p style="color: #94a3b8; font-size: 13px; margin: 0;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Tài khoản của bạn vẫn an toàn.</p>
            <p style="color: #cbd5e1; font-size: 12px; margin: 15px 0 0 0;">© ${new Date().getFullYear()} Ticketerra.</p>
          </div>

        </div>
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
