// src/OnlineGame.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { io } from "socket.io-client";
import moveSelf from "./sounds/move-self.mp3";
import captureMp3 from "./sounds/capture.mp3";
import moveCheck from "./sounds/move-check.mp3";

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "https://card-chess.onrender.com";

// Sound effects
const moveSound = new Audio(moveSelf);
const captureSound = new Audio(captureMp3);
const checkSound = new Audio(moveCheck);
const endSound = new Audio(moveCheck);

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
  const width = large ? 160 : 90,
    height = large ? 240 : 140,
    bg = isPawn ? "#fde68a" : "#bfdbfe";
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

export default function OnlineGame({ onExit }) {
  const socketRef = useRef(null);

  // core state
  const [statusText, setStatusText] = useState("Connecting...");
  const [roomId, setRoomId] = useState(null);
  const [color, setColor] = useState(null); // 'w' | 'b'
  const [game, setGame] = useState(() => new Chess());
  const [gameFen, setGameFen] = useState(new Chess().fen());
  const [drawnCard, setDrawnCard] = useState(null);
  const [highlightSquares, setHighlightSquares] = useState({});
  const [selectedFrom, setSelectedFrom] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [gameOverMessage, setGameOverMessage] = useState("");
  const [lastMoveSquares, setLastMoveSquares] = useState(null);
  const [whiteCaptured, setWhiteCaptured] = useState([]);
  const [blackCaptured, setBlackCaptured] = useState([]);
  const prevFenRef = useRef(new Chess().fen());

  const isMyTurn = useMemo(() => {
    if (!game || !color) return false;
    return game.turn() === color;
  }, [game, color]);

  useEffect(() => {
    const s = io(SERVER_URL);
    socketRef.current = s;

    s.on("connect", () => {
      setStatusText("Connected. Finding match...");
      s.emit("find_game");
    });

    s.on("waiting", () => setStatusText("Waiting for opponent..."));

    s.on("match_found", ({ roomId: rid, color: col, fen }) => {
      setRoomId(rid);
      setColor(col);
      setStatusText("Matched! You are " + (col === "w" ? "White" : "Black"));
      const g = new Chess(fen);
      setGame(g);
      setGameFen(fen);
      setDrawnCard(null);
      setSelectedFrom(null);
      setHighlightSquares({});
      setGameOver(false);
      setLastMoveSquares(null);
      prevFenRef.current = fen;
      setWhiteCaptured([]);
      setBlackCaptured([]);
    });

    s.on("card_drawn", ({ card }) => {
      setDrawnCard(card);
      setStatusText(
        "Card drawn: " +
          (card.startsWith?.("pawn-")
            ? `Pawn ${card.split("-")[1].toUpperCase()}`
            : card)
      );
    });

    s.on("game_state", ({ fen, status, lastMove }) => {
      const g = new Chess(fen);

      let captureHappened = false;

      // Detect capture
      if (prevFenRef.current) {
        const prev = new Chess(prevFenRef.current);
        const prevPieces = ALL_SQUARES.map((sq) => prev.get(sq)).filter(
          Boolean
        );
        const currPieces = ALL_SQUARES.map((sq) => g.get(sq)).filter(Boolean);

        if (currPieces.length < prevPieces.length) {
          // someone got captured
          captureHappened = true;
          const diffMap = {};
          prevPieces.forEach((p) => {
            const key = p.color + p.type;
            diffMap[key] = (diffMap[key] || 0) + 1;
          });
          currPieces.forEach((p) => {
            const key = p.color + p.type;
            diffMap[key] = (diffMap[key] || 0) - 1;
          });
          // diffMap has +1 for the disappeared piece
          for (let key in diffMap) {
            if (diffMap[key] > 0) {
              const colorLost = key[0]; // 'w' or 'b'
              const type = key[1]; // p,n,b,r,q,k
              if (colorLost === "w") {
                setBlackCaptured((prevArr) => [...prevArr, type]);
              } else {
                setWhiteCaptured((prevArr) => [...prevArr, type]);
              }
            }
          }
        }
      }

      // play appropriate sound
      if (status.isCheckmate || status.isDraw) {
        endSound.play();
      } else if (status.isCheck) {
        checkSound.play();
      } else if (captureHappened) {
        captureSound.play();
      } else {
        moveSound.play();
      }

      prevFenRef.current = fen; // update for next time

      setGame(g);
      setGameFen(fen);
      setDrawnCard(null);

      if (status.isCheckmate) {
        setStatusText("Checkmate! Game over.");
        setGameOver(true);
      } else if (status.isDraw) {
        setStatusText("Draw. Game over.");
        setGameOver(true);
      } else if (status.isCheck) {
        setStatusText("Check!");
        setGameOver(false);
      } else {
        setStatusText(
          isMyTurn ? "Waiting for your card..." : "Opponent's turn"
        );
        setGameOver(false);
      }

      if (lastMove) {
        setLastMoveSquares(lastMove);
      } else {
        setLastMoveSquares(null);
      }
      setSelectedFrom(null);
      setHighlightSquares({});
    });

    s.on("invalid_move", (reason) => {
      let msg = "";
      if (reason === "card_restriction")
        msg = "Move not allowed by drawn card — try again.";
      else if (reason === "illegal") msg = "Illegal move — try again.";
      else if (reason === "not-your-turn") msg = "It's not your turn.";
      else if (reason === "no-piece") msg = "No piece at source square.";
      else msg = "Invalid move: " + reason;
      setStatusText(msg);

      setSelectedFrom(null);
      setHighlightSquares({});
    });

    s.on("opponent_left", () => {
      setStatusText("Opponent left. Returning to menu.");
      setTimeout(() => onExit(), 900);
    });

    s.on("disconnect", () => setStatusText("Disconnected from server."));

    // UPDATED gameOver listener with personalized resign handling
    s.on("gameOver", ({ reason, resignedId, message }) => {
      let finalMsg = "";

      if (reason === "resign") {
        const resignedIsMe = resignedId === socketRef.current.id;
        console.log(resignedIsMe + " " + color);

        if (resignedIsMe) {
          finalMsg = `You resigned. Opponent wins.`;
        } else {
          finalMsg = `Opponent resigned. You win!`;
        }
      } else if (message) {
        finalMsg = message;
      } else {
        finalMsg = "Game over.";
      }

      setGameOverMessage(finalMsg);
      setShowGameOverModal(true);
      setGameOver(true);
    });

    return () => {
      s.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getLegalMoveSquares(square) {
    const moves = game.moves({ square, verbose: true }) || [];
    if (!moves.length) return {};
    const styles = {};
    moves.forEach((m) => {
      styles[m.to] = game.get(m.to)
        ? {
            background:
              "radial-gradient(circle, rgba(255,0,0,0.45) 36%, transparent 40%)",
            borderRadius: "50%",
          }
        : {
            background:
              "radial-gradient(circle, rgba(0,200,0,0.45) 36%, transparent 40%)",
            borderRadius: "50%",
          };
    });
    styles[square] = { background: "rgba(255,255,0,0.35)" };
    return styles;
  }

  function isMoveAllowedByDrawnCard(srcSquare, pieceType) {
    if (!drawnCard) return false;
    if (drawnCard.startsWith("pawn-")) {
      if (pieceType !== "p") return false;
      const srcFile = srcSquare[0];
      return srcFile === drawnCard.split("-")[1];
    } else {
      const map = {
        knight: "n",
        bishop: "b",
        rook: "r",
        queen: "q",
        king: "k",
      };
      return map[drawnCard] === pieceType;
    }
  }

  function performMoveIfValid(sourceSquare, targetSquare) {
    if (gameOver) return false;
    const srcPiece = game.get(sourceSquare);
    if (!srcPiece) {
      setStatusText("No piece at selected square.");
      return false;
    }
    if (!isMoveAllowedByDrawnCard(sourceSquare, srcPiece.type)) {
      setStatusText(
        drawnCard
          ? "This piece is not allowed by the card."
          : "Waiting for your card..."
      );
      return false;
    }
    const moves = game.moves({ square: sourceSquare, verbose: true }) || [];
    const chosen = moves.find((m) => m.to === targetSquare);
    if (!chosen) {
      setStatusText("Not a legal destination for this piece.");
      return false;
    }

    socketRef.current.emit("make_move", {
      roomId,
      from: sourceSquare,
      to: targetSquare,
    });
    setStatusText("Waiting for server...");
    setSelectedFrom(null);
    setHighlightSquares({});
    return true;
  }

  function onPieceDrop(sourceSquare, targetSquare) {
    if (!roomId || !socketRef.current) return false;
    if (!isMyTurn) {
      setStatusText("It's not your turn.");
      return false;
    }
    if (!drawnCard) {
      setStatusText("Waiting for your card...");
      return false;
    }
    socketRef.current.emit("make_move", {
      roomId,
      from: sourceSquare,
      to: targetSquare,
    });
    return true;
  }

  function onSquareClick(square) {
    if (gameOver) return;
    const piece = game.get(square);
    const turn = game.turn();
    if (!drawnCard) {
      setStatusText("Waiting for your card...");
      return;
    }
    if (!selectedFrom) {
      if (
        piece &&
        piece.color === turn &&
        isMoveAllowedByDrawnCard(square, piece.type)
      ) {
        setSelectedFrom(square);
        setHighlightSquares(getLegalMoveSquares(square));
        setStatusText("");
      } else {
        if (piece && piece.color === turn)
          setStatusText("Selected piece not allowed by card.");
      }
      return;
    }
    if (performMoveIfValid(selectedFrom, square)) {
      // sent
    } else {
      if (
        piece &&
        piece.color === turn &&
        isMoveAllowedByDrawnCard(square, piece.type)
      ) {
        setSelectedFrom(square);
        setHighlightSquares(getLegalMoveSquares(square));
      } else {
        setSelectedFrom(null);
        setHighlightSquares({});
      }
    }
  }

  function onSquareRightClick() {
    setSelectedFrom(null);
    setHighlightSquares({});
  }

  function getCardPrettyName(cardId) {
    if (!cardId) return "—";
    if (cardId.startsWith("pawn-"))
      return `Pawn ${cardId.split("-")[1].toUpperCase()}`;
    return cardId[0].toUpperCase() + cardId.slice(1);
  }

  function handleResign() {
    setShowResignConfirm(true);
  }

  function confirmResign() {
    setShowResignConfirm(false);
    if (!roomId || !socketRef.current) return;
    socketRef.current.emit("resign", { roomId });
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

  function genSquares() {
    const squares = [];
    for (let file of "abcdefgh") {
      for (let rank = 1; rank <= 8; rank++) {
        squares.push(file + rank);
      }
    }
    return squares;
  }
  const ALL_SQUARES = genSquares();

  return (
    <>
      <div style={{ display: "flex", gap: 20, padding: 20 }}>
        <div>
          <h2>Online Match</h2>
          <div style={{ marginBottom: 6 }}>
            {statusText || (isMyTurn ? "Your turn" : "Opponent's turn")}
          </div>
          {/* Captured pieces by opponent */}
          <div style={{ display: "flex", gap: 4 }}>
            {(color === "w" ? blackCaptured : whiteCaptured).map((t, idx) => (
              <img
                key={idx}
                src={color === "w" ? pieceImages["w"][t] : pieceImages["b"][t]}
                alt=""
                style={{ width: 24, height: 24 }}
              />
            ))}
          </div>

          <Chessboard
            position={gameFen}
            boardOrientation={color === "w" ? "white" : "black"}
            boardWidth={560}
            onPieceDrop={(src, dst) => onPieceDrop(src, dst)}
            onSquareClick={onSquareClick}
            onSquareRightClick={onSquareRightClick}
            customSquareStyles={getMergedStyles()}
          />

          {/* Captured pieces by me */}
          <div style={{ display: "flex", gap: 4 }}>
            {(color === "w" ? whiteCaptured : blackCaptured).map((t, idx) => (
              <img
                key={idx}
                src={color === "w" ? pieceImages["b"][t] : pieceImages["w"][t]}
                alt=""
                style={{ width: 24, height: 24 }}
              />
            ))}
          </div>
        </div>
        <div style={{ width: 320 }}>
          <h3>Card Deck</h3>
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 13, color: "#333", marginBottom: 6 }}>
              Drawn Card
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 170,
                  height: 260,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {drawnCard ? (
                  <CardSVG cardId={drawnCard} large={true} />
                ) : (
                  <div style={{ color: "#777" }}>Waiting for your card…</div>
                )}
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>
                  {drawnCard ? getCardPrettyName(drawnCard) : "—"}
                </div>
                <div style={{ marginTop: 6, color: "#555", fontSize: 13 }}>
                  {drawnCard
                    ? "You must move this piece type this turn."
                    : "The system will draw automatically when it's your turn."}
                </div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            {!gameOver && (
              <button onClick={handleResign} style={{ marginRight: 8 }}>
                Resign
              </button>
            )}
            <div style={{ marginTop: 12, color: "#666", fontSize: 15 }}>
              <div>
                <strong>Your color:</strong>{" "}
                {color === "w" ? "White" : color === "b" ? "Black" : "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resign Confirmation Modal */}
      {showResignConfirm && (
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
            <h3>Confirm Resign</h3>
            <p>Are you sure you want to resign?</p>
            <div style={{ marginTop: 12 }}>
              <button onClick={confirmResign} style={{ marginRight: 8 }}>
                Yes
              </button>
              <button onClick={() => setShowResignConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {showGameOverModal && (
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
            <p>{gameOverMessage}</p>
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => {
                  setShowGameOverModal(false);
                  onExit();
                }}
              >
                Back to Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
