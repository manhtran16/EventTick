import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { axiosInstance } from "@/services/apiClient";
import { CheckoutForm } from "@/features/booking";
const stripePromise = loadStripe(
  "pk_test_51TCo3vLQFS3jAyI96UZpq2ErLhmCSwb2Sn4pW70qDJCHZDSjSJbNOB87gNDvJ6mZRvQqdhini8hXpcLErO7eVPay005OefiohA",
);

const PaymentPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [clientSecret, setClientSecret] = useState(null);
  const [order, setOrder] = useState(null);
  const [orderItems, setOrderItems] = useState(null);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60 * 5); // seconds
  const [timerActive, setTimerActive] = useState(true);
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const stopTimer = () => {
    setTimerActive(false);
  };

  useEffect(() => {
    const fetchClientSecret = async () => {
      try {
        const { data } = await axiosInstance.post(
          "/booking/create-payment-intent",
          {
            orderId,
          },
        );
        if (data.alreadyPaid || data.zeroOrder) {
          navigate(`/payment-done`);
        }
        if (data.success) {
          setClientSecret(data.clientSecret);
          setOrder(data.order);
          setOrderItems(data.orderItems);
        } else {
          setError("Đơn hàng không hợp lệ.");
        }
      } catch (err) {
        console.error("Payment error:", err);
        setError("Tải thanh toán lỗi.");
      }
    };
    fetchClientSecret();
  }, [orderId, navigate]);

  // Countdown timer
  useEffect(() => {
    if (!order || !timerActive) return;
    if (timeLeft <= 0) {
      const timeoutOrder = async () => {
        // Show non-blocking message
        setShowTimeoutMessage(true);

        // After 2 seconds, hide message and fetch
        setTimeout(async () => {
          setShowTimeoutMessage(false);
          try {
            const { data } = await axiosInstance.get(
              `/payment/timeout/${orderId}`,
            );
            if (data.success) {
              navigate(`/event/${order.event_id}`);
            }
          } catch (err) {
            console.error("Timeout error:", err);
          }
        }, 2000);
      };
      timeoutOrder();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, order, orderId, navigate, timerActive]);

  const options = { clientSecret };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="payment-page">
      <button
        onClick={() => navigate("/")}
        style={{
          top: "10px",
          right: "10px",
          background: "transparent",
          border: "none",
          fontSize: "24px",
          cursor: "pointer",
          color: "white",
        }}
        aria-label="Close"
      >
        ×
      </button>

      <h2>Thanh toán đơn hàng</h2>
      <button
        onClick={async () => {
          try {
            const { data } = await axiosInstance.get(
              `/payment/success/${orderId}`,
            );
            if (data.success) {
              navigate(`/payment-done`);
            }
          } catch (err) {
            console.error("Success test error:", err);
          }
        }}
      >
        thanh toán thành công, for testing
      </button>

      <button
        onClick={async () => {
          try {
            const { data } = await axiosInstance.get(
              `/payment/failure/${orderId}`,
            );
            if (data.success) {
              navigate(`/payment-fail`);
            }
          } catch (err) {
            navigate(`/payment-err`);
          }
        }}
      >
        thanh toán thất bại, for testing
      </button>

      <p style={{ color: "red" }}>
        {" "}
        ⏳ Thời gian còn lại để thanh toán:
        <strong> {formatTime(timeLeft)}</strong>
      </p>
      {/* Non-blocking timeout message */}
      {showTimeoutMessage && (
        <div
          style={{
            background: "red",
            color: "white",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          Hết thời gian thanh toán
        </div>
      )}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {order && (
        <table border="1" cellPadding="8" style={{ marginBottom: "20px" }}>
          <thead>
            <tr>
              <th>Ticket Name</th>
              <th>Price (VND)</th>
              <th>Quantity</th>
              <th>Subtotal (VND)</th>
            </tr>
          </thead>
          <tbody>
            {orderItems.map((item) => (
              <tr key={item.ticket_id}>
                <td>{item.ticketName}</td>
                <td>{item.ticketPrice}</td>
                <td>{item.quantity}</td>
                <td>{item.ticketPrice * item.quantity}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="3" style={{ textAlign: "right" }}>
                <strong>Total:</strong>
              </td>
              <td>
                <strong>{order.totalPrice}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      )}
      {clientSecret && order && (
        <Elements stripe={stripePromise} options={options}>
          {order.paymentMethod === "credit card" ? (
            <CheckoutForm stopTimer={stopTimer} orderId={orderId} />
          ) : order.paymentMethod === "chuyển khoản" ? (
            <div>
              <h3>Hướng dẫn chuyển khoản</h3>
              <p>
                Vui lòng chuyển khoản tới tài khoản <strong>000000000</strong>{" "}
                tại Vietcombank (Test User). Số tiền: {order.totalPrice} VND
              </p>
              <img
                src="https://img.vietqr.io/image/vietinbank-113366668888-compact.jpg?amount=10000&addInfo=Test&accountName=Demo"
                alt="Demo VietQR Bank Transfer"
                style={{ width: "250px", height: "250px" }}
              />
            </div>
          ) : null}
        </Elements>
      )}
    </div>
  );
};

export default PaymentPage;
