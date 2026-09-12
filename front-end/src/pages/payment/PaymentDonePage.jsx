import { Link } from "react-router-dom";
// chỉ có render ra UI, ko có ảnh hưởng tới hệ thống
const PaymentDonePage = () => (
  <div className="payment-done">
    <h2>Vé đã thanh toán thành công, check Gmail của bạn để xác nhận nhé!</h2>
    <Link to="/">Quay về trang chủ</Link>
  </div>
);
export default PaymentDonePage;
