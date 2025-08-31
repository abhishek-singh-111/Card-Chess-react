// src/AIGame.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import CardDisplay from "../components/CardDisplay";
import CapturedPieces from "../components/CapturedPieces";
// Import the new modular AI system
import { makeSmartAIMove } from "../utils/enhancedSmartAI";
import { getGamePhase, isEndgame } from "../utils/gamePhaseDetector";

import {
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

// Card generation logic (replicated from server.js)
function buildAvailableCardsFromGame(g) {
  const moves = g.moves({ verbose: true }) || [];
  const cardSet = new Set();
  moves.forEach((m) => {
    const p = m.piece;
    if (p === "p") cardSet.add(`pawn-${m.from[0]}`);
    else if (p === "n") cardSet.add("knight");
    else if (p === "b") cardSet.add("bishop");
    else if (p === "r") cardSet.add("rook");
    else if (p === "q") cardSet.add("queen");
    else if (p === "k") cardSet.add("king");
  });
  return Array.from(cardSet).sort();
}

// Smart draw returns 1-3 cards (replicated from server.js)
function smartDrawFor(g) {
  const avail = buildAvailableCardsFromGame(g);
  if (avail.length <= 3) {
    // if fewer than 3 available, just return them
    return avail;
  }
  const sample = [];
  while (sample.length < 3) {
    const pick = avail[Math.floor(Math.random() * avail.length)];
    if (!sample.includes(pick)) sample.push(pick);
  }
  return sample;
}

// Helper wrapper to avoid autoplay errors
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

  // Unlock audio on first user click
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
      const picks = smartDrawFor(game);
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

  /** Enhanced Bot Logic with Phase Detection **/

  function doBotMove() {
    if (gameOver) return;
    const g = new Chess(game.fen());
    const pool = smartDrawFor(g); // Use same card logic as server
    const aiColor = game.turn();
    const currentPhase = getGamePhase(g);
    const inEndgame = isEndgame(g);
    
    //console.log(`🤖 AI (${aiColor}) turn - Available cards:`, pool);

    let chosenMove = null;

    try {
      // Use the enhanced modular AI system
      chosenMove = makeSmartAIMove(g, pool, aiColor);
      
      // if (chosenMove) {
      //   console.log(`🤖 AI selected move: ${chosenMove.san} (${chosenMove.from} -> ${chosenMove.to})`);
      // }
    } catch (error) {
      // console.error("AI move calculation failed:", error);
      // Fallback to original random logic
      const moves = g.moves({ verbose: true });
      const legalMoves = moves.filter((m) =>
        isMoveAllowedByAnyCard(m.from, m.piece, pool)
      );
      chosenMove = legalMoves.length > 0 ? pickRandom(legalMoves) : null;
    }

    // if (!chosenMove) {
    //   console.log("🤖 No valid moves found");
    //   return;
    // }

    const moveObj = g.move({
      from: chosenMove.from,
      to: chosenMove.to,
      promotion: "q",
    });

    setLastMoveSquares({ from: chosenMove.from, to: chosenMove.to });
    
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
        {/* MOBILE/TABLET LAYOUT */}
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

            {/* Chess board container */}
            <div className="flex-1 min-h-0 flex flex-col">
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
                    borderRadius: '0px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
                  }}
                />
                
                <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-r from-slate-900/80 to-transparent"></div>
                <div className="absolute inset-y-0 right-0 w-1 bg-gradient-to-l from-slate-900/80 to-transparent"></div>
              </div>

              {/* Bottom section - Cards and controls */}
              <div className="flex-1 bg-slate-800/20 backdrop-blur-sm flex flex-col">
                {/* Top captured pieces */}
                <div className="px-3 py-2 border-b border-white/10">
                  <CapturedPieces
                    pieces={capturedPieces.filter((p) => p.color === color)}
                    label="AI captures"
                    chessComStyle={true}
                  />
                </div>

                {/* Bottom captured pieces */}
                <div className="px-3 py-2 border-b border-white/10">
                  <CapturedPieces
                    pieces={capturedPieces.filter((p) => p.color !== color)}
                    label="Your captures"
                    chessComStyle={true}
                  />
                </div>

                {/* Cards section */}
                <div className="flex-1 px-3 py-3 border-b border-white/10 min-h-0">
                  <CardDisplay 
                    options={options} 
                    isMyTurn={isMyTurn()} 
                    isMobile={true}
                    compact={true}
                    availableHeight={(() => {
                      if (typeof window === 'undefined') return 120;
                      
                      const statusHeight = 40;
                      const boardHeight = window.innerWidth;
                      const capturedHeight = 80;
                      const controlsHeight = 70;
                      const padding = 16;
                      
                      const usedHeight = statusHeight + boardHeight + capturedHeight + controlsHeight + padding;
                      const availableSpace = window.innerHeight - usedHeight;
                      
                      return Math.max(120, availableSpace);
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

        {/* DESKTOP LAYOUT */}
        <div className="hidden md:flex h-screen">
          {/* Left side - Chess board with captured pieces */}
          <div className="flex-1 flex flex-col justify-center items-center px-4 py-4">
            {/* Top captured pieces strip */}
            <div className="w-full max-w-4xl mb-2">
              <CapturedPieces
                pieces={capturedPieces.filter((p) => p.color === color)}
                label="AI captures"
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
                label="Your captures"
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

                  {/* Game tips */}
                  <div className="p-6 bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-xl rounded-2xl border border-purple-400/20">
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                      <span>💡</span>
                      Quick Tips
                    </h3>
                    <ul className="text-slate-300 text-sm space-y-2">
                      <li>• Cards determine which pieces you can move</li>
                      <li>• Click a piece then click destination to move</li>
                      <li>• Drag and drop pieces for quick moves</li>
                      <li>• AI uses advanced positional evaluation and tactics</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Game Over Modal */}
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