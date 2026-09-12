import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PATHS } from "@/routes/paths";
import "./RegisterPage.css";

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirm_password: "",
    role: "",
  });

  const [msg, setMsg] = useState("");
  const navigate = useNavigate();
  const { register, login } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMsg("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirm_password) {
      setMsg("Mật khẩu nhập lại không đúng");
      return;
    }

    try {
      const res = await register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });

      setMsg(res?.message || "Đăng ký thành công!");

      // Auto login after successful registration
      await login({
        username: formData.username,
        password: formData.password,
      });

      setTimeout(() => {
        navigate(PATHS.HOME);
      }, 1000);
    } catch (err) {
      console.error("Register error:", err);
      setMsg(err.response?.data?.message || err.message || "Đăng ký thất bại.");
    }
  };

  return (
    <div className="register-container">
      <h2 className="register-text">Tạo tài khoản</h2>
      <form className="register-form" onSubmit={handleSubmit}>
        <input
          type="text"
          name="username"
          placeholder="Tên đăng nhập"
          value={formData.username}
          onChange={handleChange}
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
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
        <input
          type="password"
          name="confirm_password"
          placeholder="Nhập lại mật khẩu"
          value={formData.confirm_password}
          onChange={handleChange}
          required
        />
        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          required
        >
          <option value="">Chọn vai trò</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="both">Cả hai</option>
        </select>

        {msg && <p className="msg-text">{msg}</p>}

        <button type="submit">Đăng kí</button>
        <p className="home-link">
          <Link to={PATHS.HOME}>← Trở lại trang chủ</Link>
        </p>
      </form>
    </div>
  );
};

export default RegisterPage;
