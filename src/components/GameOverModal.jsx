// src/components/GameOverModal.jsx
import React from "react";

export default function GameOverModal({
  show,
  message,
  isFriendMode,
  onRematch,
  onEndFriendMatch,
  onFindNewOpponent,
  onLeaveMatch,
}) {
  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 8,
          minWidth: 300,
        }}
      >
        <h3>Game Over</h3>
        <p>{message}</p>
        <div style={{ marginTop: 12 }}>
          {isFriendMode ? (
            <>
              <button onClick={onRematch} style={{ marginRight: 8 }}>
                Rematch
              </button>
              <button onClick={onEndFriendMatch}>Back to Menu</button>
            </>
          ) : (
            <>
              <button onClick={onFindNewOpponent} style={{ marginRight: 8 }}>
                Find New Opponent
              </button>
              <button onClick={onLeaveMatch}>Back to Menu</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
