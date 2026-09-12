import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PATHS } from "@/routes/paths";
import "./LoginPage.css";

const LoginPage = () => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [errorMessage, setErrorMessage] = useState("");

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
      if (err.response?.data?.message) {
        setErrorMessage(err.response.data.message);
      } else if (err.message) {
        setErrorMessage(`Lỗi: ${err.message}`);
      } else {
        setErrorMessage("Có lỗi xảy ra khi đăng nhập.");
      }
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
        <button type="submit">Đăng nhập</button>

        {errorMessage && <p className="error-message">{errorMessage}</p>}

        <p className="home-link">
          <Link to={PATHS.HOME}>← Trở lại trang chủ</Link>
        </p>
      </form>
    </div>
  );
};

export default LoginPage;
