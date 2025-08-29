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

import {
  moveSound,
  captureSound,
  checkSound,
  endSound,
} from "../utils/soundsUtil";

// ✅ helper wrapper to avoid autoplay errors
function safePlay(audio) {
  if (!audio) return;
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      // Autoplay prevented, ignore until user interacts
    });
  }
}

export default function AIGame() {
  const [game, setGame] = useState(() => new Chess());
  const [gameFen, setGameFen] = useState(new Chess().fen());
  const [color, setColor] = useState(() =>
    Math.random() < 0.5 ? "w" : "b"
  );
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

  // ✅ Unlock audio on first user click
  useEffect(() => {
    const unlockAudio = () => {
      [moveSound, captureSound, checkSound, endSound].forEach((sound) => {
        try {
          sound.muted = true;
          sound.play().then(() => {
            sound.pause();
            sound.currentTime = 0;
            sound.muted = false;
          });
        } catch {}
      });
      window.removeEventListener("click", unlockAudio);
    };
    window.addEventListener("click", unlockAudio);
    return () => window.removeEventListener("click", unlockAudio);
  }, []);

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
      setTimeout(doBotMove, 1000); // 1 second thinking delay
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameFen, color, gameOver]);

  function isMyTurn() {
    return game.turn() === color;
  }

  function handleEndGameCheck(g) {
    if (g.isCheckmate()) {
      safePlay(endSound);
      setGameOver(true);
      setGameOverMessage(
        game.turn() === color
          ? "You won! Checkmate!"
          : "You lost by checkmate!"
      );
      setShowGameOverModal(true);
      return true;
    }
    if (g.isDraw()) {
      safePlay(endSound);
      setGameOver(true);
      setGameOverMessage("Draw!");
      setShowGameOverModal(true);
      return true;
    }
    if (g.isCheck()) {
      safePlay(checkSound);
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
      safePlay(captureSound);
      setCapturedPieces((prev) => [
        ...prev,
        {
          color: moveObj.color === "w" ? "b" : "w",
          type: moveObj.captured,
        },
      ]);
    } else {
      safePlay(moveSound);
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

  /** ---------------- SMART BOT LOGIC ---------------- **/

  function doBotMove() {
    if (gameOver) return;
    const g = new Chess(game.fen());
    const avail = buildAvailableCards(g);
    const pool = avail.slice(0, 3);
    console.log("🤖 AI candidate cards:", pool);

    const botCard = pickRandom(pool);

    const moves = g.moves({ verbose: true });
    const legalMoves = moves.filter((m) =>
      isMoveAllowedByAnyCard(m.from, m.piece, [botCard])
    );

    console.log("🤖 BOT TURN");
    console.log("Available cards:", avail);
    console.log("Legal moves with this card:", legalMoves);

    let chosen = null;

    if (g.history().length < 8) {
      chosen = pickOpeningMove(g, legalMoves);
      if (chosen) console.log("Bot picked opening move:", chosen);
    }

    if (!chosen && legalMoves.length) {
      console.log("Bot evaluating moves with minimax...");
      chosen = findBestMove(g, legalMoves, 3);
      console.log("Best move selected:", chosen);
    }

    if (!chosen && legalMoves.length) {
      chosen = pickRandom(legalMoves);
      console.log("Fallback random move:", chosen);
    }

    if (!chosen) return;

    const moveObj = g.move({
      from: chosen.from,
      to: chosen.to,
      promotion: "q",
    });

    setLastMoveSquares({ from: chosen.from, to: chosen.to });
    if (moveObj && moveObj.captured) {
      safePlay(captureSound);
      setCapturedPieces((prev) => [
        ...prev,
        {
          color: moveObj.color === "w" ? "b" : "w",
          type: moveObj.captured,
        },
      ]);
    } else {
      safePlay(moveSound);
    }

    setGame(g);
    setGameFen(g.fen());
    if (handleEndGameCheck(g)) return;
    setStatusText("Your turn!");
  }

  function pickOpeningMove(game, moves) {
    if (!moves.length) return null;
    const priorities = [
      (m) => m.piece === "p" && ["e4", "d4", "e5", "d5"].includes(m.san),
      (m) => m.piece === "n" && ["Nc3", "Nf3", "Nc6", "Nf6"].includes(m.san),
      (m) =>
        m.piece === "b" &&
        (m.san.includes("c4") ||
          m.san.includes("f4") ||
          m.san.includes("c5") ||
          m.san.includes("f5")),
      (m) => m.san.includes("O-O"),
    ];
    for (let rule of priorities) {
      const found = moves.find(rule);
      if (found) return found;
    }
    return null;
  }

  function findBestMove(game, legalMoves, depth) {
    let bestScore = -Infinity;
    let bestMove = null;
    for (let move of legalMoves) {
      const gCopy = new Chess(game.fen());
      gCopy.move({ from: move.from, to: move.to, promotion: "q" });
      let score = minimax(gCopy, depth - 1, -Infinity, Infinity, false);
      console.log(`Move ${move.san} scored ${score}`);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    return bestMove;
  }

  function minimax(game, depth, alpha, beta, isMaximizing) {
    if (depth === 0 || game.isGameOver()) {
      return evaluateBoard(game);
    }

    const moves = game.moves({ verbose: true });
    if (isMaximizing) {
      let maxEval = -Infinity;
      for (let move of moves) {
        const gCopy = new Chess(game.fen());
        gCopy.move(move);
        const evalScore = minimax(gCopy, depth - 1, alpha, beta, false);
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (let move of moves) {
        const gCopy = new Chess(game.fen());
        gCopy.move(move);
        const evalScore = minimax(gCopy, depth - 1, alpha, beta, true);
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  function evaluateBoard(game) {
    if (game.isCheckmate()) return game.turn() === "w" ? -9999 : 9999;
    if (game.isDraw()) return 0;

    const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
    let evalScore = 0;

    game.board().forEach((row) => {
      row.forEach((piece) => {
        if (piece) {
          const val = pieceValues[piece.type];
          evalScore += piece.color === "w" ? val : -val;
        }
      });
    });

    return evalScore;
  }

  /** ---------------- RESPONSIVE BOARD ---------------- **/

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

  const resetGame = () => {
    const fresh = new Chess();
    setGame(fresh);
    setGameFen(fresh.fen());
    setCapturedPieces([]);
    setOptions([]);
    setSelectedFrom(null);
    setColor(Math.random() < 0.5 ? "w" : "b");
    setGameOver(false);
    setStatusText("New Game");
    setHighlightSquares({});
    setShowGameOverModal(false);
  };



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
        {/* MOBILE/TABLET LAYOUT - Redesigned for premium experience */}
        <div className="md:hidden">
          <div className="min-h-screen flex flex-col">
            {/* Status bar - Compact */}
            <div className="px-4 py-2 bg-slate-800/40 backdrop-blur-sm border-b border-white/10 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="text-white text-sm font-semibold truncate">{statusText}</div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isMyTurn() ? 'bg-emerald-400' : 'bg-blue-400'}`}></div>
                  <span className={`text-xs font-medium flex-shrink-0 ${isMyTurn() ? 'text-emerald-400' : 'text-blue-400'}`}>
                    {isMyTurn() ? 'Your Turn' : 'AI Turn'}
                  </span>
                </div>
              </div>
            </div>

            {/* Chess board container - Full width, increased height */}
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Full-width chess board */}
              <div className="relative bg-gradient-to-b from-slate-800/30 to-slate-700/30">
                <Chessboard
                  position={gameFen}
                  boardOrientation={color === "w" ? "white" : "black"}
                  boardWidth={calculateBoardSize()}
                  customSquareStyles={getMergedStyles(
                    highlightSquares,
                    lastMoveSquares
                  )}
                  onPieceDrop={onPieceDrop}
                  onSquareClick={onSquareClick}
                  customBoardStyle={{
                    borderRadius: '0px', // No border radius for full-width effect
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
                  }}
                />
                
                {/* Subtle side gradients for visual enhancement */}
                <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-r from-slate-900/80 to-transparent"></div>
                <div className="absolute inset-y-0 right-0 w-1 bg-gradient-to-l from-slate-900/80 to-transparent"></div>
              </div>

              {/* Bottom section - Cards and controls */}
              <div className="flex-1 bg-slate-800/20 backdrop-blur-sm flex flex-col">
                {/* Top captured pieces */}
                <div className="px-3 py-2 border-b border-white/10">
                  <CapturedPieces
                    pieces={capturedPieces.filter((p) => p.color === color)}
                    label="Your captures"
                    chessComStyle={true}
                  />
                </div>

                {/* Bottom captured pieces */}
                <div className="px-3 py-2 border-b border-white/10">
                  <CapturedPieces
                    pieces={capturedPieces.filter((p) => p.color !== color)}
                    label="AI captures"
                    chessComStyle={true}
                  />
                </div>

                {/* Cards section - Always visible with dynamic sizing */}
                <div className="flex-1 px-3 py-3 border-b border-white/10 min-h-0">
                  <CardDisplay 
                    options={options} 
                    isMyTurn={isMyTurn()} 
                    isMobile={true}
                    compact={true}
                    availableHeight={(() => {
                      // Calculate available height for cards section - increased space allocation
                      if (typeof window === 'undefined') return 120;
                      
                      const statusHeight = 40;     // Status bar
                      const boardHeight = window.innerWidth; // Full width board is square
                      const capturedHeight = 80;   // Both captured pieces sections
                      const controlsHeight = 70;   // Menu buttons
                      const padding = 16;          // Reduced padding since we removed hint text
                      
                      const usedHeight = statusHeight + boardHeight + capturedHeight + controlsHeight + padding;
                      const availableSpace = window.innerHeight - usedHeight;
                      
                      return Math.max(120, availableSpace); // Increased minimum height
                    })()}
                  />
                </div>

                {/* Game controls - Bottom */}
                <div className="px-3 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={resetGame}
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 active:from-emerald-700 active:to-emerald-800 text-white font-semibold rounded-xl transition-all duration-200 text-sm min-h-[44px] flex items-center justify-center shadow-lg"
                    >
                      New Game
                    </button>
                    
                    <button
                      onClick={() => navigate("/")}
                      className="flex-1 py-3 px-4 bg-white/10 active:bg-white/20 text-white font-semibold rounded-xl transition-all duration-200 border border-white/20 text-sm min-h-[44px] flex items-center justify-center"
                    >
                      Exit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DESKTOP LAYOUT - Unchanged */}
        <div className="hidden md:flex h-screen">
          {/* Left side - Chess board with captured pieces */}
          <div className="flex-1 flex flex-col justify-center items-center px-4 py-4">
            {/* Top captured pieces strip */}
            <div className="w-full max-w-4xl mb-2">
              <CapturedPieces
                pieces={capturedPieces.filter((p) => p.color === color)}
                label="Your captures"
                chessComStyle={true}
              />
            </div>

            {/* Chess board */}
            <div className="relative">
              <Chessboard
                position={gameFen}
                boardOrientation={color === "w" ? "white" : "black"}
                boardWidth={calculateBoardSize()}
                customSquareStyles={getMergedStyles(
                  highlightSquares,
                  lastMoveSquares
                )}
                onPieceDrop={onPieceDrop}
                onSquareClick={onSquareClick}
                customBoardStyle={{
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                }}
              />
            </div>

            {/* Bottom captured pieces strip */}
            <div className="w-full max-w-4xl mt-2">
              <CapturedPieces
                pieces={capturedPieces.filter((p) => p.color !== color)}
                label="AI captures"
                chessComStyle={true}
              />
            </div>
          </div>

          {/* Right side - Cards and controls */}
          <div className="w-[400px] 2xl:w-[480px] border-l border-white/10">
            <div className="h-full overflow-y-auto">
              <div className="p-6">
                <CardDisplay options={options} isMyTurn={isMyTurn()} isMobile={false} />
                
                {/* Game controls */}
                <div className="mt-6 space-y-4">
                  <div className="p-6 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
                    <h3 className="text-lg font-bold text-white mb-4">Game Actions</h3>
                    <div className="space-y-3">
                      <button
                        onClick={resetGame}
                        className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold rounded-xl transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl"
                      >
                        New Game
                      </button>
                      
                      <button
                        onClick={() => navigate("/")}
                        className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all duration-200 border border-white/20 hover:border-white/30"
                      >
                        Exit to Menu
                      </button>
                    </div>
                  </div>

                  {/* Game tips - DESKTOP ONLY */}
                  <div className="p-6 bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-xl rounded-2xl border border-purple-400/20">
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                      <span>💡</span>
                      Quick Tips
                    </h3>
                    <ul className="text-slate-300 text-sm space-y-2">
                      <li>• Cards determine which pieces you can move</li>
                      <li>• Click a piece then click destination to move</li>
                      <li>• Drag and drop pieces for quick moves</li>
                      <li>• Plan your card usage strategically</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Game Over Modal - Responsive */}
      {showGameOverModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
          <div className="relative">
            {/* Modal glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/50 to-blue-500/50 rounded-3xl blur opacity-30" />
            
            <div className="relative bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-3xl p-6 md:p-8 max-w-md w-full text-center">
              <div className="text-4xl md:text-6xl mb-4">
                {gameOverMessage.includes("won") ? "🎉" : gameOverMessage.includes("lost") ? "😔" : "🤝"}
              </div>
              
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Game Over!</h2>
              <p className="text-lg md:text-xl text-slate-300 mb-6 md:mb-8">{gameOverMessage}</p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={resetGame}
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:from-emerald-700 active:to-emerald-800 text-white font-semibold rounded-xl transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl min-h-[44px]"
                >
                  Play Again
                </button>
                
                <button
                  onClick={() => navigate("/")}
                  className="flex-1 py-3 px-6 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-semibold rounded-xl transition-all duration-200 border border-white/20 hover:border-white/30 min-h-[44px]"
                >
                  Main Menu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}