// src/components/CapturedPieces.jsx
import React from "react";

const pieceImages = {
  w: {
    p: "https://chessboardjs.com/img/chesspieces/wikipedia/wP.png",
    n: "https://chessboardjs.com/img/chesspieces/wikipedia/wN.png",
    b: "https://chessboardjs.com/img/chesspieces/wikipedia/wB.png",
    r: "https://chessboardjs.com/img/chesspieces/wikipedia/wR.png",
    q: "https://chessboardjs.com/img/chesspieces/wikipedia/wQ.png",
    k: "https://chessboardjs.com/img/chesspieces/wikipedia/wK.png",
  },
  b: {
    p: "https://chessboardjs.com/img/chesspieces/wikipedia/bP.png",
    n: "https://chessboardjs.com/img/chesspieces/wikipedia/bN.png",
    b: "https://chessboardjs.com/img/chesspieces/wikipedia/bB.png",
    r: "https://chessboardjs.com/img/chesspieces/wikipedia/bR.png",
    q: "https://chessboardjs.com/img/chesspieces/wikipedia/bQ.png",
    k: "https://chessboardjs.com/img/chesspieces/wikipedia/bK.png",
  },
};

export default function CapturedPieces({ pieces, color, label }) {
  if (!pieces || pieces.length === 0) return null;

  return (
    <div style={{ margin: "6px 0" }}>
      {label && <div style={{ marginBottom: 4, fontSize: 14 }}>{label}</div>}
      <div style={{ display: "flex", gap: 3 }}>
        {pieces.map((p, i) => {
          // If p is an object → AI Game style {color, type}
          if (typeof p === "object" && p.type && p.color) {
            return (
              <img
                key={i}
                src={pieceImages[p.color][p.type]}
                alt={`${p.color}${p.type}`}
                style={{ width: 24, height: 24 }}
              />
            );
          }

          // If p is just "q", "p", etc. → Online Game style
          if (typeof p === "string" && color) {
            return (
              <img
                key={i}
                src={pieceImages[color][p]}
                alt={`${color}${p}`}
                style={{ width: 24, height: 24 }}
              />
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
