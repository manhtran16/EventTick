import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { axiosInstance } from "@/services/apiClient";
import { io } from "socket.io-client";
import "./RealtimeEventDetailsPage.css";
import { CartItem } from "@/features/booking";

const RealtimeEventDetails = () => {
  const navigate = useNavigate();
  const { eventId } = useParams();

  function generateOrderId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `ORD-${timestamp}-${random}`;
  }

  const [orderKey] = useState(generateOrderId());
  const [event, setEvent] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [note, setNote] = useState("Ấn tiếp tục để thanh toán. Số lượng vé mang tính chất tham khảo.");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notification, setNotification] = useState(""); // ✅ new state

  const paymentOptions = [
    { id: "credit card", label: "Credit Card" },
    { id: "chuyển khoản", label: "Chuyển Khoản" },
  ];

  useEffect(() => {
    if (!eventId) return;

    const fetchEvent = async () => {
      try {
        const res = await axiosInstance.get(`/seats/${eventId}`);

        setEvent(res.data.event);
      } catch (err) {
        if (
          err.response &&
          err.response.status >= 400 &&
          err.response.status < 500
        ) {
          window.location.href = `/login?returnTo=/event/seats/${eventId}`;
        } else {
          console.error("Error fetching event:", err);
        }
      }
    };
    fetchEvent();

    const socket = io("http://localhost:3000", { withCredentials: true });
    socket.emit("join_event_room", eventId);

    socket.on("event_stock_update", (payload) => {
      setEvent((prev) => {
        if (!prev) return prev;

        // Create a shallow copy of sessions
        const nextSessions = prev.sessions.map((session) => {
          const updatedTickets = session.tickets.map((ticket) => {
            const update = payload.items.find(
              (u) => u.ticketId === ticket._id.toString(),
            );
            if (update) {
              return {
                ...ticket,
                numberOfTicketLeft: update.numberOfTicketLeft,
              };
            }
            return ticket;
          });
          return { ...session, tickets: updatedTickets };
        });

        return { ...prev, sessions: nextSessions };
      });
    });

    return () => {
      socket.emit("leave_event_room", eventId);
      socket.off("event_stock_update");
    };
  }, [eventId]);

  const handleQuantityChange = (id, newQuantity) => {
    setCartItems((prev) =>
      newQuantity === 0
        ? prev.filter((item) => item.id !== id)
        : prev.map((item) =>
            item.id === id ? { ...item, quantity: newQuantity } : item,
          ),
    );
  };

  const handleAddToCart = (session, ticket) => {
    const ticketProp = `${new Date(session.eventDate).toLocaleDateString("vi-VN")} , ${new Date(
      session.startTime,
    ).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })}`;

    setCartItems((prev) => {
      const existingItem = prev.find(
        (item) =>
          item.ticketId === ticket._id && item.ticketProp === ticketProp,
      );

      if (existingItem) {
        return prev.map((item) =>
          item.ticketId === ticket._id && item.ticketProp === ticketProp
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      } else {
        const newItem = {
          id: Date.now(),
          sessionId: session._id,
          ticketId: ticket._id,
          ticketProp,
          ticketName: ticket.name,
          ticketPrice: ticket.price,
          quantity: 1,
        };
        return [...prev, newItem];
      }
    });
  };

  const handleDelete = (id) => {
    setCartItems(cartItems.filter((item) => item.id !== id));
  };

  const grandTotal = cartItems.reduce(
    (sum, item) => sum + item.quantity * item.ticketPrice,
    0,
  );

  const handleClick = async () => {
    if (cartItems.length > 0 && paymentMethod) {
      try {
        const payload = {
          cartItems: cartItems
            .filter((item) => item.quantity > 0)
            .map((item) => ({
              sessionId: item.sessionId,
              ticketId: item.ticketId,
              quantity: item.quantity,
            })),
          paymentMethod,
          orderKey,
        };

        const res = await axiosInstance.post(
          `/booking/carts/${eventId}`,
          payload,
        );

        // ✅ Success case
        if (res.data.success) {
          setNotification("Hệ thống đang chuyển sang trang thanh toán...");
          setCartItems([]);
          setPaymentMethod("");

          setTimeout(() => {
            navigate(`/payment/${res.data.orderId}`);
          }, 2000);
        } else {
          // This branch is rare, but handle gracefully
          setNote(res.data.message || "Có lỗi xảy ra khi thanh toán");
        }
      } catch (err) {
        // ✅ Error case: catch controller-thrown errors
        if (err.response && err.response.data) {
          // The controller sends { success: false, message: "Event not found" }
          setNote(err.response.data.message || "Có lỗi xảy ra khi thanh toán");
        } else {
          // Network or unexpected error
          setNote("Có lỗi xảy ra khi kết nối tới server");
        }
        console.error("Error submitting order:", err);
      }
    } else {
      setNote("Vui lòng chọn phương thức thanh toán và mua ít nhất 1 vé");
    }
  };

  const backToHomeAlert = () => {
    const userChoice = window.confirm(
      "Giỏ hàng sẽ bị xóa, bạn có muốn trở về trang chủ?",
    );
    if (userChoice) {
      window.location.href = "/";
    }
  };

  if (!event) return <div>Loading...</div>;

  return (
    <div className="real-time-event-container">
      <div className="real-time-event-main">
        <div className="real-time-event-title">
          <button
            className="back-to-event-detail-btn"
            onClick={backToHomeAlert}
          >
            ❮
          </button>
          {event.eventName}
        </div>

        {event.sessions?.map((session, sIndex) => (
          <div key={sIndex} className="real-time-event-section">
            <div className="real-time-event-place">📍{event.venueName}</div>
            <div className="real-time-event-time">
              📅 {new Date(session.eventDate).toLocaleDateString("vi-VN")}⏰
              {new Date(session.startTime).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </div>
            <table className="real-time-event-ticket-table">
              <thead>
                <tr>
                  <th>Loại vé</th>
                  <th>Giá</th>
                  <th>Mô tả</th>
                  <th>Số lượng còn lại</th>
                  <th>Mua</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {session.tickets?.map((ticket) => (
                  <tr key={ticket._id}>
                    {/* ✅ use ticket._id instead of tIndex */}
                    <td>{ticket.name}</td>
                    <td>{ticket.price.toLocaleString()} ₫</td>
                    <td style={{ fontSize: "smaller" }}>{ticket.desc}</td>
                    <td>{ticket.numberOfTicketLeft}</td>
                    <td>
                      <button
                        className="real-time-event-button-adding-btn"
                        onClick={() => handleAddToCart(session, ticket)}
                      >
                        Thêm
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="real-time-event-sidebar">
        <div className="real-time-event-card">
          <div className="real-time-event-title">Phương thức thanh toán</div>
          <div className="payment-methods-container">
            {paymentOptions.map((option) => (
              <button
                key={option.id}
                className={`payment-method-btn ${paymentMethod === option.id ? "selected" : ""}`}
                onClick={() => setPaymentMethod(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="real-time-event-title">Thông tin đặt vé</div>
          <table className="real-time-event-table">
            <tbody>
              <tr>
                <td>Thời gian</td>
                <td>Loại vé</td>
                <td>Giá vé</td>
                <td>Số lượng</td>
                <td>Thành tiền</td>
                <td>Xóa</td>
              </tr>
              {cartItems.map((item) => (
                <CartItem
                  key={item.id}
                  id={item.id}
                  ticketProp={item.ticketProp}
                  ticketName={item.ticketName}
                  ticketPrice={item.ticketPrice}
                  quantity={item.quantity}
                  onDelete={() => handleDelete(item.id)}
                  onQuantityChange={handleQuantityChange}
                />
              ))}
            </tbody>
          </table>
          <div className="real-time-event-total">
            Tổng: {grandTotal.toLocaleString()} ₫
          </div>
          <div className="real-time-event-note">{note}</div>

          {/* ✅ Notification banner */}
          {notification && (
            <div className="notification-banner">{notification}</div>
          )}

          <button
            className="real-time-event-button-submit-btn"
            onClick={handleClick}
          >
            Tiếp tục
          </button>
        </div>
      </div>
    </div>
  );
};

export default RealtimeEventDetails;
