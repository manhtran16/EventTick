import { Link } from "react-router-dom";
// chỉ có render ra UI, ko có ảnh hưởng tới hệ thống

const PaymentFailPage = () => {
  return (
    <div>
      <h2>Thanh toán thất bại</h2>
      <p>Đơn hàng của bạn đã bị hủy.</p>

      {/* Link back to home */}
      <Link to="/">Quay về trang chủ</Link>
    </div>
  );
};

export default PaymentFailPage;
