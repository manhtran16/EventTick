import React, { useEffect, useState } from "react";
import "./MyEventPage.css";
import { axiosInstance } from "@/services/apiClient";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PATHS } from "@/routes/paths";

const MyEventPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("MY_EVENTS"); // "MY_EVENTS" or "PENDING_APPROVALS"

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await axiosInstance.get("/events/my-event", {
          withCredentials: true, // include cookies/session if needed
        });

        if (response.data && response.data.success) {
          setEvents(response.data.events || []);
        } else {
          setEvents([]);
        }

        // Nếu là ADMIN, tải thêm danh sách chờ duyệt
        if (user?.role === "ADMIN") {
          const resPending = await axiosInstance.get("/events/admin/pending", { withCredentials: true });
          if (resPending.data?.success) {
            setPendingEvents(resPending.data.events || []);
          }
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

  const handleDelete = async (id, title) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa sự kiện "${title}" không?`)) {
      try {
        await axiosInstance.delete(`/events/${id}`, { withCredentials: true });
        alert("Đã xóa sự kiện thành công!");
        setEvents(events.filter(e => e._id !== id));
      } catch (error) {
        console.error(error);
        alert("Lỗi: Không thể xóa sự kiện.");
      }
    }
  };

  const handleUpdate = async (id, oldTitle) => {
    const newTitle = window.prompt("Nhập tên sự kiện mới (Demo chức năng Update API):", oldTitle);
    if (!newTitle || newTitle === oldTitle) return;
    try {
      const formData = new FormData();
      formData.append("data", JSON.stringify({ title: newTitle }));
      await axiosInstance.put(`/events/${id}`, formData, { withCredentials: true });
      alert("Cập nhật thành công!");
      setEvents(events.map(e => e._id === id ? { ...e, title: newTitle, eventName: newTitle } : e));
    } catch (error) {
      console.error(error);
      alert("Lỗi: Không thể cập nhật sự kiện.");
    }
  };

  const handleApprove = async (id) => {
    if (window.confirm("Phê duyệt sự kiện này để xuất bản?")) {
      try {
        await axiosInstance.put(`/events/${id}/approve`, {}, { withCredentials: true });
        alert("Đã phê duyệt sự kiện!");
        setPendingEvents(pendingEvents.filter(e => e._id !== id));
      } catch (err) {
        console.error(err);
        alert("Lỗi khi phê duyệt.");
      }
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt("Nhập lý do từ chối:");
    if (!reason) return;
    try {
      await axiosInstance.put(`/events/${id}/reject`, { reason }, { withCredentials: true });
      alert("Đã từ chối sự kiện!");
      setPendingEvents(pendingEvents.filter(e => e._id !== id));
    } catch (err) {
      console.error(err);
      alert("Lỗi khi từ chối.");
    }
  };

  return (
    <div className="my-event-container">
      <div className="my-event-sidebar">
        <h2>Tài khoản của {user?.name || user?.userName || user?.username || "tôi"}</h2>
        <ul>
          <li>
            <Link to={PATHS.USER_ACCOUNT} style={{ textDecoration: "none", color: "#ffffff" }}>
              Thông tin tài khoản
            </Link>
          </li>
          <li>
            <Link to={PATHS.USER_TICKETS} style={{ textDecoration: "none", color: "#ffffff" }}>
              Vé của tôi
            </Link>
          </li>
          <li onClick={() => setActiveTab("MY_EVENTS")} style={{ cursor: "pointer", fontWeight: activeTab === "MY_EVENTS" ? "bold" : "normal" }}>
            Sự kiện của tôi
          </li>
          {user?.role === "ADMIN" && (
            <li onClick={() => setActiveTab("PENDING_APPROVALS")} style={{ cursor: "pointer", fontWeight: activeTab === "PENDING_APPROVALS" ? "bold" : "normal", color: "#fbbf24" }}>
              Duyệt sự kiện ({pendingEvents.length})
            </li>
          )}
        </ul>
      </div>
      <div className="my-event-main">
        <h1>{activeTab === "MY_EVENTS" ? "Sự kiện của tôi" : "Sự kiện chờ duyệt (Dành cho Admin)"}</h1>
        {loading ? (
          <p>Đang tải...</p>
        ) : activeTab === "MY_EVENTS" ? (
          events.length > 0 ? (
            <div className="my-event-list">
              <table className="my-event-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Tên</th>
                    <th>Địa điểm</th>
                    <th>Trạng thái duyệt</th>
                    <th>Hành động</th>
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
                            <img src={imageSrc} alt={event.title || event.eventName} className="my-event-image" />
                          ) : "No image"}
                        </td>
                        <td>
                          <Link to={`/event/${event._id}`} className="my-event-link">
                            {event.title || event.eventName}
                          </Link>
                        </td>
                        <td>{event.location || event.eventAddress || event.venueName}</td>
                        <td>
                          <span style={{ display: "inline-block", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600, backgroundColor: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}55` }}>
                            {statusLabel}
                          </span>
                          {isRejected && event.rejectionReason && (
                            <div style={{ fontSize: "11px", color: "#f87171", marginTop: "4px" }}>
                              Lý do: {event.rejectionReason}
                            </div>
                          )}
                        </td>
                        <td>
                          <button onClick={() => handleUpdate(event._id, event.title || event.eventName)} style={{ background: "#4caf50", color: "#fff", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", marginRight: "5px", fontSize: "12px" }}>
                            Sửa
                          </button>
                          <button onClick={() => handleDelete(event._id, event.title || event.eventName)} style={{ background: "#f44336", color: "#fff", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
                            Xóa
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="my-event-content">
              <img src="https://via.placeholder.com/300x200.png?text=No+Events" alt="No Events" />
              <p>Bạn chưa có sự kiện nào</p>
              <Link to={PATHS.ADMIN_CREATE_EVENT} className="my-event-btn">Tạo sự kiện</Link>
            </div>
          )
        ) : (
          /* PENDING APPROVALS TAB */
          pendingEvents.length > 0 ? (
            <div className="my-event-list">
              <table className="my-event-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Tên Sự kiện</th>
                    <th>Người tạo</th>
                    <th>Hành động (Admin)</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingEvents.map((event, index) => {
                    const imageSrc = event.thumbnailUrl || event.bannerUrl;
                    return (
                      <tr key={index}>
                        <td>
                          {imageSrc ? <img src={imageSrc} alt={event.title} className="my-event-image" /> : "No image"}
                        </td>
                        <td>
                          <strong>{event.title}</strong>
                          <br />
                          <span style={{ fontSize: "12px", color: "#888" }}>{event.category}</span>
                        </td>
                        <td>
                          {event.organizerId?.fullName || event.organizerName || "Unknown"}
                        </td>
                        <td>
                          <button onClick={() => handleApprove(event._id)} style={{ background: "#4ade80", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", marginRight: "5px", fontSize: "12px", fontWeight: "bold" }}>
                            ✓ Duyệt
                          </button>
                          <button onClick={() => handleReject(event._id)} style={{ background: "#f87171", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>
                            ✕ Từ chối
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ marginTop: "20px" }}>Tuyệt vời! Không có sự kiện nào đang chờ duyệt.</p>
          )
        )}
      </div>
    </div>
  );
};

export default MyEventPage;
