import React, { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { authService } from "@/services/auth.service";
import { PATHS } from "@/routes/paths";
import "./ResetPasswordPage.css";

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setMsg({ text: "Mã đặt lại mật khẩu không tồn tại trong liên kết.", type: "error" });
      return;
    }

    if (newPassword.length < 6) {
      setMsg({ text: "Mật khẩu mới phải có ít nhất 6 ký tự.", type: "error" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMsg({ text: "Mật khẩu xác nhận không khớp.", type: "error" });
      return;
    }

    setLoading(true);
    setMsg({ text: "", type: "" });

    try {
      const res = await authService.resetPassword({ token, newPassword });
      setMsg({
        text: res?.message || "Đặt lại mật khẩu thành công!",
        type: "success",
      });
      setIsDone(true);
      setTimeout(() => {
        navigate(PATHS.LOGIN);
      }, 2500);
    } catch (err) {
      setMsg({
        text: err.response?.data?.message || "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-container">
      <h2 className="reset-header">Đặt lại mật khẩu</h2>
      <form className="reset-form" onSubmit={handleSubmit}>
        {!isDone ? (
          <>
            <p className="reset-desc">Vui lòng nhập mật khẩu mới cho tài khoản của bạn (tối thiểu 6 ký tự).</p>

            <input
              type="password"
              placeholder="Mật khẩu mới"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />

            <input
              type="password"
              placeholder="Xác nhận mật khẩu mới"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />

            <button type="submit" disabled={loading}>
              {loading ? "Đang xử lý..." : "Cập nhật mật khẩu"}
            </button>
          </>
        ) : (
          <p style={{ textAlign: "center", margin: "20px 0" }}>
            Hệ thống đang chuyển sang trang đăng nhập...
          </p>
        )}

        {msg.text && <div className={`reset-msg ${msg.type}`}>{msg.text}</div>}

        <div className="reset-links">
          <Link to={PATHS.LOGIN}>← Quay lại trang Đăng nhập</Link>
        </div>
      </form>
    </div>
  );
};

export default ResetPasswordPage;
