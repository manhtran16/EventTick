import "./EventDetails.css";
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { axiosInstance } from "@/services/apiClient";
import { Link } from "react-router-dom";

const EventDetails = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  //
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await axiosInstance.get(`/events/${eventId}`, {
          withCredentials: true,
        });
        if (res.data.success) {
          setEvent(res.data.event);
          console.log(res.data.event);
        }
      } catch (err) {
        console.error("Error fetching event:", err);
      }
    };
    fetchEvent();
  }, [eventId]);

  const toggleText = () => setIsExpanded((prev) => !prev);

  if (!event) return <p>Loading...</p>;

  // --- Transformations ---
  // Event name
  const eventName = event.eventName;
  const backgroundImage = event.backgroundImage;
  const priceFrom = event.lowestPrice;

  // Most recent session
  const recentSession =
    event.sessions.length > 0
      ? event.sessions[event.sessions.length - 1]
      : null;

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const recentTime =
    recentSession &&
    `${formatTime(recentSession.startTime)} - ${formatTime(
      new Date(
        new Date(recentSession.startTime).getTime() + 3 * 60 * 60 * 1000, // example duration
      ),
    )}, ${formatDate(recentSession.eventDate)}`;

  // Venue
  const venue = event.venueName;

  // Full description
  const fullText = event.eventDesc || "";
  const cutText = fullText.substring(0, 70) + "...";

  // First session for schedule
  const firstSession = event.sessions[0];
  const weekdayMap = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const weekday =
    firstSession && weekdayMap[new Date(firstSession.eventDate).getDay()];

  const firstSessionTime =
    firstSession &&
    `${formatTime(firstSession.startTime)} - ${formatTime(
      new Date(new Date(firstSession.startTime).getTime() + 3 * 60 * 60 * 1000),
    )}, ${weekday}`;

  const firstSessionDate = firstSession && formatDate(firstSession.eventDate);

  return (
    <>
      <div className="ticket">
        <div className="ticket-left">
          <div>
            <h2>{eventName}</h2>

            <p>
              <strong>Thời gian:</strong> {recentTime}
            </p>
            <p>
              <strong>Địa điểm:</strong> {venue}
            </p>
            <p>
              <strong>Giá vé:</strong> Từ{" "}
              {new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
              }).format(priceFrom)}
            </p>
          </div>
        </div>
        <div className="ticket-right">
          <img src={backgroundImage} alt="" />
        </div>
      </div>

      <div className="event-details-intro-container">
        <div className="event-intro-header">
          <h3>Giới thiệu</h3>
        </div>
        <div className="event-intro-body">
          <h2>{eventName}</h2>
          <div
            id="event-intro-text"
            dangerouslySetInnerHTML={{
              __html: isExpanded ? fullText : cutText,
            }}
          />
          <button className="event-intro-expand-btn" onClick={toggleText}>
            {isExpanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      <div className="event-details-intro-container">
        <div className="event-intro-header">
          <h3>Lịch diễn</h3>
          <div style={{ clear: "both" }} />
        </div>
        <div className="ticket-full-details">
          {event.sessions.map((session, idx) => {
            const weekday = weekdayMap[new Date(session.eventDate).getDay()];

            // Normalize dates to compare only calendar day
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const sessionDate = new Date(session.eventDate);
            sessionDate.setHours(0, 0, 0, 0);

            const hasEnded = sessionDate < today;

            return (
              <div className="ticket-details-container" key={idx}>
                <div className="event-time">
                  <h2>
                    {formatTime(session.startTime)} -{" "}
                    {formatTime(
                      new Date(
                        new Date(session.startTime).getTime() +
                          3 * 60 * 60 * 1000,
                      ),
                    )}
                    , {weekday}
                  </h2>
                  <p>
                    {formatDate(session.eventDate)}
                    {hasEnded && (
                      <span className="session-ended-tag">
                        Suất diễn đã diễn ra
                      </span>
                    )}
                  </p>
                </div>

                {hasEnded ? (
                  <button
                    className="ticket-details-buy-button disabled"
                    disabled
                  >
                    Mua vé ngay
                  </button>
                ) : (
                  <Link
                    to={`/event/seats/${eventId}`}
                    className="ticket-details-buy-button"
                  >
                    Mua vé ngay
                  </Link>
                )}

                <div className="ticket-info">
                  <h3>Thông tin vé</h3>
                  {session.tickets.map((ticket, tIdx) => (
                    <div className="ticket-option tk-framed" key={tIdx}>
                      <span className="ticket-type">{ticket.name}</span>
                      <span className="ticket-price">
                        {ticket.price.toLocaleString()} đ
                      </span>
                      <span className="ticket-slot">
                        {ticket.soldOut !== undefined
                          ? ticket.soldOut === "false"
                            ? "còn vé"
                            : "hết vé"
                          : "còn vé"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="event-details-intro-container">
        <div className="event-intro-header">
          <h3>Ban tổ chức</h3>
        </div>
        <div className="event-intro-body">
          <div
            id="event-intro-text"
            dangerouslySetInnerHTML={{ __html: event.organizerInfo }}
          />{" "}
        </div>
      </div>
    </>
  );
};

export default EventDetails;
