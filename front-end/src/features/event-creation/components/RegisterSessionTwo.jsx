import React, { useState } from "react";
import "./RegisterEventStep2.css";

const RegisterSessionTwo = ({ onSaveSession, onRemoveSession }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [errors, setErrors] = useState({});

  const [sessionData, setSessionData] = useState({
    eventDate: "",
    startBookingTime: "",
    startTime: "",
    tickets: [],
  });

  const [newTicket, setNewTicket] = useState({
    name: "",
    price: "",
    quantity: "",
    minOrder: "",
    desc: "",
    image: null,
  });

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => {
    setIsModalOpen(false);
    setNewTicket({
      name: "",
      price: "",
      quantity: "",
      minOrder: "",
      desc: "",
      image: null,
    });
  };

  const handleSessionChange = (e) => {
    const { id, value } = e.target;
    setSessionData((prev) => ({ ...prev, [id]: value }));
  };

  const handleTicketChange = (e) => {
    const { id, value } = e.target;
    const map = {
      "new-ticket-name": "name",
      "ticket-price": "price",
      "total-quantity": "quantity",
      "min-order": "minOrder",
      "ticket-desc": "desc",
    };
    setNewTicket((prev) => ({
      ...prev,
      [map[id]]: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewTicket((prev) => ({ ...prev, image: file }));
    }
  };

  const handleSaveTicket = () => {
    const { name, price, quantity, minOrder, desc, image } = newTicket;

    const newErrors = {};

    if (!name) newErrors.name = "Tên vé bắt buộc";
    if (!price) newErrors.price = "Giá vé bắt buộc";
    if (!quantity) newErrors.quantity = "Số lượng vé bắt buộc";
    if (!minOrder) newErrors.minOrder = "Số vé tối thiểu bắt buộc";
    if (!desc) newErrors.desc = "Thông tin vé bắt buộc";
    if (!image) newErrors.image = "Hình ảnh vé bắt buộc";

    // ✅ Check minOrder < quantity
    if (Number(minOrder) >= Number(quantity)) {
      newErrors.minOrder = "Số vé tối thiểu phải nhỏ hơn tổng số lượng vé";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    const updatedTickets = [...tickets, newTicket];
    setTickets(updatedTickets);
    setSessionData((prev) => ({ ...prev, tickets: updatedTickets }));
    closeModal();
  };

  const handleSaveSession = () => {
    const { eventDate, startBookingTime, startTime, tickets } = sessionData;
    const newErrors = {};

    if (!eventDate) newErrors.eventDate = "Ngày sự kiện bắt buộc";
    if (!startTime) newErrors.startTime = "Thời gian bắt đầu bắt buộc";
    if (!startBookingTime)
      newErrors.startBookingTime = "Thời gian đặt vé bắt buộc";
    if (tickets.length === 0) newErrors.tickets = "Phải có ít nhất một loại vé";

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    if (onSaveSession) {
      onSaveSession({
        ...sessionData,
        eventDate: new Date(sessionData.eventDate),
        startBookingTime: new Date(sessionData.startBookingTime),
        startTime: new Date(sessionData.startTime),
      });
    }
  };

  return (
    <>
      <div className="step-two-container">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h2>Suất diễn</h2>
          <button
            className="step-two-close-btn"
            onClick={onRemoveSession}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        <div className="step-two-form-group">
          <label htmlFor="eventDate">Ngày sự kiện</label>
          <input
            type="date"
            id="eventDate"
            value={sessionData.eventDate}
            onChange={handleSessionChange}
          />
          {errors.eventDate && (
            <span className="hihi-error">{errors.eventDate}</span>
          )}
        </div>

        <div className="step-two-form-group">
          <label htmlFor="startTime">Thời gian bắt đầu sự kiện</label>
          <input
            type="datetime-local"
            id="startTime"
            value={sessionData.startTime}
            onChange={handleSessionChange}
          />
          {errors.startTime && (
            <span className="hihi-error">{errors.startTime}</span>
          )}
        </div>

        <div className="step-two-form-group">
          <label htmlFor="startBookingTime">Thời gian bắt đầu đặt vé</label>
          <input
            type="datetime-local"
            id="startBookingTime"
            value={sessionData.startBookingTime}
            onChange={handleSessionChange}
          />
          {errors.startBookingTime && (
            <span className="hihi-error">{errors.startBookingTime}</span>
          )}
        </div>

        {/* Ticket table */}
        <div className="step-two-ticket-types">
          <h3>Loại vé</h3>
          {errors.tickets && (
            <span className="hihi-error">{errors.tickets}</span>
          )}
          <table id="ticketTable">
            <thead>
              <tr>
                <th>Tên vé</th>
                <th>Giá vé </th>
                <th>Tổng số lượng vé</th>
                <th>Số vé tối thiểu trong một đơn hàng</th>
                <th>Thông tin vé</th>
                <th>Hình ảnh vé</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket, index) => (
                <tr key={index}>
                  <td>{ticket.name}</td>
                  <td>{ticket.price}</td>
                  <td>{ticket.quantity}</td>
                  <td>{ticket.minOrder}</td>
                  <td>{ticket.desc}</td>
                  <td>
                    {ticket.image && (
                      <img
                        src={URL.createObjectURL(ticket.image)}
                        alt="ticket"
                        style={{ width: "80px", height: "auto" }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="step-two-actions">
            <button className="step-two-create-ticket" onClick={openModal}>
              Tạo loại vé mới
            </button>
          </div>
        </div>

        <button
          className="step-two-save-session"
          style={{
            backgroundColor: "#00c853",
            color: "#fff",
            marginTop: "20px",
          }}
          onClick={handleSaveSession}
        >
          Lưu suất diễn
        </button>
      </div>

      {/* Modal */}
      <div className={`step-two-modal ${isModalOpen ? "open" : ""}`}>
        <div className="step-two-modal-content">
          <h3>Tạo loại vé mới</h3>
          <div className="step-two-form-group">
            <label htmlFor="new-ticket-name">Tên vé</label>
            <input
              type="text"
              id="new-ticket-name"
              maxLength={50}
              value={newTicket.name}
              onChange={handleTicketChange}
            />
          </div>
          <div className="step-two-form-group">
            <label htmlFor="ticket-price">Giá vé (nhỏ hơn 500.000.000 )</label>
            <input
              type="number"
              id="ticket-price"
              value={newTicket.price}
              onChange={handleTicketChange}
            />
            <span>₫</span>
          </div>
          <div className="step-two-form-group">
            <label htmlFor="total-quantity">Tổng số lượng vé</label>
            <input
              type="number"
              id="total-quantity"
              value={newTicket.quantity}
              onChange={handleTicketChange}
            />
          </div>
          <div className="step-two-form-group">
            <label htmlFor="min-order">
              Số vé tối thiểu trong một đơn hàng
            </label>
            <input
              type="number"
              id="min-order"
              value={newTicket.minOrder}
              onChange={handleTicketChange}
            />
            {errors.minOrder && (
              <span className="hihi-error">{errors.minOrder}</span>
            )}
          </div>
          <div className="step-two-form-group">
            <label htmlFor="ticket-desc">Thông tin vé</label>
            <textarea
              id="ticket-desc"
              rows={4}
              maxLength={1000}
              value={newTicket.desc}
              onChange={handleTicketChange}
            />
          </div>
          <div className="step-two-form-group">
            <label htmlFor="ticket-image">Hình ảnh vé</label>
            <input
              type="file"
              id="ticket-image"
              accept="image/*"
              onChange={handleImageChange}
            />
          </div>
          <div className="step-two-modal-actions">
            <button className="step-two-cancel-btn" onClick={closeModal}>
              Hủy
            </button>
            <button className="step-two-save-btn" onClick={handleSaveTicket}>
              Lưu
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default RegisterSessionTwo;
