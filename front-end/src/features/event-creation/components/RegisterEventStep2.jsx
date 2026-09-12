import "./RegisterEventStep2.css";
import React, { useState } from "react";
import RegisterSessionTwo from "./RegisterSessionTwo";

const RegisterEventStep2 = ({ onSaveStep2 }) => {
  const [sessions, setSessions] = useState([Date.now()]); // start with one session
  const [sessionsData, setSessionsData] = useState({});

  const handleSaveSession = (id, data) => {
    setSessionsData((prev) => ({ ...prev, [id]: data }));
    setSessions((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleRemoveSession = (id) => {
    setSessions((prev) => prev.filter((sid) => sid !== id));
    setSessionsData((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  };

  const handleContinue = () => {
    if (onSaveStep2) {
      onSaveStep2(Object.values(sessionsData));
    }
  };

  // check if there is at least one saved session with data
  const canContinue =
    sessions.length > 0 && Object.keys(sessionsData).length > 0;

  return (
    <div className="step-two-main">
      {sessions.map((sessionId) => (
        <RegisterSessionTwo
          key={sessionId}
          onSaveSession={(data) => handleSaveSession(sessionId, data)}
          onRemoveSession={() => handleRemoveSession(sessionId)}
        />
      ))}

      <button
        className="step-two-create-session"
        onClick={() => setSessions((prev) => [...prev, Date.now()])}
      >
        Tạo suất diễn
      </button>

      <button
        className="next-step-btn"
        style={{
          marginLeft: "30px",
          backgroundColor: canContinue ? "#00c853" : "#ccc",
          color: "#fff",
          cursor: canContinue ? "pointer" : "not-allowed",
        }}
        onClick={handleContinue}
        disabled={!canContinue}
      >
        Tiếp tục
      </button>
    </div>
  );
};

export default RegisterEventStep2;
