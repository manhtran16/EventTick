import React, { useState } from "react";
import { Link } from "react-router-dom";
import { authService } from "@/services/auth.service";
import { PATHS } from "@/routes/paths";
import "./ForgotPasswordPage.css";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setMsg({ text: "", type: "" });

    try {
      const res = await authService.forgotPassword(email.trim());
      setMsg({
        text: res?.message || "Hướng dẫn đặt lại mật khẩu đã được gửi đến email của bạn.",
        type: "success",
      });
    } catch (err) {
      setMsg({
        text: err.response?.data?.message || "Có lỗi xảy ra khi gửi yêu cầu. Vui lòng thử lại.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-container">
      <h2 className="forgot-header">Quên mật khẩu</h2>
      <form className="forgot-form" onSubmit={handleSubmit}>
        <p className="forgot-desc">
          Nhập địa chỉ email liên kết với tài khoản của bạn. Chúng tôi sẽ gửi cho bạn liên kết để đặt lại mật khẩu mới.
        </p>

        <input
          type="email"
          placeholder="Địa chỉ email của bạn"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Đang gửi yêu cầu..." : "Gửi liên kết đặt lại mật khẩu"}
        </button>

        {msg.text && <div className={`forgot-msg ${msg.type}`}>{msg.text}</div>}

        <div className="forgot-links">
          <Link to={PATHS.LOGIN}>← Quay lại Đăng nhập</Link>
          <Link to={PATHS.HOME}>Trang chủ</Link>
        </div>
      </form>
    </div>
  );
};

export default ForgotPasswordPage;
