import React, { useEffect, useState } from "react";
import "./SpecialEvent.css"; // cho các sự kiện có isSpecial
import { axiosInstance } from "@/services/apiClient";
import { Link } from "react-router-dom";

const SpecialEvent = () => {
  const [events, setEvents] = useState([]);
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const fetchSpecialEvents = async () => {
      try {
        const today = new Date();
        const timesLater = new Date();
        timesLater.setDate(today.getDate() + 20);

        const from = formatDate(today);
        const to = formatDate(timesLater);
        const response = await axiosInstance.get(
          `/events/in-special?from=${from}&to=${to}`,
        );

        if (response.data && response.data.success) {
          setEvents(response.data.events || []);
        } else {
          setEvents([]);
        }
      } catch (error) {
        console.error("Error fetching special events:", error);
        setEvents([]);
      }
    };

    fetchSpecialEvents();
  }, []);

  useEffect(() => {
    const track = document.querySelector(".special-event-carousel-track");
    const items = document.querySelectorAll(".special-event-carousel-item");
    const prevBtn = document.getElementById("special-event-prev");
    const nextBtn = document.getElementById("special-event-next");
    const visibleItems = 5;
    let currentIndex = 0;

    function updateCarousel() {
      if (track) {
        track.style.transform = `translateX(-${
          currentIndex * (100 / visibleItems)
        }%)`;
      }
    }

    const handleNext = () => {
      currentIndex = (currentIndex + 1) % (items.length - visibleItems + 1);
      updateCarousel();
    };

    const handlePrev = () => {
      currentIndex =
        (currentIndex - 1 + (items.length - visibleItems + 1)) %
        (items.length - visibleItems + 1);
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
      <p className="special-event-text"> Sự kiện đặc biệt </p>
      <div className="special-event-carousel-wrapper">
        <div className="special-event-carousel-track">
          {events.map((item, index) => (
            <div className="special-event-carousel-item" key={index}>
              <Link to={`/event/${item._id}`}>
                <img
                  src={item.backgroundImage}
                  alt={item.eventName || `Carousel Item ${index + 1}`}
                />
              </Link>
            </div>
          ))}
        </div>
        <div className="special-event-nav-buttons">
          <button id="special-event-prev">❮</button>
          <button id="special-event-next">❯</button>
        </div>
      </div>
    </>
  );
};

export default SpecialEvent;
