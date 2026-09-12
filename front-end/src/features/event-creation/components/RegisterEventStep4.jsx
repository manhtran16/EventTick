import React, { useState } from "react";
import "./RegisterEventStep4.css";

const RegisterEventStep4 = ({ onSaveStep4 }) => {
  const [accountOwner, setAccountOwner] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [branch, setBranch] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    if (
      accountOwner.trim() === "" ||
      accountNumber.trim() === "" ||
      bankName.trim() === "" ||
      branch.trim() === ""
    ) {
      setError("Vui lòng điền đầy đủ thông tin thanh toán.");
      return;
    }
    setError("");
    if (onSaveStep4) {
      onSaveStep4({ accountOwner, accountNumber, bankName, branch });
    }
  };

  return (
    <div className="step-four-main">
      <h2>Thông tin thanh toán</h2>

      <div className="step-four-section">
        <p>
          Ticketbox sẽ chuyển tiền bán vé đến tài khoản của bạn.
          <br />
          Tiền bán vé (sau khi trừ phí dịch vụ cho Ticketbox) sẽ vào tài khoản
          của bạn sau khi xác nhận sale report từ 7 - 10 ngày. Nếu bạn muốn nhận
          được tiền sớm hơn, vui lòng liên hệ chúng tôi qua số 1900.6408 hoặc
          info@ticketbox.vn
        </p>

        {/* Account Owner */}
        <div className="step-four-form-group">
          <label htmlFor="account-owner">Chủ tài khoản</label>
          <input
            type="text"
            id="account-owner"
            maxLength={100}
            value={accountOwner}
            onChange={(e) => setAccountOwner(e.target.value)}
          />
          <div className="step-four-char-count">
            {accountOwner.length} / 100
          </div>
        </div>

        {/* Account Number */}
        <div className="step-four-form-group">
          <label htmlFor="account-number">Số tài khoản</label>
          <input
            type="text"
            id="account-number"
            maxLength={50}
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
          />
          <div className="step-four-char-count">
            {accountNumber.length} / 50
          </div>
        </div>

        {/* Bank Name */}
        <div className="step-four-form-group">
          <label htmlFor="bank-name">Tên ngân hàng</label>
          <input
            type="text"
            id="bank-name"
            maxLength={100}
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
          />
          <div className="step-four-char-count">{bankName.length} / 100</div>
        </div>

        {/* Branch */}
        <div className="step-four-form-group">
          <label htmlFor="branch">Chi nhánh</label>
          <input
            type="text"
            id="branch"
            maxLength={100}
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          />
          <div className="step-four-char-count">{branch.length} / 100</div>
        </div>

        {error && (
          <div style={{ color: "red", marginTop: "10px" }}>{error}</div>
        )}
      </div>

      <div
        className="next-step-btn"
        style={{ backgroundColor: "#009cfc", color: "#fff", marginTop: "20px" }}
        onClick={handleConfirm}
      >
        Xác nhận tạo sự kiện mới
      </div>
    </div>
  );
};

export default RegisterEventStep4;
