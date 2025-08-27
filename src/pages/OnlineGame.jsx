// src/OnlineGame.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import CardDisplay from "../components/CardDisplay";
import CapturedPieces from "../components/CapturedPieces";
import GameOverModal from "../components/GameOverModal";
import Timer from "../components/Timer";
import { useLocation } from "react-router-dom";

import {
  moveSound,
  captureSound,
  checkSound,
  endSound,
} from "../utils/soundsUtil";

//const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:4000";
const SERVER_URL = process.env.REACT_APP_SERVER_URL || "https://card-chess.onrender.com";

export default function OnlineGame({
  socket: externalSocket,
  roomId: initialRoomId,
  color: initialColor,
  fen: initialFen,
}) {
  console.log(externalSocket);

  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const socketRef = useRef(null);
  const navigate = useNavigate();

  const isFriendMode = !!externalSocket;
  console.log(isFriendMode);

  const selectedMode = params.get("mode") || "standard";

  // core state
  const [statusText, setStatusText] = useState("Connecting...");
  const [roomId, setRoomId] = useState(null);
  const [color, setColor] = useState(null); // 'w' | 'b'
  const [game, setGame] = useState(() => new Chess());
  const [gameFen, setGameFen] = useState(new Chess().fen());
  const [highlightSquares, setHighlightSquares] = useState({});
  const [selectedFrom, setSelectedFrom] = useState(null);
  const [options, setOptions] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [gameOverMessage, setGameOverMessage] = useState("");
  const [lastMoveSquares, setLastMoveSquares] = useState(null);
  const [whiteCaptured, setWhiteCaptured] = useState([]);
  const [blackCaptured, setBlackCaptured] = useState([]);
  const [isSearching, setIsSearching] = useState(true);
  const [showRematchPrompt, setShowRematchPrompt] = useState(false);
  //New
  const [timers, setTimers] = useState({ w: null, b: null });
  const [mode, setMode] = useState("standard");

  const prevFenRef = useRef(new Chess().fen());

  const isMyTurn = useMemo(() => {
    if (!game || !color) return false;
    return game.turn() === color;
  }, [game, color]);

  useEffect(() => {
    let s;

    if (externalSocket) {
      // --- Friend mode ---
      s = externalSocket;
      socketRef.current = s;
      const m = params.get("mode") || "standard"; // always get mode from URL
      setMode(m);
      setRoomId(initialRoomId);
      setColor(initialColor);
      setStatusText("Game started with friend.");
      const g = new Chess(initialFen);
      setGame(g);
      setGameFen(initialFen);
      prevFenRef.current = initialFen;
      s.emit("request_initial_cards", { roomId: initialRoomId });
    } else {
      // --- Matchmaking mode ---
      s = io(SERVER_URL);
      socketRef.current = s;
      s.on("connect", () => {
        setStatusText("Connected. Finding match...");
        setIsSearching(true);
        //s.emit("find_game");
        s.emit("find_game", { mode: selectedMode });
      });
    }

    s.on("waiting", () => {
      setIsSearching(true);
      setStatusText("Waiting for opponent...");
    });

    s.on("match_found", ({ roomId: rid, color: col, fen, mode: m }) => {
      setIsSearching(false);
      setRoomId(rid);
      setColor(col);
      setStatusText("Matched! You are " + (col === "w" ? "White" : "Black"));
      const g = new Chess(fen);
      setGame(g);
      setGameFen(fen);
      setSelectedFrom(null);
      setHighlightSquares({});
      setGameOver(false);
      setLastMoveSquares(null);
      prevFenRef.current = fen;
      setWhiteCaptured([]);
      setBlackCaptured([]);
      //New
      setMode(m);
    });

    // New
    s.on("timer_update", (t) => setTimers(t));

    s.on("cards_drawn", ({ cards }) => {
      setOptions(cards);
      setStatusText(
        "Your turn: move any piece that matches one of your cards."
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
      setOptions([]);

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
          isMyTurn ? "Waiting for your cards..." : "Opponent's turn"
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
        msg = "Move not allowed by drawn card â€” try again.";
      else if (reason === "illegal") msg = "Illegal move â€” try again.";
      else if (reason === "not-your-turn") msg = "It's not your turn.";
      else if (reason === "no-piece") msg = "No piece at source square.";
      else msg = "Invalid move: " + reason;
      setStatusText(msg);

      setSelectedFrom(null);
      setHighlightSquares({});
    });

    s.on("disconnect", () => setStatusText("Disconnected from server."));

    s.on("gameOver", ({ reason, resignedId, message }) => {
      let finalMsg = "";
      if (reason === "resign") {
        finalMsg =
          resignedId === socketRef.current.id
            ? "You resigned. Opponent wins."
            : "Opponent resigned. You win!";
      } else {
        finalMsg = message || "Game over.";
      }
      endSound.play();
      setGameOverMessage(finalMsg);
      setShowGameOverModal(true);
      setGameOver(true);
    });

    s.on("opponent_left", () => {
      setShowGameOverModal(false);
      toast.info("Opponent left the room, redirecting to main menu");
      setTimeout(() => navigate("/"), 4000);
    });

    // NEW: Rematch handlers (friend mode)
    if (isFriendMode) {
      s.on("rematch_request", ({ roomId: reqRoom }) => {
        // hide the original gameOver modal
        setShowGameOverModal(false);
        setGameOver(false);
        setShowRematchPrompt(true);
      });

      s.on("rematch_prompt", ({ roomId: reqRoom }) => {
        // hide the original gameOver modal
        setGameOver(false);
        setGameOverMessage("Waiting for rematch response...");
      });

      s.on("return_home", () => {
        navigate("/");
        // else do nothing, Friend Mode handles manually!
      });

      s.on("rematch_declined", () => {
        toast.info("Opponent declined rematch, redirecting to main menu");
        setTimeout(() => navigate("/"), 4000);
      });

      s.on("rematch_response", ({ accepted, roomId: reqRoom }) => {
        if (accepted) {
          // Create a fresh Chess instance
          const g = new Chess();
          setGame(g);
          setGameFen(g.fen());
          prevFenRef.current = g.fen();
          // Reset UI state
          setRoomId(reqRoom); // still same id
          setWhiteCaptured([]);
          setBlackCaptured([]);
          setOptions([]);
          setSelectedFrom(null);
          setHighlightSquares({});
          setLastMoveSquares(null);
          setGameOver(false);
          setShowGameOverModal(false);
          setShowRematchPrompt(false);
          // Keep same color from previous game
          setColor((prevColor) => prevColor);
          setStatusText("Rematch started!");
          // Ask server to send initial cards to white
          s.emit("request_initial_cards", { roomId: reqRoom });
        } else {
          navigate("/");
        }
      });
    }

    return () => {
      s.off("opponent_left");
      if (!externalSocket) {
        s.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, externalSocket]);

  // Handle browser back button (Online + Friend mode)
  useEffect(() => {
    const handleBack = () => {
      if (!socketRef.current || !roomId) return;

      if (isFriendMode) {
        // Friend game â†’ behave like disconnect
        socketRef.current.emit("leave_match", { roomId });
        navigate("/");
      } else {
        // Online matchmaking â†’ same as Back to Menu button
        socketRef.current.emit("leave_match", { roomId });
        navigate("/");
      }
    };

    window.addEventListener("popstate", handleBack);

    return () => {
      window.removeEventListener("popstate", handleBack);
    };
  }, [roomId, isFriendMode, navigate]);

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

  function isMoveAllowedByCard(card, srcSquare, pType) {
    if (!card) return false;
    if (card.startsWith("pawn-")) {
      return pType === "p" && srcSquare[0] === card.split("-")[1];
    }
    const map = { knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" };
    return map[card] === pType;
  }

  function isMoveAllowedByAnyCard(cards, srcSquare, pType) {
    if (!cards || cards.length === 0) return false;
    return cards.some((c) => isMoveAllowedByCard(c, srcSquare, pType));
  }

  function performMoveIfValid(sourceSquare, targetSquare) {
    if (gameOver) return false;
    const srcPiece = game.get(sourceSquare);
    if (!srcPiece) {
      setStatusText("No piece at selected square.");
      return false;
    }

    if (!isMoveAllowedByAnyCard(options, sourceSquare, srcPiece.type)) {
      setStatusText("That piece isn't allowed by your current cards.");
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
    // after sending move:
    setStatusText("Waiting for opponent...");
    setSelectedFrom(null);
    setHighlightSquares({});
    return true;
  }

  /** Override: only allow move if selectedCard exists **/
  function onPieceDrop(sourceSquare, targetSquare) {
    if (!roomId || !socketRef.current || !isMyTurn || gameOver) {
      return false;
    }

    // local validation so UX feels responsive
    const piece = game.get(sourceSquare);
    if (!piece || piece.color !== game.turn()) return false;
    if (!isMoveAllowedByAnyCard(options, sourceSquare, piece.type))
      return false;
    return performMoveIfValid(sourceSquare, targetSquare);
  }

  function onSquareClick(square) {
    if (gameOver) return;

    if (!isMyTurn) return;
    if (!options || options.length === 0) {
      setStatusText("Waiting for your cards.");
      return;
    }
    const piece = game.get(square);
    const turn = game.turn();

    if (!selectedFrom) {
      if (
        piece &&
        piece.color === turn &&
        isMoveAllowedByAnyCard(options, square, piece.type)
      ) {
        setSelectedFrom(square);
        setHighlightSquares(getLegalMoveSquares(square));
        setStatusText("");
      } else {
        if (piece && piece.color === turn)
          setStatusText("That piece isn't allowed by your current cards.");
      }
      return;
    }
    if (performMoveIfValid(selectedFrom, square)) {
    } else {
      if (
        piece &&
        piece.color === turn &&
        isMoveAllowedByAnyCard(options, square, piece.type)
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

  function handleResign() {
    setShowResignConfirm(true);
  }

  function confirmResign() {
    setShowResignConfirm(false);
    if (!roomId || !socketRef.current) return;
    socketRef.current.emit("resign", { roomId });
  }

  function cancelSearch() {
    if (socketRef.current) {
      socketRef.current.emit("cancel_search");
      navigate("/");
    }
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
        {/* LEFT SIDE */}
        <div>
          <h2>Online Match</h2>
          <div style={{ marginBottom: 6 }}>
            {statusText || (isMyTurn ? "Your turn" : "Opponent's turn")}
          </div>
          {/* Opponentâ€™s timer above board */}
          {mode === "timed" && (
            <Timer
              time={color === "w" ? timers.b : timers.w}
              label="Opponent"
              isActive={game.turn() !== color}
            />
          )}
          {/* Captured pieces by opponent */}
          <CapturedPieces
            pieces={color === "w" ? blackCaptured : whiteCaptured}
            color={color === "w" ? "w" : "b"}
          />

          <Chessboard
            position={gameFen}
            boardOrientation={color === "w" ? "white" : "black"}
            boardWidth={560}
            onPieceDrop={(src, dst) => onPieceDrop(src, dst)}
            onSquareClick={onSquareClick}
            onSquareRightClick={onSquareRightClick}
            customSquareStyles={getMergedStyles()}
          />

          {/* Your timer below board */}
          {mode === "timed" && (
            <Timer
              time={color === "w" ? timers.w : timers.b}
              label="You"
              isActive={game.turn() === color}
            />
          )}

          {/* Captured pieces by me */}
          <CapturedPieces
            pieces={color === "w" ? whiteCaptured : blackCaptured}
            color={color === "w" ? "b" : "w"}
          />
        </div>

        {/* RIGHT SIDE */}
        <div style={{ width: 510 }}>
          <CardDisplay options={options} isMyTurn={isMyTurn} />

          {/* Resign and user color info */}
          <div style={{ marginTop: 18 }}>
            {!gameOver &&
              (isFriendMode ? (
                <button onClick={handleResign}>Resign</button>
              ) : isSearching ? (
                <button onClick={cancelSearch}>Back to Menu</button>
              ) : (
                <button onClick={handleResign}>Resign</button>
              ))}
            <div style={{ marginTop: 12, color: "#666", fontSize: 15 }}>
              <strong>Your color:</strong>{" "}
              {color === "w" ? "White" : color === "b" ? "Black" : "â€”"}
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
      <GameOverModal
        show={showGameOverModal}
        message={gameOverMessage}
        isFriendMode={isFriendMode}
        onRematch={() => {
          socketRef.current.emit("rematch_request", { roomId });
        }}
        onEndFriendMatch={() => {
          socketRef.current.emit("end_friend_match", { roomId });
        }}
        onFindNewOpponent={() => {
          setShowGameOverModal(false);
          setStatusText("Searching new opponent...");
          socketRef.current.emit("find_game");
        }}
        onLeaveMatch={() => {
          socketRef.current.emit("leave_match", { roomId });
          navigate("/");
        }}
      />

      {showRematchPrompt && (
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
            <h3>Rematch?</h3>
            <p>Your opponent wants to play again.</p>
            <button
              onClick={() => {
                socketRef.current.emit("rematch_response", {
                  roomId,
                  accepted: true,
                });
                setShowRematchPrompt(false);
              }}
              style={{ marginRight: 8 }}
            >
              Accept
            </button>
            <button
              onClick={() => {
                socketRef.current.emit("rematch_response", {
                  roomId,
                  accepted: false,
                });
                setShowRematchPrompt(false);
              }}
            >
              Decline
            </button>
          </div>
        </div>
      )}
    </>
  );
}
