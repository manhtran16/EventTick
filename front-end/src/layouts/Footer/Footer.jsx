import React from "react";
import "./Footer.css";

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        {/* Column 1: Contact */}
        <div className="footer-column">
          <h3>Hotline</h3>
          <p>📞 Thứ 2 - Chủ Nhật (8:00 - 23:00)</p>
          <p className="highlight">1900.6408</p>
          <h3>Email</h3>
          <p>📧 support@ticketbox.vn</p>
          <h3>Văn phòng chính</h3>
          <p>
            📍 Tầng 12, Tòa nhà Viettel,
            <br />
            285 Cách Mạng Tháng Tám,
            <br />
            Phường Hòa Hưng, TP. Hồ Chí Minh
          </p>
        </div>

        {/* Column 2: Customers / Organizers */}
        <div className="footer-column">
          <h3>Dành cho Khách hàng</h3>
          <p>
            <a href="#">Điều khoản sử dụng cho khách hàng</a>
          </p>
          <h3>Dành cho Ban Tổ chức</h3>
          <p>
            <a href="#">Điều khoản sử dụng cho ban tổ chức</a>
          </p>
        </div>

        {/* Column 3: Company Policies */}
        <div className="footer-column">
          <h3>Về công ty chúng tôi</h3>
          <p>
            <a href="#">Quy chế hoạt động</a>
          </p>
          <p>
            <a href="#">Chính sách bảo mật thông tin</a>
          </p>
          <p>
            <a href="#">Cơ chế giải quyết tranh chấp/ khiếu nại</a>
          </p>
          <p>
            <a href="#">Chính sách bảo mật thanh toán</a>
          </p>
          <p>
            <a href="#">Chính sách đổi trả và kiểm hàng</a>
          </p>
          <p>
            <a href="#">Điều kiện vận chuyển và giao nhận</a>
          </p>
          <p>
            <a href="#">Phương thức thanh toán</a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
