import React, { useEffect, useState } from "react";
import "./ForYou.css";
import { axiosInstance } from "@/services/apiClient";
import { Link } from "react-router-dom";

const ForYou = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // Fetch recommended events once
    const fetchEvents = async () => {
      try {
        const { data } = await axiosInstance.get("/events/recommend");
        console.log(data);
        setEvents(data.events || []);
      } catch (err) {
        console.error("Failed to fetch events:", err.message);
      }
    };
    fetchEvents();
  }, []); // <-- empty array so it runs only once

  useEffect(() => {
    // Carousel logic depends on events length
    const track = document.querySelector(".for-you-carousel-track");
    const prevBtn = document.getElementById("for-you-prev");
    const nextBtn = document.getElementById("for-you-next");
    const visibleItems = 4;
    let currentIndex = 0;

    function updateCarousel() {
      if (track) {
        track.style.transform = `translateX(-${currentIndex * (100 / visibleItems)}%)`;
      }
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        currentIndex = (currentIndex + 1) % (events.length - visibleItems + 1);
        updateCarousel();
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        currentIndex =
          (currentIndex - 1 + (events.length - visibleItems + 1)) %
          (events.length - visibleItems + 1);
        updateCarousel();
      });
    }

    // Cleanup listeners when events change or component unmounts
    return () => {
      if (nextBtn) nextBtn.replaceWith(nextBtn.cloneNode(true));
      if (prevBtn) prevBtn.replaceWith(prevBtn.cloneNode(true));
    };
  }, [events]);

  return (
    <>
      <p className="for-you-text"> Dành cho bạn</p>

      <div className="for-you-carousel-wrapper">
        <div className="for-you-carousel-track">
          {events.map((event) => (
            <div className="for-you-carousel-item" key={event._id}>
              <Link to={`/event/${event._id}`}>
                <img src={event.backgroundImage} alt={event.eventName} />
              </Link>

              <div className="for-you-poster-details">
                <p className="for-you-title">{event.eventName}</p>
                <p className="for-you-price">
                  🎟 Từ{" "}
                  {new Intl.NumberFormat("vi-VN", {
                    style: "currency",
                    currency: "VND",
                  }).format(Number(event.lowestPrice) || 0)}
                </p>

                <p className="for-you-date">
                  📅{" "}
                  {new Intl.DateTimeFormat("vi-VN", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  }).format(new Date(event.earliestDate))}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="for-you-nav-buttons">
          <button id="for-you-prev">❮</button>
          <button id="for-you-next">❯</button>
        </div>
      </div>
    </>
  );
};

export default ForYou;
