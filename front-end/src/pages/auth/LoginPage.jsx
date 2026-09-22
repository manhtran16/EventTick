import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/services/auth.service";
import { PATHS } from "@/routes/paths";
import "./LoginPage.css";

const LoginPage = () => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");

  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo") || PATHS.HOME;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    try {
      const res = await login({
        username: formData.username,
        password: formData.password,
      });

      if (res?.success) {
        navigate(returnTo);
      } else {
        setErrorMessage("Đăng nhập không thành công.");
      }
    } catch (err) {
      console.error("Login error:", err);
      if (err.response?.data?.unverified) {
        setUnverifiedEmail(err.response.data.email || "");
      }
      if (err.response?.data?.message) {
        setErrorMessage(err.response.data.message);
      } else if (err.message) {
        setErrorMessage(`Lỗi: ${err.message}`);
      } else {
        setErrorMessage("Có lỗi xảy ra khi đăng nhập.");
      }
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return;
    try {
      const res = await authService.resendVerification(unverifiedEmail);
      alert(res?.message || "Đã gửi lại link kích hoạt! Vui lòng kiểm tra email.");
    } catch (err) {
      alert(err.response?.data?.message || "Không thể gửi lại email.");
    }
  };

  return (
    <div className="login-container">
      <h2 className="login-text">Đăng nhập</h2>

      <form className="login-form" onSubmit={handleSubmit}>
        {/* Show note if redirected */}
        {returnTo !== PATHS.HOME && (
          <p className="login-note">
            {returnTo.includes("/admin")
              ? "Bạn cần đăng nhập để tiếp tục tạo sự kiện."
              : "Bạn cần đăng nhập để tiếp tục truy cập trang này."}
          </p>
        )}

        <input
          type="text"
          name="username"
          placeholder="Tên đăng nhập hoặc email"
          value={formData.username}
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Mật khẩu"
          value={formData.password}
          onChange={handleChange}
          required
        />

        <div style={{ textAlign: "right", margin: "4px 0 12px 0", fontSize: "13px" }}>
          <Link to={PATHS.FORGOT_PASSWORD} style={{ color: "#4caf50", textDecoration: "none" }}>
            Quên mật khẩu?
          </Link>
        </div>

        <button type="submit">Đăng nhập</button>

        {errorMessage && (
          <div style={{ marginTop: "10px" }}>
            <p className="error-message" style={{ color: "#d32f2f", fontSize: "13px", margin: "0" }}>
              {errorMessage}
            </p>
            {unverifiedEmail && (
              <button
                type="button"
                onClick={handleResendVerification}
                style={{
                  background: "none",
                  border: "none",
                  color: "#1976d2",
                  padding: 0,
                  fontSize: "13px",
                  cursor: "pointer",
                  marginTop: "6px",
                  textDecoration: "underline",
                  textAlign: "left",
                  width: "auto",
                }}
              >
                👉 Bấm vào đây để gửi lại email kích hoạt
              </button>
            )}
          </div>
        )}

        <div style={{ marginTop: "15px", fontSize: "13px", textAlign: "center" }}>
          Chưa có tài khoản?{" "}
          <Link to={PATHS.REGISTER} style={{ color: "#4caf50", fontWeight: "bold", textDecoration: "none" }}>
            Đăng ký ngay
          </Link>
        </div>

        <p className="home-link">
          <Link to={PATHS.HOME}>← Trở lại trang chủ</Link>
        </p>
      </form>
    </div>
  );
};

export default LoginPage;
