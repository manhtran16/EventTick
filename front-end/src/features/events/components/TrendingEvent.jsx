import React, { useEffect, useState } from "react";
import "./TrendingEvent.css";
import { axiosInstance } from "@/services/apiClient";
import { Link } from "react-router-dom";

const TrendingEvent = () => {
  const [events, setEvents] = useState([]);
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const fetchTrendingEvents = async () => {
      try {
        const today = new Date();
        const threeMonthsLater = new Date(today);
        threeMonthsLater.setMonth(today.getMonth() + 3);

        const from = formatDate(today);
        const to = formatDate(threeMonthsLater);

        // Send as query params
        const response = await axiosInstance.get(
          `/events/trending?from=${from}&to=${to}`,
        );

        if (response.data && response.data.success) {
          setEvents(response.data.events || []);
        } else {
          setEvents([]);
        }
      } catch (error) {
        console.error("Error fetching trending events:", error);
        setEvents([]);
      }
    };

    fetchTrendingEvents();
  }, []);

  useEffect(() => {
    const track = document.querySelector(".trending-event-carousel-track");
    const items = document.querySelectorAll(".trending-event-carousel-item");
    const prevBtn = document.getElementById("trending-event-prev");
    const nextBtn = document.getElementById("trending-event-next");
    const visibleItems = 3.5;
    let currentIndex = 0;

    function updateCarousel() {
      if (track) {
        track.style.transition = "transform 0.5s ease";
        track.style.transform = `translateX(-${
          currentIndex * (100 / visibleItems)
        }%)`;
      }
    }

    const handleNext = () => {
      currentIndex++;
      if (currentIndex > items.length - visibleItems) {
        currentIndex = 0; // loop back to start
      }
      updateCarousel();
    };

    const handlePrev = () => {
      currentIndex--;
      if (currentIndex < 0) {
        currentIndex = items.length - Math.ceil(visibleItems); // loop to end
      }
      updateCarousel();
    };

    if (nextBtn && prevBtn) {
      nextBtn.addEventListener("click", handleNext);
      prevBtn.addEventListener("click", handlePrev);
    }

    return () => {
      if (nextBtn && prevBtn) {
        nextBtn.removeEventListener("click", handleNext);
        prevBtn.removeEventListener("click", handlePrev);
      }
    };
  }, [events]);

  return (
    <>
      <div className="trending-event-carousel-wrapper">
        <p className="trending-event-text">Sự kiện xu hướng</p>
        <div className="trending-event-carousel-track">
          {events.map((item, index) => (
            <div className="trending-event-carousel-item" key={item._id}>
              <div className="trending-event-number-left">{index + 1}</div>
              <Link to={`/event/${item._id}`}>
                <img
                  src={item.bannerUrl || item.backgroundImage}
                  alt={item.title || item.eventName || `Carousel Item ${index + 1}`}
                />
              </Link>
            </div>
          ))}
        </div>
        <div className="trending-event-nav-buttons">
          <button id="trending-event-prev">❮</button>
          <button id="trending-event-next">❯</button>
        </div>
      </div>
    </>
  );
};

export default TrendingEvent;
