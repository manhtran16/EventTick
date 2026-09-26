import React, { useState, useEffect } from "react";
import apiClient from "@/services/apiClient";
import "./FeaturedStars.css";

const FeaturedStars = () => {
  const [stars, setStars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStars = async () => {
      try {
        const response = await apiClient.get("/users/top-stars");
        if (response.data && response.data.success) {
          setStars(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching top stars:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStars();
  }, []);

  if (loading) return null; // Or a loading spinner

  if (stars.length === 0) return null; // Don't show the section if no stars

  return (
    <div className="featured-stars-container">
      <div className="featured-stars-header">
        <h2 className="featured-stars-title">⭐ Featured Stars</h2>
        <a href="#" className="featured-stars-link">Xem thêm {">"}</a>
      </div>
      
      <div className="featured-stars-grid">
        {stars.map((star, index) => (
          <div className="star-item" key={star._id || index}>
            <div className="star-avatar-wrapper">
              <img src={star.image} alt={star.name} className="star-avatar" />
            </div>
            <p className="star-name">
              {star.name}
              {star.isVerified && <span className="verified-tick">✔</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeaturedStars;
