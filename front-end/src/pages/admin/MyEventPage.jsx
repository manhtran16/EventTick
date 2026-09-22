import React, { useEffect, useState } from "react";
import "./MyEventPage.css";
import { axiosInstance } from "@/services/apiClient";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PATHS } from "@/routes/paths";

const MyEventPage = () => {
  const { user } = useAuth();
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
        <h2>Tài khoản của {user?.name || user?.userName || user?.username || "tôi"}</h2>
        <ul>
          <li>
            <Link
              to={PATHS.USER_ACCOUNT}
              style={{ textDecoration: "none", color: "#ffffff" }}
            >
              Thông tin tài khoản
            </Link>
          </li>
          <li>
            <Link
              to={PATHS.USER_TICKETS}
              style={{ textDecoration: "none", color: "#ffffff" }}
            >
              Vé của tôi
            </Link>
          </li>
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
                  <th>Trạng thái duyệt</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, index) => {
                  const status = (event.status || "PENDING").toUpperCase();
                  const isApproved = status === "APPROVED";
                  const isRejected = status === "REJECTED";
                  const statusLabel = isApproved ? "Đã phê duyệt" : isRejected ? "Bị từ chối" : "Chờ Admin duyệt";
                  const statusColor = isApproved ? "#4ade80" : isRejected ? "#f87171" : "#fbbf24";
                  const imageSrc = event.thumbnailUrl || event.bannerUrl || event.eventImage;

                  return (
                    <tr key={index}>
                      <td>
                        {imageSrc ? (
                          <img
                            src={imageSrc}
                            alt={event.title || event.eventName}
                            className="my-event-image"
                          />
                        ) : (
                          "No image"
                        )}
                      </td>
                      <td>
                        <Link to={`/event/${event._id}`} className="my-event-link">
                          {event.title || event.eventName}
                        </Link>
                      </td>
                      <td>{event.location || event.eventAddress || event.venueName}</td>
                      <td>
                        <span style={{
                          display: "inline-block",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: 600,
                          backgroundColor: `${statusColor}22`,
                          color: statusColor,
                          border: `1px solid ${statusColor}55`,
                        }}>
                          {statusLabel}
                        </span>
                        {isRejected && event.rejectionReason && (
                          <div style={{ fontSize: "11px", color: "#f87171", marginTop: "4px" }}>
                            Lý do: {event.rejectionReason}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
            <Link to={PATHS.ADMIN_CREATE_EVENT} className="my-event-btn">
              Tạo sự kiện
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyEventPage;
