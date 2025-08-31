// src/pages/OnlineGame.jsx - Fixed for Fly.io
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import CardDisplay from "../components/CardDisplay";
import CapturedPieces from "../components/CapturedPieces";
import GameOverModal from "../components/GameOverModal";
import { useLocation } from "react-router-dom";

import {
  moveSound,
  captureSound,
  checkSound,
  endSound,
} from "../utils/soundsUtil";

//const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:4000";
const SERVER_URL = process.env.REACT_APP_SERVER_URL || "https://cardchess-backend.fly.dev";

// Helper function to safely play audio
function safePlay(audio) {
  if (!audio) return;
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      // Autoplay prevented, ignore until user interacts
    });
  }
}

export default function OnlineGame({
  socket: externalSocket,
  roomId: initialRoomId,
  color: initialColor,
  fen: initialFen,
}) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const socketRef = useRef(null);
  const navigate = useNavigate();
  const connectionAttempts = useRef(0);
  const maxRetries = 3;

  const isFriendMode = !!externalSocket;
  const selectedMode = params.get("mode") || "standard";

  // Core state
  const [statusText, setStatusText] = useState("Connecting...");
  const [roomId, setRoomId] = useState(null);
  const [color, setColor] = useState(null);
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
  const [timers, setTimers] = useState({ w: null, b: null });
  const [mode, setMode] = useState("standard");
  const [connectionError, setConnectionError] = useState(false);

  const prevFenRef = useRef(new Chess().fen());

  const isMyTurn = useMemo(() => {
    if (!game || !color) return false;
    return game.turn() === color;
  }, [game, color]);

  // Enhanced socket connection with retry logic for Fly.io
  useEffect(() => {
    let s;
    let reconnectTimer;

    const connectToServer = () => {
      if (externalSocket) {
        s = externalSocket;
        socketRef.current = s;
        const m = params.get("mode") || "standard";
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
        console.log(`Connecting to ${SERVER_URL} (attempt ${connectionAttempts.current + 1})`);
        
        // CRITICAL: Enhanced connection options for Fly.io
        s = io(SERVER_URL, {
          forceNew: true,
          transports: ["websocket"], // Force websocket only
          timeout: 45000, // Increased timeout
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 10000,
          maxReconnectionAttempts: 5,
          upgrade: true,
          rememberUpgrade: true
        });
        
        socketRef.current = s;

        s.on("connect", () => {
          console.log("Connected to server successfully");
          connectionAttempts.current = 0;
          setConnectionError(false);
          setStatusText("Connected. Finding match...");
          setIsSearching(true);
          s.emit("find_game", { mode: selectedMode });
        });

        s.on("connect_error", (error) => {
          console.error("Connection error:", error);
          connectionAttempts.current++;
          setConnectionError(true);
          
          if (connectionAttempts.current >= maxRetries) {
            setStatusText("Failed to connect to server. Please try again later.");
            setIsSearching(false);
          } else {
            setStatusText(`Connection failed. Retrying... (${connectionAttempts.current}/${maxRetries})`);
            // Retry after delay
            reconnectTimer = setTimeout(() => {
              if (socketRef.current) {
                socketRef.current.disconnect();
              }
              connectToServer();
            }, 3000);
          }
        });

        s.on("disconnect", (reason) => {
          console.log("Disconnected:", reason);
          if (reason === "io server disconnect") {
            // Server terminated connection, try to reconnect
            setStatusText("Connection lost. Reconnecting...");
          } else {
            setStatusText("Disconnected from server.");
          }
        });

        s.on("reconnect", () => {
          console.log("Reconnected successfully");
          setStatusText("Reconnected!");
          setConnectionError(false);
        });

        s.on("reconnect_error", (error) => {
          console.error("Reconnection error:", error);
          setStatusText("Reconnection failed. Please refresh the page.");
        });
      }

      // Socket event handlers
      s.on("waiting", () => {
        setIsSearching(true);
        setStatusText("Waiting for opponent...");
      });

      s.on("match_found", ({ roomId: rid, color: col, fen, mode: m }) => {
        console.log(`Match found! Room: ${rid}, Color: ${col}, Mode: ${m}`);
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
        setMode(m);
      });

      s.on("timer_update", (t) => setTimers(t));

      s.on("cards_drawn", ({ cards }) => {
        console.log("Cards drawn:", cards);
        setOptions(cards);
        setStatusText(
          "Your turn: move any piece that matches one of your cards."
        );
      });

      s.on("game_state", ({ fen, status, lastMove }) => {
        const g = new Chess(fen);
        let captureHappened = false;

        if (prevFenRef.current) {
          const prev = new Chess(prevFenRef.current);
          const prevPieces = ALL_SQUARES.map((sq) => prev.get(sq)).filter(
            Boolean
          );
          const currPieces = ALL_SQUARES.map((sq) => g.get(sq)).filter(Boolean);

          if (currPieces.length < prevPieces.length) {
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

            for (let key in diffMap) {
              if (diffMap[key] > 0) {
                const colorLost = key[0];
                const type = key[1];
                if (colorLost === "w") {
                  setBlackCaptured((prevArr) => [...prevArr, type]);
                } else {
                  setWhiteCaptured((prevArr) => [...prevArr, type]);
                }
              }
            }
          }
        }

        // Play appropriate sound
        if (status.isCheckmate || status.isDraw) {
          safePlay(endSound);
        } else if (status.isCheck) {
          safePlay(checkSound);
        } else if (captureHappened) {
          safePlay(captureSound);
        } else {
          safePlay(moveSound);
        }

        prevFenRef.current = fen;

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
          msg = "Move not allowed by drawn card — try again.";
        else if (reason === "illegal") msg = "Illegal move — try again.";
        else if (reason === "not-your-turn") msg = "It's not your turn.";
        else if (reason === "no-piece") msg = "No piece at source square.";
        else msg = "Invalid move: " + reason;
        setStatusText(msg);

        setSelectedFrom(null);
        setHighlightSquares({});
      });

      s.on("gameOver", ({ reason, resignedId, message }) => {
        let finalMsg = "";
        if (reason === "resign") {
          finalMsg =
            resignedId === socketRef.current.id
              ? "You resigned. Opponent wins."
              : "Opponent resigned. You win!";
        } else if (reason === "timeout") {
          finalMsg = message || "Time's up! Game over.";
        } else {
          finalMsg = message || "Game over.";
        }
        safePlay(endSound);
        setGameOverMessage(finalMsg);
        setShowGameOverModal(true);
        setGameOver(true);
      });

      s.on("opponent_left", () => {
        setShowGameOverModal(false);
        toast.info("Opponent left the room, redirecting to main menu");
        setTimeout(() => navigate("/"), 4000);
      });

      s.on("error", (errorType) => {
        console.error("Server error:", errorType);
        switch (errorType) {
          case "room-not-found":
            toast.error("Room not found");
            navigate("/");
            break;
          case "room-abandoned":
            toast.error("Room was abandoned");
            navigate("/");
            break;
          case "room-full":
            toast.error("Room is full");
            navigate("/");
            break;
          default:
            toast.error("Server error occurred");
        }
      });

      const setupOpponentLeftHandler = () => {
        s.off("opponent_left");
        s.on("opponent_left", () => {
          setShowGameOverModal(false);
          setShowRematchPrompt(false);
          toast.info("Opponent left the room, redirecting to main menu");
          setTimeout(() => navigate("/"), 4000);
        });
      };

      // Rematch handlers for friend mode
      if (isFriendMode) {
        s.on("rematch_request", ({ roomId: reqRoom }) => {
          setShowGameOverModal(false);
          setGameOver(false);
          setShowRematchPrompt(true);
        });

        s.on("rematch_prompt", ({ roomId: reqRoom }) => {
          setGameOver(false);
          setGameOverMessage("Waiting for rematch response...");
        });

        s.on("return_home", () => {
          navigate("/");
        });

        s.on("rematch_declined", () => {
          toast.info("Opponent declined rematch, redirecting to main menu");
          setTimeout(() => navigate("/"), 4000);
        });

        s.on("rematch_response", ({ accepted, roomId: reqRoom }) => {
          if (accepted) {
            const g = new Chess();
            setGame(g);
            setGameFen(g.fen());
            prevFenRef.current = g.fen();
            setRoomId(reqRoom);
            setWhiteCaptured([]);
            setBlackCaptured([]);
            setOptions([]);
            setSelectedFrom(null);
            setHighlightSquares({});
            setLastMoveSquares(null);
            setGameOver(false);
            setShowGameOverModal(false);
            setShowRematchPrompt(false);
            setColor((prevColor) => prevColor);
            setStatusText("Rematch started!");

            // Reset timers to initial values
            setTimers({ w: 600, b: 600 });

            setupOpponentLeftHandler();

            s.emit("request_initial_cards", { roomId: reqRoom });
          } else {
            navigate("/");
          }
        });
      }
    };

    connectToServer();

    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      s.off("opponent_left");
      if (!externalSocket && s) {
        s.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, externalSocket]);

  // Handle browser back button
  useEffect(() => {
    const handleBack = () => {
      if (!socketRef.current || !roomId) return;

      if (isFriendMode) {
        socketRef.current.emit("leave_match", { roomId });
        navigate("/");
      } else {
        socketRef.current.emit("leave_match", { roomId });
        navigate("/");
      }
    };

    window.addEventListener("popstate", handleBack);
    return () => {
      window.removeEventListener("popstate", handleBack);
    };
  }, [roomId, isFriendMode, navigate]);

  // Game logic functions
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

    // Enhanced move emission with error handling
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("make_move", {
        roomId,
        from: sourceSquare,
        to: targetSquare,
      });
    } else {
      setStatusText("Connection lost. Please refresh the page.");
      return false;
    }

    setStatusText("Waiting for opponent...");
    setSelectedFrom(null);
    setHighlightSquares({});
    return true;
  }

  function onPieceDrop(sourceSquare, targetSquare) {
    if (!roomId || !socketRef.current || !isMyTurn || gameOver) {
      return false;
    }

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
    if (!roomId || !socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit("resign", { roomId });
  }

  function cancelSearch() {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("cancel_search");
    }
    navigate("/");
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

  // Calculate board size for responsiveness
  const calculateBoardSize = () => {
    if (typeof window === "undefined") return 600;

    const screenHeight = window.innerHeight;
    const screenWidth = window.innerWidth;

    if (screenWidth < 768) {
      return screenWidth;
    }

    if (screenWidth < 1024) {
      const availableHeight = screenHeight - 160;
      const availableWidth = screenWidth * 0.8;
      return Math.min(availableHeight, availableWidth, 600);
    }

    const availableHeight = screenHeight - 120;
    const availableWidth = screenWidth * 0.65;
    const maxSize = Math.min(availableHeight, availableWidth);
    return Math.min(maxSize, 750);
  };

  // Enhanced loading screen with connection status
  if (isSearching && !isFriendMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          {connectionError ? (
            <>
              <div className="mb-8 text-6xl">⚠️</div>
              <h2 className="text-2xl font-bold text-red-400 mb-4">
                Connection Error
              </h2>
              <p className="text-slate-300 mb-8">{statusText}</p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => {
                    connectionAttempts.current = 0;
                    setConnectionError(false);
                    window.location.reload();
                  }}
                  className="py-3 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all duration-200"
                >
                  Retry Connection
                </button>
                <button
                  onClick={() => navigate("/")}
                  className="py-3 px-6 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all duration-200 border border-white/20"
                >
                  Back to Menu
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-8 text-6xl">🔍</div>
              <h2 className="text-2xl font-bold text-white mb-4">
                Finding Match...
              </h2>
              <p className="text-slate-300 mb-8">{statusText}</p>
              <div className="flex justify-center gap-1 mb-8">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-emerald-400 rounded-full animate-bounce w-3 h-3"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
              <button
                onClick={cancelSearch}
                className="py-3 px-6 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all duration-200 border border-white/20"
              >
                Cancel Search
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Enhanced animated background */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(16, 185, 129, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative z-10">
        {/* MOBILE/TABLET LAYOUT */}
        <div className="md:hidden">
          <div className="min-h-screen flex flex-col">
            {/* Status bar with timers */}
            <div className="px-4 py-2 bg-slate-800/40 backdrop-blur-sm border-b border-white/10 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="text-white text-sm font-semibold truncate">
                  {statusText}
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      socketRef.current?.connected
                        ? isMyTurn 
                          ? "bg-emerald-400" 
                          : "bg-blue-400"
                        : "bg-red-400"
                    }`}
                  ></div>
                  <span
                    className={`text-xs font-medium flex-shrink-0 ${
                      socketRef.current?.connected
                        ? isMyTurn 
                          ? "text-emerald-400" 
                          : "text-blue-400"
                        : "text-red-400"
                    }`}
                  >
                    {socketRef.current?.connected
                      ? isMyTurn 
                        ? "Your Turn" 
                        : "Opponent Turn"
                      : "Disconnected"
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Chess board container */}
            <div className="relative bg-slate-900/40 backdrop-blur-sm border-b border-white/10">
              <div className="p-1 flex justify-center">
                <Chessboard
                  position={gameFen}
                  boardOrientation={color === "w" ? "white" : "black"}
                  boardWidth={calculateBoardSize()}
                  customSquareStyles={getMergedStyles()}
                  onPieceDrop={onPieceDrop}
                  onSquareClick={onSquareClick}
                  onSquareRightClick={onSquareRightClick}
                  customBoardStyle={{
                    borderRadius: "0px",
                    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
                  }}
                />
              </div>

              <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-r from-slate-900/80 to-transparent"></div>
              <div className="absolute inset-y-0 right-0 w-1 bg-gradient-to-l from-slate-900/80 to-transparent"></div>
            </div>

            {/* Bottom section */}
            <div className="flex-1 bg-slate-800/20 backdrop-blur-sm flex flex-col">
              <div className="px-3 py-2 border-b border-white/10">
                {mode === "timed" ? (
                  <div className="flex items-center justify-between py-1.5 px-3 bg-slate-800/20 backdrop-blur-sm rounded-lg border border-slate-600/40">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-bold">
                          {color === "w" ? "W" : "B"}
                        </span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-white text-xs font-medium truncate">
                          You
                        </span>
                        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                          {(color === "w" ? whiteCaptured : blackCaptured)
                            .length === 0 ? (
                            <span className="text-slate-500 text-xs">
                              No pieces
                            </span>
                          ) : (
                            (color === "w" ? whiteCaptured : blackCaptured)
                              .slice(0, 8)
                              .map((piece, index) => (
                                <div
                                  key={index}
                                  className="w-3 h-3 bg-slate-700/40 rounded border border-slate-600/30 flex items-center justify-center flex-shrink-0"
                                >
                                  <img
                                    src={`https://chessboardjs.com/img/chesspieces/wikipedia/${
                                      color === "w" ? "b" : "w"
                                    }${piece.toUpperCase()}.png`}
                                    alt={piece}
                                    className="w-2.5 h-2.5 opacity-90"
                                  />
                                </div>
                              ))
                          )}
                          {(color === "w" ? whiteCaptured : blackCaptured)
                            .length > 8 && (
                            <span className="text-slate-400 text-xs">
                              +
                              {(color === "w" ? whiteCaptured : blackCaptured)
                                .length - 8}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isMyTurn ? "bg-emerald-400" : "bg-slate-600"
                        }`}
                      ></div>
                      <div className="text-white font-mono font-bold text-sm">
                        {(() => {
                          const time = color === "w" ? timers.w : timers.b;
                          if (time == null) return "10:00";
                          const mins = Math.floor(time / 60);
                          const secs = time % 60;
                          return `${mins}:${secs
                            .toString()
                            .padStart(2, "0")}`;
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <CapturedPieces
                    pieces={color === "w" ? whiteCaptured : blackCaptured}
                    color={color === "w" ? "w" : "b"}
                    label="Your captures"
                    chessComStyle={true}
                  />
                )}
              </div>

              {/* Cards section */}
              <div className="flex-1 px-3 py-3 border-b border-white/10 min-h-0">
                <CardDisplay
                  options={options}
                  isMyTurn={isMyTurn}
                  isMobile={true}
                  gameType="online"
                  compact={true}
                  availableHeight={(() => {
                    if (typeof window === "undefined") return 120;

                    const statusHeight = mode === "timed" ? 60 : 40;
                    const boardHeight = window.innerWidth;
                    const capturedHeight = 80;
                    const controlsHeight = 70;
                    const padding = 16;

                    const usedHeight =
                      statusHeight +
                      boardHeight +
                      capturedHeight +
                      controlsHeight +
                      padding;
                    const availableSpace = window.innerHeight - usedHeight;

                    return Math.max(120, availableSpace);
                  })()}
                />
              </div>

              {/* Game controls */}
              <div className="px-3 py-3">
                <div className="flex gap-2">
                  {!gameOver && (
                    <button
                      onClick={handleResign}
                      className="flex-1 py-3 px-4 bg-red-600/80 active:bg-red-700 text-white font-semibold rounded-xl transition-all duration-200 text-sm min-h-[44px] flex items-center justify-center"
                    >
                      Resign
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (socketRef.current && roomId) {
                        socketRef.current.emit("leave_match", { roomId });
                      }
                      navigate("/");
                    }}
                    className="flex-1 py-3 px-4 bg-white/10 active:bg-white/20 text-white font-semibold rounded-xl transition-all duration-200 border border-white/20 text-sm min-h-[44px] flex items-center justify-center"
                  >
                    Exit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DESKTOP LAYOUT */}
        <div className="hidden md:flex h-screen">
          {/* Left side - Chess board with captured pieces */}
          <div className="flex-1 flex flex-col justify-center items-center px-4 py-4">
            {/* Top captured pieces strip */}
            <div className="w-full max-w-4xl mb-2">
              <CapturedPieces
                pieces={color === "w" ? blackCaptured : whiteCaptured}
                color={color === "w" ? "w" : "b"}
                label="Opponent captures"
                chessComStyle={true}
              />
            </div>

            {/* Chess board */}
            <div className="relative">
              <Chessboard
                position={gameFen}
                boardOrientation={color === "w" ? "white" : "black"}
                boardWidth={calculateBoardSize()}
                customSquareStyles={getMergedStyles()}
                onPieceDrop={onPieceDrop}
                onSquareClick={onSquareClick}
                onSquareRightClick={onSquareRightClick}
                customBoardStyle={{
                  borderRadius: "8px",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
                }}
              />
            </div>

            {/* Bottom captured pieces strip */}
            <div className="w-full max-w-4xl mt-2">
              <CapturedPieces
                pieces={color === "w" ? whiteCaptured : blackCaptured}
                color={color === "w" ? "b" : "w"}
                label="Your captures"
                chessComStyle={true}
              />
            </div>
          </div>

          {/* Center space - Timers for timed mode */}
          {mode === "timed" && (
            <div className="w-60 flex flex-col justify-center items-center -translate-x-11">
              {/* Opponent Timer */}
              <div className="mb-8 relative group w-full max-w-[200px]">
                <div
                  className={`absolute -inset-2 rounded-3xl blur-md transition-all duration-300 ${
                    !isMyTurn
                      ? "bg-gradient-to-r from-red-500/40 to-orange-500/40 animate-pulse"
                      : "bg-gradient-to-r from-slate-600/20 to-slate-500/20"
                  }`}
                ></div>

                <div
                  className={`relative p-8 backdrop-blur-xl rounded-3xl border-2 shadow-2xl transition-all duration-300 ${
                    !isMyTurn
                      ? "bg-slate-800/95 border-red-400/50 shadow-red-500/30"
                      : "bg-slate-800/70 border-slate-600/40 shadow-slate-900/30"
                  }`}
                >
                  <div className="text-center">
                    <div className="text-slate-300 text-base font-semibold mb-3">
                      Opponent
                    </div>

                    <div
                      className={`font-mono font-bold text-4xl tracking-wider transition-colors duration-300 ${
                        !isMyTurn ? "text-red-100" : "text-white"
                      }`}
                    >
                      {(() => {
                        const time = color === "w" ? timers.b : timers.w;
                        if (time == null) return "10:00";
                        const mins = Math.floor(time / 60);
                        const secs = time % 60;
                        return `${mins}:${secs.toString().padStart(2, "0")}`;
                      })()}
                    </div>

                    <div className="flex justify-center mt-4">
                      <div
                        className={`w-5 h-5 rounded-full transition-all duration-300 ${
                          !isMyTurn
                            ? "bg-red-400 animate-pulse shadow-lg shadow-red-400/60"
                            : "bg-slate-500"
                        }`}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual separator */}
              <div className="w-px h-12 bg-gradient-to-b from-transparent via-slate-500 to-transparent mb-8"></div>

              {/* Player Timer */}
              <div className="mt-8 relative group w-full max-w-[200px]">
                <div
                  className={`absolute -inset-2 rounded-3xl blur-md transition-all duration-300 ${
                    isMyTurn
                      ? "bg-gradient-to-r from-emerald-500/40 to-blue-500/40 animate-pulse"
                      : "bg-gradient-to-r from-slate-600/20 to-slate-500/20"
                  }`}
                ></div>

                <div
                  className={`relative p-8 backdrop-blur-xl rounded-3xl border-2 shadow-2xl transition-all duration-300 ${
                    isMyTurn
                      ? "bg-slate-800/95 border-emerald-400/50 shadow-emerald-500/30"
                      : "bg-slate-800/70 border-slate-600/40 shadow-slate-900/30"
                  }`}
                >
                  <div className="text-center">
                    <div className="text-slate-300 text-base font-semibold mb-3">
                      You
                    </div>

                    <div
                      className={`font-mono font-bold text-4xl tracking-wider transition-colors duration-300 ${
                        isMyTurn ? "text-emerald-100" : "text-white"
                      }`}
                    >
                      {(() => {
                        const time = color === "w" ? timers.w : timers.b;
                        if (time == null) return "10:00";
                        const mins = Math.floor(time / 60);
                        const secs = time % 60;
                        return `${mins}:${secs.toString().padStart(2, "0")}`;
                      })()}
                    </div>

                    <div className="flex justify-center mt-4">
                      <div
                        className={`w-5 h-5 rounded-full transition-all duration-300 ${
                          isMyTurn
                            ? "bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/60"
                            : "bg-slate-500"
                        }`}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Right side - Cards and controls */}
          <div className="w-[400px] 2xl:w-[480px] border-l border-white/10">
            <div className="h-full overflow-y-auto">
              <div className="p-6">
                <CardDisplay
                  options={options}
                  isMyTurn={isMyTurn}
                  gameType="online"
                  isMobile={false}
                />

                {/* Game controls */}
                <div className="mt-6 space-y-4">
                  <div className="p-6 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
                    <h3 className="text-lg font-bold text-white mb-4">
                      Game Actions
                    </h3>
                    <div className="space-y-3">
                      {!gameOver && (
                        <button
                          onClick={handleResign}
                          className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-xl transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl"
                        >
                          Resign Game
                        </button>
                      )}

                      <button
                        onClick={() => {
                          if (socketRef.current && roomId) {
                            socketRef.current.emit("leave_match", { roomId });
                          }
                          navigate("/");
                        }}
                        className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all duration-200 border border-white/20 hover:border-white/30"
                      >
                        Exit to Menu
                      </button>
                    </div>
                  </div>

                  {/* Game info with connection status */}
                  <div className="p-6 bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-xl rounded-2xl border border-purple-400/20">
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                      <span>🎮</span>
                      Game Info
                    </h3>
                    <div className="text-slate-300 text-sm space-y-2">
                      <div>
                        <span className="text-slate-400">Mode:</span>{" "}
                        {mode === "timed" ? "Timed" : "Standard"}
                      </div>
                      <div>
                        <span className="text-slate-400">Your color:</span>{" "}
                        {color === "w"
                          ? "White"
                          : color === "b"
                          ? "Black"
                          : "—"}
                      </div>
                      <div>
                        <span className="text-slate-400">Room:</span>{" "}
                        {roomId || "—"}
                      </div>
                      <div>
                        <span className="text-slate-400">Connection:</span>{" "}
                        <span className={socketRef.current?.connected ? "text-emerald-400" : "text-red-400"}>
                          {socketRef.current?.connected ? "Connected" : "Disconnected"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resign Confirmation Modal */}
      {showResignConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-red-500/50 to-orange-500/50 rounded-3xl blur opacity-30" />

            <div className="relative bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-3xl p-6 md:p-8 max-w-md w-full text-center">
              <div className="text-4xl md:text-6xl mb-4">⚠️</div>

              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                Confirm Resign
              </h2>
              <p className="text-lg md:text-xl text-slate-300 mb-6 md:mb-8">
                Are you sure you want to resign this game?
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={confirmResign}
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 active:from-red-700 active:to-red-800 text-white font-semibold rounded-xl transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl min-h-[44px]"
                >
                  Yes, Resign
                </button>

                <button
                  onClick={() => setShowResignConfirm(false)}
                  className="flex-1 py-3 px-6 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-semibold rounded-xl transition-all duration-200 border border-white/20 hover:border-white/30 min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
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
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit("rematch_request", { roomId });
          }
        }}
        onEndFriendMatch={() => {
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit("end_friend_match", { roomId });
          }
        }}
        onFindNewOpponent={() => {
          // Reset component state for new search
          setShowGameOverModal(false);
          setGameOver(false);
          setIsSearching(true);
          setStatusText("Searching for new opponent...");
          setRoomId(null);
          setColor(null);
          setOptions([]);
          setSelectedFrom(null);
          setHighlightSquares({});
          setLastMoveSquares(null);
          setWhiteCaptured([]);
          setBlackCaptured([]);
          setTimers({ w: null, b: null });

          // Reset game to initial state
          const newGame = new Chess();
          setGame(newGame);
          setGameFen(newGame.fen());
          prevFenRef.current = newGame.fen();

          // Leave current room if still in one
          if (roomId && socketRef.current && socketRef.current.connected) {
            socketRef.current.emit("leave_match", { roomId });
          }

          // Start searching for new game with current mode
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit("find_game", { mode: mode || "standard" });
          }
        }}
        onLeaveMatch={() => {
          if (socketRef.current && roomId && socketRef.current.connected) {
            socketRef.current.emit("leave_match", { roomId });
          }
          navigate("/");
        }}
      />

      {/* Rematch Prompt Modal */}
      {showRematchPrompt && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/50 to-blue-500/50 rounded-3xl blur opacity-30" />

            <div className="relative bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-3xl p-6 md:p-8 max-w-md w-full text-center">
              <div className="text-4xl md:text-6xl mb-4">🔄</div>

              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                Rematch Request
              </h2>
              <p className="text-lg md:text-xl text-slate-300 mb-6 md:mb-8">
                Your opponent wants to play again!
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    if (socketRef.current && socketRef.current.connected) {
                      socketRef.current.emit("rematch_response", {
                        roomId,
                        accepted: true,
                      });
                    }
                    setShowRematchPrompt(false);
                  }}
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:from-emerald-700 active:to-emerald-800 text-white font-semibold rounded-xl transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl min-h-[44px]"
                >
                  Accept
                </button>

                <button
                  onClick={() => {
                    if (socketRef.current && socketRef.current.connected) {
                      socketRef.current.emit("rematch_response", {
                        roomId,
                        accepted: false,
                      });
                    }
                    setShowRematchPrompt(false);
                  }}
                  className="flex-1 py-3 px-6 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-semibold rounded-xl transition-all duration-200 border border-white/20 hover:border-white/30 min-h-[44px]"
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}