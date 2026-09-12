import React from "react";
import "./LoadingSpinner.css";

const LoadingSpinner = ({ text = "Đang tải...", fullPage = false }) => {
  return (
    <div className={`loading-container ${fullPage ? "full-page" : ""}`}>
      <div className="loading-spinner" />
      {text && <p className="loading-text">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;
