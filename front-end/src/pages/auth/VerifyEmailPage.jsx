import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authService } from "@/services/auth.service";
import { PATHS } from "@/routes/paths";
import "./VerifyEmailPage.css";

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");

  const [resendEmail, setResendEmail] = useState("");
  const [resendMsg, setResendMsg] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setSuccess(false);
      setMessage("Không tìm thấy mã xác thực (token) trong liên kết.");
      return;
    }

    const doVerify = async () => {
      try {
        const res = await authService.verifyEmail(token);
        if (res?.success) {
          setSuccess(true);
          setMessage(res.message || "Tài khoản của bạn đã được kích hoạt thành công!");
        } else {
          setSuccess(false);
          setMessage(res?.message || "Mã xác thực không hợp lệ hoặc đã hết hạn.");
        }
      } catch (err) {
        setSuccess(false);
        setMessage(err.response?.data?.message || "Xác thực email thất bại hoặc mã đã hết hạn.");
      } finally {
        setLoading(false);
      }
    };

    doVerify();
  }, [token]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;
    setResending(true);
    setResendMsg("");
    try {
      const res = await authService.resendVerification(resendEmail.trim());
      setResendMsg(res?.message || "Đã gửi lại email kích hoạt!");
    } catch (err) {
      setResendMsg(err.response?.data?.message || "Không thể gửi lại email. Vui lòng thử lại sau.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="verify-container">
      <h2 className="verify-header">Xác thực tài khoản</h2>
      <div className="verify-body">
        {loading ? (
          <div>
            <div className="verify-icon">⏳</div>
            <p className="verify-msg">Đang tiến hành xác thực tài khoản của bạn, vui lòng đợi trong giây lát...</p>
          </div>
        ) : success ? (
          <div>
            <div className="verify-icon">🎉</div>
            <p className="verify-msg" style={{ color: "#2e7d32", fontWeight: "bold" }}>
              {message}
            </p>
            <Link to={PATHS.LOGIN} className="verify-btn">
              Đăng nhập ngay
            </Link>
          </div>
        ) : (
          <div>
            <div className="verify-icon">❌</div>
            <p className="verify-msg" style={{ color: "#c62828" }}>
              {message}
            </p>

            <div className="resend-box">
              <p style={{ fontWeight: "bold", margin: "0 0 8px 0" }}>Gửi lại email kích hoạt:</p>
              <form onSubmit={handleResend}>
                <input
                  type="email"
                  placeholder="Nhập địa chỉ email của bạn"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  required
                />
                <button type="submit" disabled={resending}>
                  {resending ? "Đang gửi..." : "Gửi lại link kích hoạt"}
                </button>
              </form>
              {resendMsg && (
                <p style={{ fontSize: "13px", marginTop: "8px", color: "#1565c0" }}>{resendMsg}</p>
              )}
            </div>

            <div style={{ marginTop: "20px" }}>
              <Link to={PATHS.LOGIN} className="verify-btn" style={{ background: "#757575" }}>
                Quay lại trang Đăng nhập
              </Link>
            </div>
          </div>
        )}

        <p className="verify-home-link">
          <Link to={PATHS.HOME}>← Trở lại trang chủ</Link>
        </p>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
