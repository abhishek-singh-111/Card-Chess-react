// src/AIGame.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import CardDisplay from "../components/CardDisplay";
import CapturedPieces from "../components/CapturedPieces";

import {
  buildAvailableCards,
  pickRandom,
  getLegalMoveSquares,
  isMoveAllowedByAnyCard,
  getMergedStyles,
} from "../utils/chessUtils";

import { moveSound, captureSound, checkSound, endSound } from "../utils/soundsUtil";

export default function AIGame() {
  const [game, setGame] = useState(() => new Chess());
  const [gameFen, setGameFen] = useState(new Chess().fen());
  const [color, setColor] = useState(() => (Math.random() < 0.5 ? "w" : "b"));
  const [options, setOptions] = useState([]);
  const [selectedFrom, setSelectedFrom] = useState(null);
  const [highlightSquares, setHighlightSquares] = useState({});
  const [lastMoveSquares, setLastMoveSquares] = useState(null);
  const [statusText, setStatusText] = useState("Game Start");
  const [capturedPieces, setCapturedPieces] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [gameOverMessage, setGameOverMessage] = useState("");

  const navigate = useNavigate();

  // Draw cards when turn changes
  useEffect(() => {
    if (gameOver) return;
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
      setStatusText("Your turn — pick a card");
    } else {
      setStatusText("AI thinking...");
      setOptions([]);
      setTimeout(doBotMove, 600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameFen, color, gameOver]);

  function isMyTurn() {
    return game.turn() === color;
  }

  function handleEndGameCheck(g) {
    if (g.isCheckmate()) {
      endSound.play();
      setGameOver(true);
      setGameOverMessage(
        game.turn() === color ? "You won! Checkmate!" : "You lost by checkmate!"
      );
      setShowGameOverModal(true);
      return true;
    }
    if (g.isDraw()) {
      endSound.play();
      setGameOver(true);
      setGameOverMessage("Draw!");
      setShowGameOverModal(true);
      return true;
    }
    if (g.isCheck()) {
      checkSound.play();
    }
    return false;
  }

  function onSquareClick(square) {
    if (!isMyTurn() || gameOver) return;
    const g = new Chess(game.fen());
    const piece = g.get(square);

    if (!selectedFrom) {
      if (
        piece &&
        piece.color === color &&
        isMoveAllowedByAnyCard(square, piece.type, options)
      ) {
        setSelectedFrom(square);
        setHighlightSquares(getLegalMoveSquares(game, square));
      }
    } else {
      const legal = g
        .moves({ square: selectedFrom, verbose: true })
        .find((m) => m.to === square);
      if (legal) {
        makePlayerMove(selectedFrom, square);
      } else {
        setSelectedFrom(null);
        setHighlightSquares({});
      }
    }
  }

  function makePlayerMove(from, to) {
    const g = new Chess(game.fen());
    const moveObj = g.move({ from, to, promotion: "q" });

    setLastMoveSquares({ from, to });

    if (moveObj && moveObj.captured) {
      captureSound.play();
      setCapturedPieces((prev) => [
        ...prev,
        { color: moveObj.color === "w" ? "b" : "w", type: moveObj.captured },
      ]);
    } else {
      moveSound.play();
    }

    setGame(g);
    setGameFen(g.fen());
    if (handleEndGameCheck(g)) return;
    setSelectedFrom(null);
    setHighlightSquares({});
  }

  function onPieceDrop(src, dst) {
    if (!isMyTurn() || gameOver) return false;
    const g = new Chess(game.fen());
    const piece = g.get(src);
    if (!piece || piece.color !== color) return false;
    if (!isMoveAllowedByAnyCard(src, piece.type, options)) return false;

    const legal = g
      .moves({ square: src, verbose: true })
      .find((m) => m.to === dst);
    if (!legal) return false;

    makePlayerMove(src, dst);
    return true;
  }

  function doBotMove() {
    if (gameOver) return;
    const g = new Chess(game.fen());
    const avail = buildAvailableCards(g);
    const pool = avail.slice(0, 3);
    const botCard = pickRandom(pool);

    const moves = g.moves({ verbose: true });
    const legalMoves = moves.filter((m) =>
      isMoveAllowedByAnyCard(m.from, m.piece, [botCard])
    );

    const chosen = pickRandom(legalMoves.length ? legalMoves : moves);
    const moveObj = g.move({
      from: chosen.from,
      to: chosen.to,
      promotion: "q",
    });
    setLastMoveSquares({ from: chosen.from, to: chosen.to });

    if (moveObj && moveObj.captured) {
      captureSound.play();
      setCapturedPieces((prev) => [
        ...prev,
        { color: moveObj.color === "w" ? "b" : "w", type: moveObj.captured },
      ]);
    } else {
      moveSound.play();
    }

    setGame(g);
    setGameFen(g.fen());
    if (handleEndGameCheck(g)) return;
    setStatusText("Your turn!");
  }

  return (
    <>
      <div style={{ display: "flex", gap: 20, padding: 20 }}>
        {/* LEFT SIDE */}
        <div>
          <h2>AI Match</h2>
          <div style={{ marginBottom: 6 }}>{statusText}</div>

          {/* Captured pieces by AI */}
          <div style={{ display: "flex", gap: 3 }}>
            <CapturedPieces
              pieces={capturedPieces.filter((p) => p.color === color)}
            />
          </div>

          <Chessboard
            position={gameFen}
            boardOrientation={color === "w" ? "white" : "black"}
            boardWidth={560}
            customSquareStyles={getMergedStyles(
              highlightSquares,
              lastMoveSquares
            )}
            onPieceDrop={onPieceDrop}
            onSquareClick={onSquareClick}
          />

          {/* Captured pieces by you */}
          <div style={{ display: "flex", gap: 3 }}>
            <CapturedPieces
              pieces={capturedPieces.filter((p) => p.color !== color)}
            />
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div style={{ width: 510 }}>
          <CardDisplay options={options} isMyTurn={isMyTurn()} />

          <div style={{ marginTop: 18 }}>
            <div style={{ marginTop: 12, color: "#666", fontSize: 15 }}>
              <strong>You are playing:</strong>{" "}
              {color === "w" ? "White" : "Black"}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <button onClick={() => navigate("/")}>Exit</button>
          </div>
        </div>
      </div>

      {/* Game Over Modal */}
      {showGameOverModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 32,
              borderRadius: 12,
              textAlign: "center",
            }}
          >
            <h2>Game Over</h2>
            <p>{gameOverMessage}</p>
            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => {
                  const fresh = new Chess();
                  setGame(fresh);
                  setGameFen(fresh.fen());
                  setCapturedPieces([]);
                  setOptions([]);
                  setSelectedFrom(null);
                  setColor(Math.random() < 0.5 ? "w" : "b");
                  setShowGameOverModal(false);
                  setGameOver(false);
                  setStatusText("New Game");
                }}
                style={{ marginRight: 12 }}
              >
                Play Again
              </button>
              <button onClick={() => navigate("/")}>Back to Menu</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
