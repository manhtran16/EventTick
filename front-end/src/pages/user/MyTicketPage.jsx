import React, { useEffect, useState } from "react";
import "./MyTicketPage.css";
import { axiosInstance } from "@/services/apiClient";
import { Link } from "react-router-dom";
import { PATHS } from "@/routes/paths";

const MyTicketPage = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const { data } = await axiosInstance.get("/booking/user/tickets");
        setTickets(data.tickets || []);
      } catch (error) {
        console.error("Error fetching tickets:", error);
        setTickets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, []);

  return (
    <div className="container">
      <div className="sidebar">
        <h2>Tài khoản</h2>
        <ul>
          <li>Cài đặt tài khoản</li>
          <li>
            <Link
              to={PATHS.USER_ACCOUNT}
              style={{ textDecoration: "none", color: "#ffffff" }}
            >
              Thông tin tài khoản
            </Link>
          </li>
          <li>
            <strong>Vé của tôi</strong>
          </li>
          <li>
            <Link
              to={PATHS.ADMIN_MY_EVENTS}
              style={{ textDecoration: "none", color: "#ffffff" }}
            >
              Sự kiện của tôi
            </Link>
          </li>
        </ul>
      </div>
      <div className="main">
        <h1>Vé của tôi</h1>
        {loading ? (
          <p>Đang tải vé...</p>
        ) : tickets.length > 0 ? (
          <table border="1" cellPadding="8" className="ticket-table">
            <thead>
              <tr>
                <th>Mã vé</th>
                <th>Sự kiện</th>
                <th>Hạng vé</th>
                <th>Giá vé</th>
                <th>Số lượng</th>
                <th>Trạng thái</th>
                <th>Ngày mua</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket, index) => (
                <tr key={index}>
                  <td>
                    <code style={{ background: "#2a2a2a", padding: "3px 6px", borderRadius: "4px", color: "#4ade80", fontWeight: "bold" }}>
                      {ticket.ticketCode || "—"}
                    </code>
                  </td>
                  <td>
                    <Link
                      style={{ textDecoration: "none", color: "#ffffff" }}
                      to={`/event/${ticket.eventId}`}
                    >
                      {ticket.eventName}
                    </Link>
                  </td>
                  <td>{ticket.ticketName}</td>
                  <td>{Number(ticket.ticketPrice).toLocaleString()} ₫</td>
                  <td>{ticket.quantity}</td>
                  <td>
                    <span style={{
                      color: ticket.rawStatus === "UNUSED" || ticket.status === "Chưa sử dụng" ? "#4ade80" : "#fbbf24",
                      fontWeight: 500
                    }}>
                      {ticket.status}
                    </span>
                  </td>
                  <td>{new Date(ticket.purchaseDate).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="content">
            <p>Bạn chưa có vé nào</p>
            <Link to={PATHS.HOME} className="btn">
              Mua vé ngay
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTicketPage;
