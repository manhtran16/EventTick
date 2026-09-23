import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PATHS } from "@/routes/paths";
import "./RegisterPage.css";

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    confirm_password: "",
  });

  const [msg, setMsg] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMsg("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password.length < 6) {
      setMsg("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    if (formData.password !== formData.confirm_password) {
      setMsg("Mật khẩu nhập lại không khớp");
      return;
    }

    setLoading(true);
    try {
      const res = await register({
        username: formData.username.trim(),
        email: formData.email.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        password: formData.password,
      });

      if (res?.success) {
        setIsSuccess(true);
        setMsg(res?.message || "Đăng ký thành công! Vui lòng kiểm tra email để kích hoạt tài khoản.");
      } else {
        setMsg(res?.message || "Đăng ký thất bại.");
      }
    } catch (err) {
      console.error("Register error:", err);
      setMsg(err.response?.data?.message || err.message || "Đăng ký thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <h2 className="register-text">Tạo tài khoản</h2>
      <div className="register-form">
        {!isSuccess ? (
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              name="username"
              placeholder="Tên đăng nhập *"
              value={formData.username}
              onChange={handleChange}
              required
            />

            <input
              type="email"
              name="email"
              placeholder="Email *"
              value={formData.email}
              onChange={handleChange}
              required
            />

            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                name="lastName"
                placeholder="Họ (Last name)"
                value={formData.lastName}
                onChange={handleChange}
                style={{ flex: 1 }}
              />
              <input
                type="text"
                name="firstName"
                placeholder="Tên (First name)"
                value={formData.firstName}
                onChange={handleChange}
                style={{ flex: 1 }}
              />
            </div>

            <input
              type="password"
              name="password"
              placeholder="Mật khẩu (ít nhất 6 ký tự) *"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
            />

            <input
              type="password"
              name="confirm_password"
              placeholder="Nhập lại mật khẩu *"
              value={formData.confirm_password}
              onChange={handleChange}
              required
              minLength={6}
            />

            {msg && <p className="msg-text" style={{ color: "#d32f2f", margin: "8px 0", fontSize: "13px" }}>{msg}</p>}

            <button type="submit" disabled={loading}>
              {loading ? "Đang xử lý..." : "Đăng ký"}
            </button>

            <div style={{ marginTop: "15px", fontSize: "13px", textAlign: "center" }}>
              Đã có tài khoản?{" "}
              <Link to={PATHS.LOGIN} style={{ color: "#4caf50", fontWeight: "bold", textDecoration: "none" }}>
                Đăng nhập
              </Link>
            </div>
          </form>
        ) : (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>✉️</div>
            <h3 style={{ color: "#2e7d32", margin: "0 0 10px 0" }}>Đăng ký thành công!</h3>
            <p style={{ fontSize: "14px", lineHeight: "1.6", color: "#555", margin: "0 0 20px 0" }}>
              Chúng tôi đã gửi liên kết kích hoạt đến email <strong>{formData.email}</strong>. Vui lòng kiểm tra hộp thư
              đến (hoặc thư rác/spam) và bấm vào liên kết để kích hoạt tài khoản của bạn trước khi đăng nhập.
            </p>
            <Link
              to={PATHS.LOGIN}
              style={{
                display: "block",
                padding: "10px 0",
                background: "#4caf50",
                color: "white",
                textDecoration: "none",
                borderRadius: "4px",
                fontWeight: "bold",
              }}
            >
              Chuyển đến Đăng nhập
            </Link>
          </div>
        )}

        <p className="home-link">
          <Link to={PATHS.HOME}>← Trở lại trang chủ</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
