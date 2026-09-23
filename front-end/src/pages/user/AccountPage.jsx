import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "@/services/apiClient";
import { authService } from "@/services/auth.service";
import "./AccountPage.css";

const AccountPage = () => {
  const [defaultName, setDefaultName] = useState("");
  const [defaultFirstName, setDefaultFirstName] = useState("");
  const [defaultLastName, setDefaultLastName] = useState("");
  const [defaultPhone, setDefaultPhone] = useState("");
  const [defaultDob, setDefaultDob] = useState("");
  const [defaultGender, setDefaultGender] = useState("");
  const [userName, setUserName] = useState("");

  const [name, setName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");

  const [pwdData, setPwdData] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwdMsg, setPwdMsg] = useState({ text: "", type: "" });
  const [pwdLoading, setPwdLoading] = useState(false);

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
          setDefaultFirstName(user.firstName || "");
          setDefaultLastName(user.lastName || "");
          setDefaultPhone(user.phone || "");
          setDefaultDob(user.dob ? user.dob.substring(0, 10) : "");
          setDefaultGender(user.gender || "");

          setName(user.name || "");
          setFirstName(user.firstName || "");
          setLastName(user.lastName || "");
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
    const computedName = name.trim() || [lastName, firstName].filter(Boolean).join(" ");
    if (!computedName) newErrors.name = "Họ và tên không được để trống.";
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
      const computedName = name.trim() || [lastName, firstName].filter(Boolean).join(" ");
      const res = await axiosInstance.post(
        "/auth/user/my-account",
        {
          userName,
          name: computedName,
          firstName,
          lastName,
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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdMsg({ text: "", type: "" });

    if (!pwdData.currentPassword || !pwdData.newPassword) {
      setPwdMsg({ text: "Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.", type: "error" });
      return;
    }

    if (pwdData.newPassword.length < 6) {
      setPwdMsg({ text: "Mật khẩu mới phải có ít nhất 6 ký tự.", type: "error" });
      return;
    }

    if (pwdData.newPassword !== pwdData.confirmPassword) {
      setPwdMsg({ text: "Mật khẩu xác nhận không khớp.", type: "error" });
      return;
    }

    setPwdLoading(true);
    try {
      const res = await authService.changePassword({
        currentPassword: pwdData.currentPassword,
        newPassword: pwdData.newPassword,
      });
      setPwdMsg({ text: res?.message || "Đổi mật khẩu thành công!", type: "success" });
      setPwdData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPwdMsg({
        text: err.response?.data?.message || "Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu hiện tại.",
        type: "error",
      });
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="account-page-container">
      <div className="account-page-sidebar">
        <h2>Tài khoản của {defaultName || [defaultLastName, defaultFirstName].filter(Boolean).join(" ") || userName}</h2>
      </div>
      <div className="account-page-main">
        <h1>Thông tin tài khoản</h1>

        <div className="account-page-form-group">
          <label htmlFor="lastName">Họ (Last name)</label>
          <input
            type="text"
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder={defaultLastName || "Nguyễn"}
          />
        </div>

        <div className="account-page-form-group">
          <label htmlFor="firstName">Tên (First name)</label>
          <input
            type="text"
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder={defaultFirstName || "Văn A"}
          />
        </div>

        <div className="account-page-form-group">
          <label htmlFor="name">Họ và tên đầy đủ</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={defaultName || [lastName, firstName].filter(Boolean).join(" ")}
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
          Lưu thông tin
        </button>

        <hr style={{ margin: "40px 0 25px 0", border: "none", borderTop: "1px solid #e0e0e0" }} />

        <h2>Đổi mật khẩu</h2>

        <div className="account-page-form-group">
          <label htmlFor="currentPassword">Mật khẩu hiện tại</label>
          <input
            type="password"
            id="currentPassword"
            value={pwdData.currentPassword}
            onChange={(e) => setPwdData({ ...pwdData, currentPassword: e.target.value })}
            placeholder="Nhập mật khẩu hiện tại"
          />
        </div>

        <div className="account-page-form-group">
          <label htmlFor="newPassword">Mật khẩu mới</label>
          <input
            type="password"
            id="newPassword"
            value={pwdData.newPassword}
            onChange={(e) => setPwdData({ ...pwdData, newPassword: e.target.value })}
            placeholder="Tối thiểu 6 ký tự"
          />
        </div>

        <div className="account-page-form-group">
          <label htmlFor="confirmNewPassword">Xác nhận mật khẩu mới</label>
          <input
            type="password"
            id="confirmNewPassword"
            value={pwdData.confirmPassword}
            onChange={(e) => setPwdData({ ...pwdData, confirmPassword: e.target.value })}
            placeholder="Nhập lại mật khẩu mới"
          />
        </div>

        {pwdMsg.text && (
          <p
            style={{
              color: pwdMsg.type === "success" ? "#2e7d32" : "#c62828",
              fontSize: "14px",
              fontWeight: "bold",
              marginTop: "5px",
            }}
          >
            {pwdMsg.text}
          </p>
        )}

        <button
          className="account-page-submit-button"
          style={{ background: "#2196f3", marginTop: "10px" }}
          onClick={handleChangePassword}
          disabled={pwdLoading}
        >
          {pwdLoading ? "Đang xử lý..." : "Cập nhật mật khẩu"}
        </button>
      </div>
    </div>
  );
};

export default AccountPage;
