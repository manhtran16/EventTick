import "./RegisterEventStep3.css";
import React, { useState } from "react";

const RegisterEventStep3 = ({ onSaveStep3 }) => {
  const [customUrl, setCustomUrl] = useState("");
  const [confirmationMsg, setConfirmationMsg] = useState("");
  const [allowResale, setAllowResale] = useState(false);
  const [allowGift, setAllowGift] = useState(false);
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
      onSaveStep3({ customUrl, confirmationMsg, allowResale, allowGift });
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

      {/* Resale/Gift Policy */}
      <div className="step-three-section">
        <h3>Chính sách vé (Policy)</h3>
        <div className="step-three-form-group" style={{ flexDirection: "row", alignItems: "center", gap: "10px", marginTop: "10px" }}>
          <input
            type="checkbox"
            id="allow-resale"
            checked={allowResale}
            onChange={(e) => setAllowResale(e.target.checked)}
            style={{ width: "auto" }}
          />
          <label htmlFor="allow-resale" style={{ marginBottom: 0, fontWeight: "normal", cursor: "pointer" }}>
            Cho phép bán lại vé (Resale)
          </label>
        </div>
        <div className="step-three-form-group" style={{ flexDirection: "row", alignItems: "center", gap: "10px", marginTop: "10px" }}>
          <input
            type="checkbox"
            id="allow-gift"
            checked={allowGift}
            onChange={(e) => setAllowGift(e.target.checked)}
            style={{ width: "auto" }}
          />
          <label htmlFor="allow-gift" style={{ marginBottom: 0, fontWeight: "normal", cursor: "pointer" }}>
            Cho phép chuyển nhượng/tặng vé (Gift)
          </label>
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