import React, { useEffect, useState } from "react";
import "./MyEventPage.css";
import { axiosInstance } from "@/services/apiClient";

const MyEventPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await axiosInstance.get("/events/my-event", {
          withCredentials: true, // include cookies/session if needed
        });

        // assuming backend returns { success: true, events: [...] }
        if (response.data && response.data.success) {
          setEvents(response.data.events || []);
        } else {
          setEvents([]);
        }
      } catch (error) {
        if (
          error.response &&
          error.response.status >= 400 &&
          error.response.status < 500
        ) {
          console.log("Redirecting to home due to 4xx error");
          window.location.href = "/";
        } else {
          console.error("Error fetching events:", error);
          setEvents([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  return (
    <div className="my-event-container">
      <div className="my-event-sidebar">
        <h2>Tài khoản của Tâm Chu Minh</h2>
        <ul>
          <li>Cài đặt tài khoản</li>
          <li>Thông tin tài khoản</li>
          <li>Vé của tôi</li>
          <li>
            <strong>Sự kiện của tôi</strong>
          </li>
        </ul>
      </div>
      <div className="my-event-main">
        <h1>Sự kiện của tôi</h1>
        {loading ? (
          <p>Đang tải sự kiện...</p>
        ) : events.length > 0 ? (
          <div className="my-event-list">
            <table className="my-event-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Tên</th>
                  <th>Địa điểm</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, index) => (
                  <tr key={index}>
                    <td>
                      {event.eventImage ? (
                        <img
                          src={event.eventImage}
                          alt={event.eventName}
                          className="my-event-image"
                        />
                      ) : (
                        "No image"
                      )}
                    </td>
                    <td>
                      <a href={`/event/${event._id}`} className="my-event-link">
                        {event.eventName}
                      </a>
                    </td>
                    <td>{event.eventAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="my-event-content">
            <img
              src="https://via.placeholder.com/300x200.png?text=Sunset+Illustration"
              alt="Sunset Illustration"
            />
            <p>Bạn chưa có sự kiện nào</p>
            <a href="/" className="my-event-btn">
              Tạo sự kiện
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyEventPage;
