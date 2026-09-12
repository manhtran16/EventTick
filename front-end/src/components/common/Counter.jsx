import React, { useState } from "react";

const Counter = ({ getTheCount }) => {
  const [count, setCount] = useState(0);

  const updateCount = (newCount) => {
    setCount(newCount);
    if (getTheCount) {
      getTheCount(newCount);
    }
  };

  const increase = () => {
    if (count < 9) {
      updateCount(count + 1);
    }
  };

  const decrease = () => {
    if (count > 0) {
      updateCount(count - 1);
    }
  };

  const handleCountChange = (e) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) {
      let parsed = value === "" ? 0 : parseInt(value, 10);
      if (parsed < 0) parsed = 0;
      if (parsed > 9) parsed = 9;
      updateCount(parsed);
    }
  };

  return (
    <div className="real-time-event-counter">
      <button className="real-time-event-button minus" onClick={decrease}>
        -
      </button>
      <input
        type="number"
        className="real-time-event-value"
        value={count}
        onChange={handleCountChange}
        min="0"
        max="9"
      />
      <button className="real-time-event-button plus" onClick={increase}>
        +
      </button>
    </div>
  );
};

export default Counter;
