import React from "react";
import "./EventItemCard.css";
import { Link } from "react-router-dom";

const EventItemCard = ({ events }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // normalize today

  return (
    <div className="item-card-wrapper">
      <p className="item-card-text">Kết quả tìm kiếm</p>
      <div className="item-card-grid">
        {events.map((item) => {
          // Format price
          const price = isNaN(Number(item.lowestPrice))
            ? 0
            : Number(item.lowestPrice);
          const formattedPrice = new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
          }).format(price);

          // Format earliest date
          const formattedDate = item.earliestDate
            ? new Intl.DateTimeFormat("vi-VN", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              }).format(new Date(item.earliestDate))
            : "Chưa xác định";

          // Safely parse lastDate
          let hasEnded = false;
          if (item.lastDate) {
            const lastDate = new Date(item.lastDate);
            if (!isNaN(lastDate)) {
              lastDate.setHours(0, 0, 0, 0);
              hasEnded = lastDate < today;
            }
          }

          return (
            <div className="item-card" key={item._id}>
              <Link
                to={`/event/${item._id}`}
                className="item-card-image-wrapper"
              >
                <img
                  className="item-card-image"
                  src={item.backgroundImage}
                  alt={item.eventName}
                />
                {hasEnded && (
                  <span className="item-card-ended">Đã diễn ra</span>
                )}
              </Link>

              <div className="item-card-details">
                <Link to={`/event/${item._id}`} className="item-card-title">
                  {item.eventName}
                </Link>
                <p className="item-card-price">🎟 {formattedPrice}</p>
                <p className="item-card-date">📅 {formattedDate}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EventItemCard;
