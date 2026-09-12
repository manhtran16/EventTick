import "./RegisterEventStep3.css";
import React, { useState } from "react";

const RegisterEventStep3 = ({ onSaveStep3 }) => {
  const [customUrl, setCustomUrl] = useState("");
  const [confirmationMsg, setConfirmationMsg] = useState("");
  const [error, setError] = useState("");

  const handleUrlChange = (e) => {
    setCustomUrl(e.target.value);
  };

  const handleMsgChange = (e) => {
    setConfirmationMsg(e.target.value);
    if (e.target.value.trim() !== "") {
      setError(""); // clear error when user types
    }
  };

  const handleContinue = () => {
    if (confirmationMsg.trim() === "") {
      setError("Vui lòng điền tin nhắn xác nhận cho người tham gia.");
      return;
    }
    if (onSaveStep3) {
      onSaveStep3({ customUrl, confirmationMsg });
    }
  };

  return (
    <div className="step-three-main">
      <h2>Cài đặt sự kiện</h2>

      {/* Custom URL */}
      <div className="step-three-section">
        <div className="step-three-form-group">
          <label htmlFor="custom-url">Tùy chỉnh đường dẫn</label>
          <input
            type="text"
            id="custom-url"
            maxLength={80}
            value={customUrl}
            onChange={handleUrlChange}
          />
          <div className="step-three-char-count">{customUrl.length} / 80</div>
          <div className="step-three-url-preview">
            Đường dẫn sự kiện của bạn là: https://ticketbox.vn/{customUrl}
          </div>
        </div>
      </div>

      {/* Confirmation message */}
      <div className="step-three-section">
        <div className="step-three-form-group">
          <label htmlFor="confirmation-msg">
            Tin nhắn xác nhận cho người tham gia
          </label>
          <textarea
            id="confirmation-msg"
            rows={4}
            maxLength={500}
            value={confirmationMsg}
            onChange={handleMsgChange}
          />
          <div className="step-three-char-count">
            {confirmationMsg.length} / 500
          </div>
          {error && (
            <div style={{ color: "red", marginTop: "5px" }}>{error}</div>
          )}
        </div>
      </div>

      <div
        className="next-step-btn"
        style={{ marginLeft: "30px", color: "#fff" }}
        onClick={handleContinue}
      >
        Tiếp tục
      </div>
    </div>
  );
};

export default RegisterEventStep3;