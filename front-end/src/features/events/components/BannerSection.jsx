import React, { useEffect, useState } from "react";
import "./BannerSection.css";
import { axiosInstance } from "@/services/apiClient";
import { Link } from "react-router-dom";

const BannerSection = () => {
  const [events, setEvents] = useState([]);
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const today = new Date();
        const timesLater = new Date();
        timesLater.setDate(today.getDate() + 7);

        const from = formatDate(today);
        const to = formatDate(timesLater);

        // Send as query params
        const { data } = await axiosInstance.get(
          `/events/in-banner?from=${from}&to=${to}`,
        );

        if (Array.isArray(data)) {
          setEvents(data);
        } else if (Array.isArray(data?.events)) {
          setEvents(data.events);
        }
      } catch (err) {
        console.error("Error fetching banner events:", err);
      }
    };
    fetchEvents();
  }, []);
  useEffect(() => {
    const track = document.querySelector(".a-carousel-track");
    const items = document.querySelectorAll(".a-carousel-item");
    const prevBtn = document.getElementById("banner-section-prev");
    const nextBtn = document.getElementById("banner-section-next");
    let currentIndex = 0;

    function updateDots() {
      const dots = document.querySelectorAll(".a-carousel-dots .dot");
      dots.forEach((dot, idx) => {
        dot.classList.toggle("active", idx === currentIndex);
      });
    }

    function updateCarousel() {
      if (track) {
        track.style.transform = `translateX(-${currentIndex * 50}%)`;
        updateDots(); // <-- keep this here
      }
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        currentIndex = (currentIndex + 1) % (items.length - 1);
        updateCarousel();
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        currentIndex =
          (currentIndex - 1 + (items.length - 1)) % (items.length - 1);
        updateCarousel();
      });
    }

    // initialize dots on mount
    updateDots();
  }, [events]);

  return (
    <div>
      <div className="a-carousel-wrapper">
        <div className="a-carousel-track">
          {events.map((item, idx) => (
            <div className="a-carousel-item" key={idx}>
              <img src={item.backgroundImage} alt={item.eventName || "Event"} />
              <Link to={`/event/${item._id}`}>
                <button className="a-carousel-button">Xem chi tiết</button>
              </Link>
            </div>
          ))}
        </div>

        <div className="a-nav-buttons">
          <button id="banner-section-prev">❮</button>
          <button id="banner-section-next">❯</button>
        </div>

        {/* Dot indicators */}
        <div className="a-carousel-dots">
          {events.slice(0, 5).map((_, idx) => (
            <span
              key={idx}
              className={`dot ${idx === 0 ? "active" : ""}`}
            ></span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BannerSection;
