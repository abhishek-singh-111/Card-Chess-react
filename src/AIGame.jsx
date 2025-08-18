// src/AIGame.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

import moveSelf from "./sounds/move-self.mp3";
import captureMp3 from "./sounds/capture.mp3";
import moveCheck from "./sounds/move-check.mp3";

// Sound effects
const moveSound = new Audio(moveSelf);
const captureSound = new Audio(captureMp3);
const checkSound = new Audio(moveCheck);

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

function buildAvailableCards(g) {
  const moves = g.moves({ verbose: true }) || [];
  const set = new Set();
  moves.forEach((m) => {
    if (m.piece === "p") set.add(`pawn-${m.from[0]}`);
    else if (m.piece === "n") set.add("knight");
    else if (m.piece === "b") set.add("bishop");
    else if (m.piece === "r") set.add("rook");
    else if (m.piece === "q") set.add("queen");
    else if (m.piece === "k") set.add("king");
  });
  return Array.from(set);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function AIGame() {
  const [game, setGame] = useState(() => new Chess());
  const [gameFen, setGameFen] = useState(new Chess().fen());
  const [color] = useState(() => (Math.random() < 0.5 ? "w" : "b"));
  const aiColor = color === "w" ? "b" : "w";
  const [options, setOptions] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedFrom, setSelectedFrom] = useState(null);
  const [highlightSquares, setHighlightSquares] = useState({});
  const [lastMoveSquares, setLastMoveSquares] = useState(null);
  const [statusText, setStatusText] = useState("Game Start");
  const [whiteCaptured, setWhiteCaptured] = useState([]);
  const [blackCaptured, setBlackCaptured] = useState([]);

  const navigate = useNavigate();

  // Draw cards when turn changes
  useEffect(() => {
    if (game.isGameOver()) return;
    if (game.turn() === color) {
      const avail = buildAvailableCards(game);
      const picks =
        avail.length <= 3
          ? avail
          : (() => {
              const chosen = [];
              while (chosen.length < 3) {
                const p = pickRandom(avail);
                if (!chosen.includes(p)) chosen.push(p);
              }
              return chosen;
            })();
      setOptions(picks);
      setSelectedCard(null);
      setStatusText("Your turn — pick a card");
    } else {
      setStatusText("AI thinking...");
      setOptions([]);
      setSelectedCard(null);
      setTimeout(doBotMove, 600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameFen, color]);

  function isMyTurn() {
    return game.turn() === color;
  }

  function getLegalMoveSquares(square) {
    const moves = game.moves({ square, verbose: true }) || [];
    const styles = {};
    moves.forEach((m) => {
      styles[m.to] = {
        background: m.captured
          ? "radial-gradient(circle, rgba(255,0,0,0.45) 36%, transparent 40%)"
          : "radial-gradient(circle, rgba(0,200,0,0.45) 36%, transparent 40%)",
        borderRadius: "50%",
      };
    });
    styles[square] = { background: "rgba(255,255,0,0.35)" };
    return styles;
  }

  function isMoveAllowedByCard(card, srcSquare, pType) {
    if (!card) return false;
    if (card.startsWith("pawn-")) {
      return pType === "p" && srcSquare[0] === card.split("-")[1];
    }
    const map = { knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" };
    return map[card] === pType;
  }

  function onSquareClick(square) {
    if (!isMyTurn() || !selectedCard) {
      return;
    }
    const g = new Chess(game.fen());
    const piece = g.get(square);
    if (!selectedFrom) {
      if (
        piece &&
        piece.color === color &&
        isMoveAllowedByCard(selectedCard, square, piece.type)
      ) {
        setSelectedFrom(square);
        setHighlightSquares(getLegalMoveSquares(square));
      }
    } else {
      const legal = g
        .moves({ square: selectedFrom, verbose: true })
        .find((m) => m.to === square);
      if (legal) {
        makePlayerMove(selectedFrom, square);
      } else {
        // reset / perhaps select new
        setSelectedFrom(null);
        setHighlightSquares({});
      }
    }
  }

  function makePlayerMove(from, to) {
    const g = new Chess(game.fen());
    const moveObj = g.move({ from, to, promotion: "q" });

    setLastMoveSquares({ from, to });
    if (g.isCheck()) checkSound.play();
    else moveSound.play();

    // track capture
    if (moveObj && moveObj.captured) {
      captureSound.play();
      if (aiColor === "w") {
        // player is white, so AI lost a piece
        setBlackCaptured((prev) => [...prev, moveObj.captured]);
      } else {
        setWhiteCaptured((prev) => [...prev, moveObj.captured]);
      }
    }

    setGame(g);
    setGameFen(g.fen());
    setSelectedFrom(null);
    setHighlightSquares({});
  }

  function onPieceDrop(src, dst) {
    if (!isMyTurn() || !selectedCard) return false;
    const g = new Chess(game.fen());
    const piece = g.get(src);
    if (!piece) return false;
    if (!isMoveAllowedByCard(selectedCard, src, piece.type)) return false;
    const legal = g
      .moves({ square: src, verbose: true })
      .find((m) => m.to === dst);
    if (!legal) return false;
    makePlayerMove(src, dst);
    return true;
  }

  function doBotMove() {
    const g = new Chess(game.fen());
    const avail = buildAvailableCards(g);
    const pool = avail.slice(0, 3);
    const botCard = pickRandom(pool);
    const moves = g.moves({ verbose: true });
    const legalMoves = moves.filter((m) => {
      if (botCard.startsWith("pawn-")) {
        return m.piece === "p" && m.from[0] === botCard.split("-")[1];
      } else {
        const map = {
          knight: "n",
          bishop: "b",
          rook: "r",
          queen: "q",
          king: "k",
        };
        return m.piece === map[botCard];
      }
    });
    const chosen = pickRandom(legalMoves.length ? legalMoves : moves);
    const moveObj = g.move({
      from: chosen.from,
      to: chosen.to,
      promotion: "q",
    });
    setLastMoveSquares({ from: chosen.from, to: chosen.to });
    if (g.isCheck()) checkSound.play();
    else moveSound.play();

    // track capture
    if (moveObj && moveObj.captured) {
      captureSound.play();
      if (color === "w") {
        // player is white, so AI lost a piece
        setBlackCaptured((prev) => [...prev, moveObj.captured]);
      } else {
        setWhiteCaptured((prev) => [...prev, moveObj.captured]);
      }
    }
    setGame(g);
    setGameFen(g.fen());
    setStatusText("Your turn!");
  }

  function getMergedStyles() {
    const styles = { ...highlightSquares };
    if (lastMoveSquares) {
      const { from, to } = lastMoveSquares;
      styles[from] = { background: "rgba(255, 255, 0, 0.5)" };
      styles[to] = { background: "rgba(255, 255, 0, 0.5)" };
    }
    return styles;
  }

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

  const choiceGrid = (
    <div style={{ display: "flex", gap: 12, height: 260 }}>
      {options.map((c) => {
        const isPawn = c.startsWith("pawn-");
        const bg = isPawn ? "#fde68a" : "#bfdbfe";
        return (
          <div
            key={c}
            onClick={() => setSelectedCard(c)}
            style={{
              width: 170,
              height: 260,
              background: bg,
              border: c === selectedCard ? "3px solid #00f" : "1px solid #ddd",
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
    <>
      <div style={{ display: "flex", gap: 20, padding: 20 }}>
        {/* LEFT SIDE (same width and structure like OnlineGame) */}
        <div>
          <h2>AI Match</h2>
          <div style={{ marginBottom: 6 }}>{statusText}</div>
          {/* Captured pieces by AI */}
          <div style={{ display: "flex", gap: 3 }}>
            {(color === "w" ? blackCaptured : whiteCaptured).map((t, i) => (
              <img
                key={i}
                src={pieceImages[color === "w" ? "b" : "w"][t]}
                alt=""
                style={{ width: 24, height: 24 }}
              />
            ))}
          </div>
          <Chessboard
            position={gameFen}
            boardOrientation={color === "w" ? "white" : "black"}
            boardWidth={560}
            customSquareStyles={getMergedStyles()}
            onPieceDrop={(src, dst) => onPieceDrop(src, dst)}
            onSquareClick={onSquareClick}
          />
          {/* Captured pieces by you */}
          <div style={{ display: "flex", gap: 3 }}>
            {(color === "w" ? whiteCaptured : blackCaptured).map((t, i) => (
              <img
                key={i}
                src={pieceImages[color === "w" ? "w" : "b"][t]}
                alt=""
                style={{ width: 24, height: 24 }}
              />
            ))}
          </div>
        </div>

        {/* RIGHT SIDE just like OnlineGame (but no resign, only deck) */}
        <div style={{ width: 510 }}>
          <div
            style={{ display: "flex", flexDirection: "column", marginTop: 80 }}
          >
            <h3 style={{ marginTop: 0 }}>Card Deck</h3>

            {isMyTurn() ? (
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
                  AI is thinking…
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>—</div>
                  <div style={{ marginTop: 6, color: "#555", fontSize: 13 }}>
                    The AI will move automatically when it's its turn.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Player color info for consistency */}
          <div style={{ marginTop: 18 }}>
            <div style={{ marginTop: 12, color: "#666", fontSize: 15 }}>
              <strong>You are playing:</strong>{" "}
              {color === "w" ? "White" : "Black"}
            </div>
          </div>
          {/* Button placed similar to Resign */}
          <div style={{ marginTop: 18 }}>
            <button onClick={() => navigate("/")}>Exit</button>
          </div>
        </div>
      </div>
    </>
  );
}
