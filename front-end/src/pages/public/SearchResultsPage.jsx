import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import eventService from "@/services/event.service";
import { EventItemCard } from "@/features/events";

const SearchResultsPage = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const nameQuery = params.get("name");
  const categoryQuery = params.get("category");

  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const data = await eventService.searchEvents({
          name: nameQuery,
          category: categoryQuery,
        });
        setEvents(Array.isArray(data) ? data : data.events || []);
      } catch (err) {
        console.error("Error fetching events:", err);
        setEvents([]);
      }
    };

    fetchEvents();
  }, [nameQuery, categoryQuery]);

  return (
    <div className="search-results-grid">
      <EventItemCard events={events} />
    </div>
  );
};

export default SearchResultsPage;
