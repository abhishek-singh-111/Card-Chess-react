import React from "react";

function CardSVG({ cardId, large = false }) {
  if (!cardId) return null;
  const isPawn = cardId.startsWith("pawn-");
  const label = isPawn
    ? `Pawn ${cardId.split("-")[1].toUpperCase()}`
    : cardId[0].toUpperCase() + cardId.slice(1);
  const symbol = isPawn
    ? "♟"
    : cardId === "knight"
    ? "♞"
    : cardId === "bishop"
    ? "♝"
    : cardId === "rook"
    ? "♜"
    : cardId === "queen"
    ? "♛"
    : "♚";
  const width = large ? 160 : 90;
  const height = large ? 240 : 140;
  const bg = isPawn ? "#fde68a" : "#bfdbfe";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ borderRadius: 12 }}
    >
      <rect x={0} y={0} width={width} height={height} rx={12} fill={bg} />
      <text
        x={width / 2}
        y={height * 0.36}
        textAnchor="middle"
        fontSize={large ? 56 : 34}
      >
        {symbol}
      </text>
      <text
        x={width / 2}
        y={height * 0.72}
        textAnchor="middle"
        fontSize={large ? 18 : 11}
        style={{ fontWeight: 600 }}
      >
        {label}
      </text>
    </svg>
  );
}

const CardDisplay = ({ options, isMyTurn }) => {
  const choiceGrid = (
    <div style={{ display: "flex", gap: 12, height: 260 }}>
      {options.map((c) => {
        const isPawn = c.startsWith("pawn-");
        const bg = isPawn ? "#fde68a" : "#bfdbfe";
        return (
          <div
            key={c}
            style={{
              width: 170,
              height: 260,
              background: bg,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <CardSVG cardId={c} large={true} />
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 80 }}>
      <h3 style={{ marginTop: 0 }}>Card Deck</h3>

      {isMyTurn ? (
        options.length > 0 ? (
          choiceGrid
        ) : (
          <div style={{ color: "#777" }}>Waiting for cards…</div>
        )
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 300,
              height: 260,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#777",
            }}
          >
            Waiting for your cards…
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>—</div>
            <div style={{ marginTop: 6, color: "#555", fontSize: 13 }}>
              The system will draw automatically when it's your turn.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardDisplay;
