import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { axiosInstance } from "@/services/apiClient";

const PaymentResult = () => {
  const { orderId } = useParams();
  const [status, setStatus] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrder = async () => {
      const { data } = await axiosInstance.get(
        `/booking/orders/auth/${orderId}`,
      );
      setStatus(data.status);
    };
    fetchOrder();
  }, [orderId]);

  useEffect(() => {
    // 'PENDING','CONFIRMED','FAILED','CANCELLED'
    if (status === "CONFIRMED") {
      navigate(`/payment-done`);
    } else if (status === "FAILED") {
      navigate(`/payment-fail`);
    }
  }, [status, orderId, navigate]);

  if (!status) return <p>Loading...</p>;

  // show processing
  return (
    <div className="payment-page-result">
      {status !== "CONFIRMED" && status !== "FAILED" && (
        <h2>Đơn hàng đang xử lý...</h2>
      )}
    </div>
  );
};

export default PaymentResult;
