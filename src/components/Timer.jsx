// src/components/Timer.jsx
import React from "react";

export default function Timer({ time, label, isActive }) {
  const formatTime = (seconds) => {
    if (seconds == null) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      style={{
        fontSize: 18,
        fontWeight: isActive ? "bold" : "normal",
        color: isActive ? "green" : "black",
        marginBottom: 8,
        textAlign: "center",
      }}
    >
      {label}: {formatTime(time)}
    </div>
  );
}
