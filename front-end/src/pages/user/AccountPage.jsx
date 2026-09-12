import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "@/services/apiClient";
import "./AccountPage.css";

const AccountPage = () => {
  const [defaultName, setDefaultName] = useState("");
  const [defaultPhone, setDefaultPhone] = useState("");
  const [defaultDob, setDefaultDob] = useState("");
  const [defaultGender, setDefaultGender] = useState("");
  const [userName, setUserName] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");

  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axiosInstance.get("/auth/user", {
          withCredentials: true,
        });
        if (res.data.success) {
          const { user } = res.data;

          setUserName(user.userName);

          setDefaultName(user.name || "");
          setDefaultPhone(user.phone || "");
          setDefaultDob(user.dob ? user.dob.substring(0, 10) : "");
          setDefaultGender(user.gender || "");

          setName(user.name || "");
          setPhone(user.phone || "");
          setDob(user.dob ? user.dob.substring(0, 10) : "");
          setGender(user.gender || "");
        }
      } catch (err) {
        console.error("Error fetching user:", err);
      }
    };
    fetchUser();
  }, []);

  const validateForm = () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = "Họ và tên không được để trống.";
    if (!/^\d{9,11}$/.test(phone))
      newErrors.phone = "Số điện thoại phải là số và có 9–11 chữ số.";

    if (!dob.trim()) newErrors.dob = "Ngày sinh không được để trống.";
    if (!gender) newErrors.gender = "Vui lòng chọn giới tính.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      const res = await axiosInstance.post(
        "/auth/user/my-account",
        {
          userName,
          name,
          phone,
          dob,
          gender,
        },
        { withCredentials: true }
      );
      alert("Thông tin tài khoản đã được cập nhật thành công!");
      console.log("Saved account:", res.data);
      navigate("/");
    } catch (err) {
      console.error("Error saving account:", err);
      alert("Có lỗi. Hãy đăng nhập bằng tài khoản user.");
    }
  };

  return (
    <div className="account-page-container">
      <div className="account-page-sidebar">
        <h2>Tài khoản của {defaultName || userName}</h2>
      </div>
      <div className="account-page-main">
        <h1>Thông tin tài khoản</h1>

        <div className="account-page-form-group">
          <label htmlFor="name">Họ và tên</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={defaultName}
          />
          {errors.name && <span className="error">{errors.name}</span>}
        </div>

        <div className="account-page-form-group">
          <label htmlFor="phone">Số điện thoại</label>
          <input
            type="text"
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            placeholder={defaultPhone}
          />
          {errors.phone && <span className="error">{errors.phone}</span>}
        </div>

        <div className="account-page-form-group">
          <label htmlFor="dob">Ngày tháng năm sinh</label>
          <input
            type="date"
            id="dob"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
          {errors.dob && <span className="error">{errors.dob}</span>}
        </div>

        <div className="account-page-form-group">
          <label>Giới tính</label>
          <select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">-- Chọn giới tính --</option>
            <option value="Nam">Nam</option>
            <option value="Nữ">Nữ</option>
            <option value="Khác">Khác</option>
          </select>
          {errors.gender && <span className="error">{errors.gender}</span>}
        </div>

        <button className="account-page-submit-button" onClick={handleSubmit}>
          Hoàn thành
        </button>
      </div>
    </div>
  );
};

export default AccountPage;
