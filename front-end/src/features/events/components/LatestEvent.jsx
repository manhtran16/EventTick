import React, { useEffect, useState } from "react";
import "./LatestEvent.css";
import { axiosInstance } from "@/services/apiClient";
import { Link } from "react-router-dom";

const LatestEvent = () => {
  const [weekEvents, setWeekEvents] = useState([]);
  const [monthEvents, setMonthEvents] = useState([]);

  useEffect(() => {
    const fetchLatestEvents = async () => {
      try {
        const today = new Date();

        // --- Week range: Friday to Sunday of current week ---
        const currentDay = today.getDay(); // Sunday=0, Monday=1, ... Friday=5
        const friday = new Date(today);
        friday.setDate(today.getDate() + (5 - currentDay));
        const sunday = new Date(today);
        sunday.setDate(today.getDate() + (7 - currentDay));

        // Only keep the date portion (YYYY-MM-DD)
        const weekFrom = friday.toISOString().split("T")[0];
        const weekTo = sunday.toISOString().split("T")[0];

        // --- Month range: Monday to Sunday of last week of this month ---
        const lastDayOfMonth = new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          0,
        );

        // lastSunday = last day of month
        const lastSunday = new Date(lastDayOfMonth);

        // lastMonday = 10 days before lastSunday
        const lastMonday = new Date(lastSunday);
        lastMonday.setDate(lastSunday.getDate() - 10);

        const monthFrom = lastMonday.toISOString().split("T")[0];
        const monthTo = lastSunday.toISOString().split("T")[0];

        // --- Fetch both in parallel ---
        const [weekRes, monthRes] = await Promise.all([
          axiosInstance.get(
            `/events/latest/week?from=${weekFrom}&to=${weekTo}`,
            { withCredentials: true },
          ),
          axiosInstance.get(
            `/events/latest/month?from=${monthFrom}&to=${monthTo}`,
            { withCredentials: true },
          ),
        ]);

        if (weekRes.data && weekRes.data.success) {
          setWeekEvents(weekRes.data.events || []);
        }
        if (monthRes.data && monthRes.data.success) {
          setMonthEvents(monthRes.data.events || []);
        }
      } catch (err) {
        console.error("Error fetching latest events:", err);
        setWeekEvents([]);
        setMonthEvents([]);
      }
    };

    fetchLatestEvents();
  }, []);

  useEffect(() => {
    const options = document.querySelectorAll(".toggle-option");
    const slider = document.querySelector(".slider");
    const tracks = document.querySelectorAll(".latest-event-carousel-track");

    let currentTrack = document.querySelector(".weekend-track"); // default

    options.forEach((option) => {
      option.addEventListener("click", () => {
        const index = parseInt(option.getAttribute("data-index"));
        slider.style.left = `${index * 50}%`;

        tracks.forEach((t) => t.classList.remove("latest-event-active"));

        if (index === 0) {
          currentTrack = document.querySelector(".weekend-track");
        } else {
          currentTrack = document.querySelector(".month-track");
        }
        currentTrack.classList.add("latest-event-active");
        currentIndex = 0;
        updateCarousel();
      });
    });

    const prevBtn = document.getElementById("prev");
    const nextBtn = document.getElementById("next");
    let currentIndex = 0;
    const visibleItems = 4;

    function updateCarousel() {
      currentTrack.style.transform = `translateX(-${
        currentIndex * (100 / visibleItems)
      }%)`;
    }

    nextBtn.addEventListener("click", () => {
      const items = currentTrack.querySelectorAll(".carousel-item");
      currentIndex = (currentIndex + 1) % (items.length - visibleItems + 1);
      updateCarousel();
    });

    prevBtn.addEventListener("click", () => {
      const items = currentTrack.querySelectorAll(".carousel-item");
      currentIndex =
        (currentIndex - 1 + (items.length - visibleItems + 1)) %
        (items.length - visibleItems + 1);
      updateCarousel();
    });
  }, [weekEvents, monthEvents]);

  return (
    <div className="latest-event-wrapper">
      <div className="toggle-container">
        <div className="toggle-option" data-index={0}>
          Cuối tuần này
        </div>
        <div className="toggle-option" data-index={1}>
          Tháng này
        </div>
        <div className="slider" />
      </div>
      <div className="latest-event-carousel-wrapper">
        {/* Set 1: Cuối tuần này */}
        <div className="latest-event-carousel-track weekend-track latest-event-active">
          {weekEvents.map((item, idx) => (
            <div className="carousel-item" key={item._id || idx}>
              <Link to={`/event/${item._id}`}>
                <img src={item.backgroundImage} alt={item.eventName} />
              </Link>

              <div className="poster-details">
                <p className="latest-event-title">{item.eventName}</p>
                <p className="latest-event-price">
                  🎟 Từ{" "}
                  {new Intl.NumberFormat("vi-VN", {
                    style: "currency",
                    currency: "VND",
                  }).format(Number(item.lowestPrice) || 0)}
                </p>

                <p className="latest-event-date">
                  📅{" "}
                  {new Intl.DateTimeFormat("vi-VN", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  }).format(new Date(item.earliestDate))}
                </p>
              </div>
            </div>
          ))}
        </div>
        {/* Set 2: Tháng này */}
        <div className="latest-event-carousel-track month-track">
          {monthEvents.map((item, idx) => (
            <div className="carousel-item" key={item._id || idx}>
              <Link to={`/event/${item._id}`}>
                <img src={item.backgroundImage} alt={item.eventName} />
              </Link>
              <div className="poster-details">
                <p className="latest-event-title">{item.eventName}</p>
                <p className="latest-event-price">
                  🎟 Từ{" "}
                  {new Intl.NumberFormat("vi-VN", {
                    style: "currency",
                    currency: "VND",
                  }).format(Number(item.lowestPrice) || 0)}
                </p>

                <p className="latest-event-date">
                  📅{" "}
                  {new Intl.DateTimeFormat("vi-VN", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  }).format(new Date(item.earliestDate))}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="latest-event-nav-buttons">
          <button id="prev">❮</button>
          <button id="next">❯</button>
        </div>
      </div>
      <img className="ad-img" src="/img/ad-img.webp" alt="Example" />{" "}
    </div>
  );
};

export default LatestEvent;
