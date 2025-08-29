// src/utils/smartAI.js - Enhanced AI with Fixed Danger Level Calculation
import { Chess } from "chess.js";

// Enhanced piece values with context
const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Position bonus tables (from white's perspective)
const PAWN_TABLE = [
  0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30,
  20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10,
  0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
];

const KNIGHT_TABLE = [
  -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30,
  0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20,
  15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];

const BISHOP_TABLE = [
  -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5,
  10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0,
  -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10,
  -10, -10, -10, -10, -10, -20,
];

const ROOK_TABLE = [
  0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0,
  -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0,
  -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0,
];

const QUEEN_TABLE = [
  -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5,
  5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5,
  5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10,
  -20,
];

const KING_TABLE_MIDDLE = [
  -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40,
  -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40,
  -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20,
  -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
];

const PIECE_TABLES = {
  p: PAWN_TABLE,
  n: KNIGHT_TABLE,
  b: BISHOP_TABLE,
  r: ROOK_TABLE,
  q: QUEEN_TABLE,
  k: KING_TABLE_MIDDLE,
};

// Strategic move types
const MOVE_TYPES = {
  DEVELOPMENT: "development",
  TACTICAL: "tactical",
  DEFENSIVE: "defensive",
  POSITIONAL: "positional",
  COMMITMENT: "commitment",
  WAITING: "waiting",
};

// Convert square notation to array index for position tables
function squareToIndex(square, isWhite = true) {
  const file = square.charCodeAt(0) - 97; // 'a' = 0, 'b' = 1, etc.
  const rank = parseInt(square[1]) - 1; // '1' = 0, '2' = 1, etc.

  // For black pieces, flip the board vertically
  const adjustedRank = isWhite ? 7 - rank : rank;
  return adjustedRank * 8 + file;
}

// Basic position evaluation
function evaluatePosition(game) {
  let score = 0;
  const board = game.board();

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece) {
        const square = String.fromCharCode(97 + file) + (rank + 1);
        const pieceValue = PIECE_VALUES[piece.type];
        const tableIndex = squareToIndex(square, piece.color === "w");
        const positionBonus = PIECE_TABLES[piece.type][tableIndex];

        const totalValue = pieceValue + positionBonus;

        if (piece.color === "w") {
          score += totalValue;
        } else {
          score -= totalValue;
        }
      }
    }
  }

  return score;
}

// Check if move is allowed by available cards
function isMoveAllowedByCards(game, move, availableCards) {
  const piece = game.get(move.from);
  if (!piece) return false;

  return availableCards.some((cardId) => {
    if (cardId.startsWith("pawn-")) {
      const file = cardId.split("-")[1];
      return piece.type === "p" && move.from[0] === file;
    }

    const normalizedCardId = cardId.toLowerCase();
    const cardToPieceType = {
      knight: "n",
      n: "n",
      bishop: "b",
      b: "b",
      rook: "r",
      r: "r",
      queen: "q",
      q: "q",
      king: "k",
      k: "k",
      pawn: "p",
      p: "p",
    };

    return piece.type === cardToPieceType[normalizedCardId];
  });
}

// Game phase detection
function getGamePhase(game) {
  const moveNumber = Math.floor(game.moveNumber() / 2) + 1;
  const totalMaterial = getTotalMaterial(game);

  if (moveNumber <= 12) return "opening";
  if (moveNumber <= 35 && totalMaterial > 2000) return "middlegame";
  return "endgame";
}

// Get total material on board
function getTotalMaterial(game) {
  let total = 0;
  const board = game.board();
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece && piece.type !== "k") {
        total += PIECE_VALUES[piece.type];
      }
    }
  }
  return total;
}

// FIXED: Detect position danger level for specific color
function getPositionDanger(game, color) {
  let dangerLevel = 0;

  // Check if THIS color is in check (not the opponent)
  if (game.isCheck() && game.turn() === color) {
    dangerLevel += 3;
  }

  // King safety for THIS color
  if (!isCastled(game, color) && getGamePhase(game) !== "endgame") {
    dangerLevel += 1; // Reduced from 2
  }

  // FIXED: Analyze threats TO this color's pieces
  const threatLevel = analyzeThreatsToColor(game, color);
  dangerLevel += threatLevel;

  // Material balance (negative means this color is behind)
  const materialBalance = getMaterialBalance(game, color);
  if (materialBalance < -300) dangerLevel += 2;

  // FIXED: Check if opponent can give check on their turn
  const tempGame = new Chess(game.fen());
  if (tempGame.turn() !== color) {
    // Switch turns to see opponent's moves
    const opponentMoves = tempGame.moves({ verbose: true });
    const checksAvailable = opponentMoves.filter((move) => {
      const testGame = new Chess(game.fen());
      testGame.move(move);
      return testGame.isCheck();
    });

    if (checksAvailable.length > 0) {
      dangerLevel += 1;
    }
  }

  return Math.min(dangerLevel, 10);
}

// FIXED: Analyze threats specifically to a color's pieces
function analyzeThreatsToColor(game, targetColor) {
  let threatLevel = 0;

  // Create a temporary game to analyze opponent's moves
  //const tempGame = new Chess(game.fen());

  // If it's the target color's turn, we need to see what opponent can do
  //const opponentColor = targetColor === 'w' ? 'b' : 'w';

  // Get all possible opponent moves
  const opponentMoves = game.moves({ verbose: true });

  // Count valuable pieces that can be captured
  const vulnerablePieces = opponentMoves.filter((move) => {
    if (!move.captured) return false;

    // Check if the captured piece belongs to our target color
    const capturedPiece = game.get(move.to);
    if (!capturedPiece || capturedPiece.color !== targetColor) return false;

    return PIECE_VALUES[move.captured] >= PIECE_VALUES.n; // Knight value or higher
  });

  threatLevel += Math.min(vulnerablePieces.length, 3); // Cap at 3 threats

  // Count possible checks against target color
  const possibleChecks = opponentMoves.filter((move) => {
    const testGame = new Chess(game.fen());
    const moveResult = testGame.move(move);
    return moveResult && testGame.isCheck();
  });

  threatLevel += Math.min(possibleChecks.length, 2); // Cap at 2 check threats

  return threatLevel;
}

// Check if king has castled
function isCastled(game, color) {
  const history = game.history({ verbose: true });
  return history.some(
    (move) =>
      move.color === color &&
      (move.flags.includes("k") || move.flags.includes("q"))
  );
}

// REMOVED: Old analyzeThreats function (replaced with analyzeThreatsToColor)

// Get material balance for a color (positive = ahead, negative = behind)
function getMaterialBalance(game, color) {
  let balance = 0;
  const board = game.board();

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece && piece.type !== "k") {
        const value = PIECE_VALUES[piece.type];
        if (piece.color === color) {
          balance += value;
        } else {
          balance -= value;
        }
      }
    }
  }

  return balance;
}

// Find king position
// function getKingSquare(game, color) {
//   const board = game.board();
//   for (let rank = 0; rank < 8; rank++) {
//     for (let file = 0; file < 8; file++) {
//       const piece = board[rank][file];
//       if (piece && piece.type === 'k' && piece.color === color) {
//         return String.fromCharCode(97 + file) + (rank + 1);
//       }
//     }
//   }
//   return null;
// }

// Classify move strategically
function classifyMove(game, move, gamePhase, dangerLevel) {
  const piece = game.get(move.from);
  const moveTypes = [];

  // Tactical moves
  if (move.captured) moveTypes.push(MOVE_TYPES.TACTICAL);

  const tempGame = new Chess(game.fen());
  tempGame.move(move);
  if (tempGame.isCheck()) moveTypes.push(MOVE_TYPES.TACTICAL);

  // Development moves
  if (isDevelopmentMove(game, move, piece, gamePhase)) {
    moveTypes.push(MOVE_TYPES.DEVELOPMENT);
  }

  // Defensive moves
  if (isDefensiveMove(game, move, piece)) {
    moveTypes.push(MOVE_TYPES.DEFENSIVE);
  }

  // Commitment level
  const commitmentLevel = getCommitmentLevel(move, piece, gamePhase);
  if (commitmentLevel > 7) moveTypes.push(MOVE_TYPES.COMMITMENT);
  if (commitmentLevel < 3) moveTypes.push(MOVE_TYPES.WAITING);

  return { types: moveTypes, commitmentLevel };
}

// Check if move is development
function isDevelopmentMove(game, move, piece, gamePhase) {
  if (gamePhase !== "opening") return false;

  if (
    (piece.type === "n" || piece.type === "b") &&
    isOnBackRank(move.from) &&
    !isOnBackRank(move.to)
  ) {
    return true;
  }

  // Castling
  if (
    piece.type === "k" &&
    Math.abs(move.from.charCodeAt(0) - move.to.charCodeAt(0)) > 1
  ) {
    return true;
  }

  return false;
}

// Check if move is defensive
function isDefensiveMove(game, move, piece) {
  // Simplified - check if move blocks or defends
  const tempGame = new Chess(game.fen());
  const beforeThreats = game.moves({ verbose: true }).filter((m) => m.captured);

  tempGame.move(move);
  const afterThreats = tempGame
    .moves({ verbose: true })
    .filter((m) => m.captured);

  return afterThreats.length < beforeThreats.length;
}

// Get commitment level of move
function getCommitmentLevel(move, piece, gamePhase) {
  let commitment = 0;

  if (piece.type === "q" && gamePhase === "opening") commitment += 8;
  if (piece.type === "p") commitment += 6;
  if (piece.type === "k" && gamePhase !== "endgame") commitment += 7;

  const toRank = parseInt(move.to[1]);
  const isWhite = piece.color === "w";
  if ((isWhite && toRank > 5) || (!isWhite && toRank < 4)) {
    commitment += 3;
  }

  return Math.min(commitment, 10);
}

// Check if square is on back rank
function isOnBackRank(square) {
  const rank = parseInt(square[1]);
  return rank === 1 || rank === 8;
}

// Calculate dynamic move score based on context
function calculateDynamicMoveScore(
  game,
  move,
  availableCards,
  gamePhase,
  dangerLevel,
  color
) {
  const piece = game.get(move.from);
  const classification = classifyMove(game, move, gamePhase, dangerLevel);

  let score = 0;
  let reasoning = [];

  // Base tactical evaluation
  const tempGame = new Chess(game.fen());
  tempGame.move(move);
  const baseEval = evaluatePosition(tempGame);
  score += (color === "w" ? baseEval : -baseEval) * 0.1;

  // DANGER-BASED ADJUSTMENTS (now correctly using this color's danger level)
  if (dangerLevel > 6) {
    if (classification.types.includes(MOVE_TYPES.DEFENSIVE)) {
      score += 200;
      reasoning.push("Defensive move in danger");
    }
    if (classification.types.includes(MOVE_TYPES.TACTICAL)) {
      score += 300;
      reasoning.push("Tactical shot in crisis");
    }
    if (classification.commitmentLevel > 6) {
      score -= 150;
      reasoning.push("Too committal when in danger");
    }
    if (piece.type === "p") {
      if (isPawnMoveSafe(game, move, dangerLevel)) {
        score += 50;
        reasoning.push("Safe pawn move");
      } else {
        score -= 100;
        reasoning.push("Weakening pawn move in danger");
      }
    }
  } else if (dangerLevel < 3) {
    if (classification.types.includes(MOVE_TYPES.DEVELOPMENT)) {
      score += 100;
      reasoning.push("Good development");
    }
    if (classification.types.includes(MOVE_TYPES.POSITIONAL)) {
      score += 80;
      reasoning.push("Positional improvement");
    }
  }

  // GAME PHASE ADJUSTMENTS
  if (gamePhase === "opening") {
    if (piece.type === "q" && game.moveNumber() < 8) {
      score -= 400;
      reasoning.push("Early queen development penalty");
    }
    if (classification.types.includes(MOVE_TYPES.DEVELOPMENT)) {
      score += 150;
      reasoning.push("Opening development bonus");
    }
    if (piece.type === "p" && isGoodOpeningPawnMove(move)) {
      score += 60;
      reasoning.push("Good opening pawn structure");
    }
  }

  // PIECE-SPECIFIC CONTEXT
  const pieceContext = getPieceContextScore(
    game,
    move,
    piece,
    gamePhase,
    dangerLevel
  );
  score += pieceContext.score;
  reasoning.push(...pieceContext.reasons);

  // PREVENT PIECE FIXATION
  const recentMoves = getRecentMoves(game, 4);
  const sameSquareMoves = recentMoves.filter(
    (m) => m.from === move.from
  ).length;
  if (sameSquareMoves > 1) {
    score -= sameSquareMoves * 80;
    reasoning.push(`Piece fixation penalty (${sameSquareMoves} recent moves)`);
  }

  return { score, reasoning, classification };
}

// Check if pawn move is safe
function isPawnMoveSafe(game, move, dangerLevel) {
  const piece = game.get(move.from);
  if (piece.type !== "p") return false;

  // In high danger, only center pawn moves are safe
  if (dangerLevel > 6) {
    const centerFiles = ["d", "e"];
    return centerFiles.includes(move.to[0]);
  }

  return true;
}

// Check if it's a good opening pawn move
function isGoodOpeningPawnMove(move) {
  return ["d4", "d5", "e4", "e5"].includes(move.to);
}

// Get piece-specific context score
function getPieceContextScore(game, move, piece, gamePhase, dangerLevel) {
  let score = 0;
  const reasons = [];

  switch (piece.type) {
    case "q":
      if (gamePhase === "opening" && game.moveNumber() < 8) {
        score -= 300;
        reasons.push("Queen too early in opening");
      }
      if (dangerLevel > 5 && !move.captured) {
        score -= 100;
        reasons.push("Queen move without tactics in danger");
      }
      break;

    case "p":
      if (isGoodPawnStructure(game, move)) {
        score += 40;
        reasons.push("Improves pawn structure");
      }
      if (dangerLevel < 3 && gamePhase === "opening") {
        score += 30;
        reasons.push("Safe pawn development");
      }
      break;

    case "n":
    case "b":
      if (
        gamePhase === "opening" &&
        isDevelopmentMove(game, move, piece, gamePhase)
      ) {
        score += 120;
        reasons.push("Good minor piece development");
      }
      break;

    case "k":
      if (gamePhase === "opening" && isCastlingMove(move)) {
        score += 200;
        reasons.push("Castling for king safety");
      }
      if (gamePhase === "endgame" && isCentralization(move)) {
        score += 80;
        reasons.push("King centralization in endgame");
      }
      break;

      default:
      // Fallback for unexpected piece types (e.g., rook or unrecognized)
      // You could add rook logic later if needed.
      break;
  }

  return { score, reasons };
}

// Simplified helper functions
function isGoodPawnStructure(game, move) {
  return true;
}
function isCastlingMove(move) {
  return Math.abs(move.from.charCodeAt(0) - move.to.charCodeAt(0)) > 1;
}
function isCentralization(move) {
  const centerSquares = ["d4", "d5", "e4", "e5", "c4", "c5", "f4", "f5"];
  return centerSquares.includes(move.to);
}
function getRecentMoves(game, count) {
  const history = game.history({ verbose: true });
  return history.slice(-count);
}

// Get piece name for logging
// function getPieceName(pieceType) {
//   const names = {
//     p: "Pawn",
//     n: "Knight",
//     b: "Bishop",
//     r: "Rook",
//     q: "Queen",
//     k: "King",
//   };
//   return names[pieceType] || pieceType;
// }

// Enhanced move evaluation with dynamic context
function evaluateMovesWithContext(game, availableCards, color) {
  const gamePhase = getGamePhase(game);
  const dangerLevel = getPositionDanger(game, color);

//   console.log(`📊 CONTEXT ANALYSIS:`);
//   console.log(`   Game Phase: ${gamePhase.toUpperCase()}`);
//   console.log(
//     `   Danger Level: ${dangerLevel}/10 for ${
//       color === "w" ? "White" : "Black"
//     }`
//   );

  const allMoves = game.moves({ verbose: true });
  const allowedMoves = allMoves.filter((move) =>
    isMoveAllowedByCards(game, move, availableCards)
  );

//   console.log(`🎯 DYNAMIC MOVE EVALUATION:`);

  const scoredMoves = allowedMoves.map((move) => {
    const evaluation = calculateDynamicMoveScore(
      game,
      move,
      availableCards,
      gamePhase,
      dangerLevel,
      color
    );

    return {
      move,
      score: evaluation.score,
      reasoning: evaluation.reasoning,
      classification: evaluation.classification,
      piece: game.get(move.from),
    };
  });

  // Sort by score
  scoredMoves.sort((a, b) => b.score - a.score);

  // Display top candidates
//   console.log(`\n📋 TOP MOVE CANDIDATES WITH REASONING:`);
//   scoredMoves.slice(0, 5).forEach((candidate, index) => {
//     const { move, score, reasoning, piece } = candidate;
//     console.log(
//       `   ${index + 1}. ${move.san} (${getPieceName(
//         piece.type
//       )}) - Score: ${score.toFixed(0)}`
//     );
//     reasoning.forEach((reason) => {
//       console.log(`      └─ ${reason}`);
//     });
//   });

  return scoredMoves;
}

// Main enhanced AI function
export function makeEnhancedCardChessMove(game, availableCards, aiColor) {
//   console.log(`\n🤖 =============== ENHANCED CARD CHESS AI ===============`);
//   console.log(`🎯 AI Color: ${aiColor === "w" ? "White" : "Black"}`);
//   console.log(`🃏 Available Cards: [${availableCards.join(", ")}]`);

  const scoredMoves = evaluateMovesWithContext(game, availableCards, aiColor);

  if (scoredMoves.length === 0) {
    // console.log("❌ No legal moves available!");
    return null;
  }

  const selectedMove = scoredMoves[0].move;
//   console.log(`\n✅ SELECTED MOVE: ${selectedMove.san}`);
//   console.log(`   Final Score: ${scoredMoves[0].score.toFixed(0)}`);
//   console.log(
//     `   Move Type: ${scoredMoves[0].classification.types.join(", ")}`
//   );
//   console.log(
//     `   Key Reasoning: ${scoredMoves[0].reasoning[0] || "Strategic choice"}`
//   );

//   console.log(`🤖 =============== END ENHANCED AI TURN ===============\n`);

  return selectedMove;
}

// Enhanced strategic evaluation function for compatibility
// function getDetailedStrategicBonus(game, move, aiColor) {
//   const details = {
//     totalBonus: 0,
//     captureBonus: 0,
//     reasons: [],
//     primaryReason: null
//   };

//   const tempGame = new Chess(game.fen());
//   const moveResult = tempGame.move(move);

//   if (!moveResult) {
//     details.totalBonus = -999999;
//     details.primaryReason = "Invalid move";
//     return details;
//   }

//   const piece = game.get(move.from);
//   const gamePhase = getGamePhase(game);
//   const dangerLevel = getPositionDanger(game, aiColor);

//   // Use the dynamic scoring system
//   const evaluation = calculateDynamicMoveScore(game, move, [], gamePhase, dangerLevel, aiColor);

//   details.totalBonus = evaluation.score;
//   details.reasons = evaluation.reasoning;
//   details.primaryReason = evaluation.reasoning[0] || "Strategic move";

//   if (moveResult.captured) {
//     details.captureBonus = PIECE_VALUES[moveResult.captured];
//   }

//   return details;
// }

// Main enhanced AI function - replaces makeSmartAIMove
export function makeSmartAIMove(game, availableCards, aiColor) {
  return makeEnhancedCardChessMove(game, availableCards, aiColor);
}

// Simple AI for comparison
export function makeSimpleSmartMove(game, availableCards, aiColor) {
  const allMoves = game.moves({ verbose: true });

  const allowedMoves = allMoves.filter((move) =>
    isMoveAllowedByCards(game, move, availableCards)
  );

  if (allowedMoves.length === 0) {
    return allMoves[Math.floor(Math.random() * allMoves.length)];
  }

  // Priority 1: Checkmate
  const checkmateMoves = allowedMoves.filter((m) => {
    const temp = new Chess(game.fen());
    temp.move(m);
    return temp.isCheckmate();
  });
  if (checkmateMoves.length > 0) {
    return checkmateMoves[0];
  }

  // Priority 2: High-value captures
  const captureMoves = allowedMoves.filter((m) => m.captured);
  if (captureMoves.length > 0) {
    captureMoves.sort(
      (a, b) => PIECE_VALUES[b.captured] - PIECE_VALUES[a.captured]
    );
    if (PIECE_VALUES[captureMoves[0].captured] >= 300) {
      return captureMoves[0];
    }
  }

  // Priority 3: Give check
  const checkMoves = allowedMoves.filter((m) => {
    const temp = new Chess(game.fen());
    temp.move(m);
    return temp.isCheck();
  });
  if (checkMoves.length > 0) {
    return checkMoves[Math.floor(Math.random() * checkMoves.length)];
  }

  // Priority 4: Development in opening
  if (game.moveNumber() < 12) {
    const startRank = aiColor === "w" ? "1" : "8";
    const developmentMoves = allowedMoves.filter((m) => {
      const piece = game.get(m.from);
      return (
        m.from.includes(startRank) &&
        (piece.type === "n" || piece.type === "b") &&
        !m.to.includes(startRank)
      );
    });

    if (developmentMoves.length > 0) {
      return developmentMoves[
        Math.floor(Math.random() * developmentMoves.length)
      ];
    }
  }

  // Fallback: Random allowed move
  return allowedMoves[Math.floor(Math.random() * allowedMoves.length)];
}
