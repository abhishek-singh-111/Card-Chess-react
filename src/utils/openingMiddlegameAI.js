// src/utils/openingMiddlegameAI.js - Specialized Opening & Middlegame AI
import { Chess } from "chess.js";
import { getMaterialBalance, getGamePhaseTransition } from "./gamePhaseDetector";

// Opening/Middlegame optimized piece values
const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Opening-focused position tables
const OPENING_PAWN_TABLE = [
  0, 0, 0, 0, 0, 0, 0, 0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5, 5, 10, 27, 27, 10, 5, 5,
  0, 0, 0, 25, 25, 0, 0, 0,
  5, -5, -10, 0, 0, -10, -5, 5,
  5, 10, 10, -25, -25, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
];

const OPENING_KNIGHT_TABLE = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -20, -30, -30, -20, -40, -50,
];

const OPENING_BISHOP_TABLE = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 5, 0, 0, 0, 0, 5, -10,
  -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 0, 10, 10, 10, 10, 0, -10,
  -10, 5, 5, 10, 10, 5, 5, -10,
  -10, 0, 5, 10, 10, 5, 0, -10,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -20, -10, -40, -10, -10, -40, -10, -20,
];

const MIDDLEGAME_ROOK_TABLE = [
  0, 0, 0, 5, 5, 0, 0, 0,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  5, 10, 10, 10, 10, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
];

const MIDDLEGAME_QUEEN_TABLE = [
  -20, -10, -10, -5, -5, -10, -10, -20,
  -10, 0, 5, 0, 0, 0, 0, -10,
  -10, 5, 5, 5, 5, 5, 0, -10,
  0, 0, 5, 5, 5, 5, 0, -5,
  -5, 0, 5, 5, 5, 5, 0, -5,
  -10, 0, 5, 5, 5, 5, 0, -10,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -20, -10, -10, -5, -5, -10, -10, -20,
];

const KING_SAFETY_TABLE = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  20, 20, 0, 0, 0, 0, 20, 20,
  20, 30, 10, 0, 0, 10, 30, 20,
];

/**
 * Convert chess square to array index for position tables
 */
function squareToIndex(square, isWhite = true) {
  const file = square.charCodeAt(0) - 97; // 'a' = 0
  const rank = parseInt(square[1]) - 1; // '1' = 0
  const adjustedRank = isWhite ? 7 - rank : rank;
  return adjustedRank * 8 + file;
}

/**
 * Evaluate position for opening/middlegame with enhanced tactics
 */
export function evaluateOpeningMiddlegamePosition(game, color) {
  let score = 0;
  const board = game.board();
  const gamePhase = getGamePhaseTransition(game);
  const isOpening = gamePhase < 0.3;
  const isMiddlegame = gamePhase >= 0.3 && gamePhase < 0.7;
  
  // Material and positional evaluation
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece) {
        const square = String.fromCharCode(97 + file) + (rank + 1);
        const pieceValue = PIECE_VALUES[piece.type];
        
        // Select appropriate position table
        let positionTable;
        switch (piece.type) {
          case 'p':
            positionTable = OPENING_PAWN_TABLE;
            break;
          case 'n':
            positionTable = OPENING_KNIGHT_TABLE;
            break;
          case 'b':
            positionTable = OPENING_BISHOP_TABLE;
            break;
          case 'r':
            positionTable = MIDDLEGAME_ROOK_TABLE;
            break;
          case 'q':
            positionTable = MIDDLEGAME_QUEEN_TABLE;
            break;
          case 'k':
            positionTable = KING_SAFETY_TABLE;
            break;
          default:
            positionTable = new Array(64).fill(0);
        }
        
        const tableIndex = squareToIndex(square, piece.color === "w");
        const positionBonus = positionTable[tableIndex];
        
        let totalValue = pieceValue + positionBonus;
        
        // Phase-specific bonuses
        if (isOpening) {
          totalValue += getOpeningBonus(piece, square, game);
        } else if (isMiddlegame) {
          totalValue += getMiddlegameBonus(piece, square, game);
        }

        if (piece.color === color) {
          score += totalValue;
        } else {
          score -= totalValue;
        }
      }
    }
  }
  
  // Add strategic bonuses
  score += evaluateKingSafety(game, color, isOpening);
  score += evaluatePawnStructure(game, color);
  score += evaluatePieceActivity(game, color, isMiddlegame);
  
  return score;
}

/**
 * Opening-specific piece bonuses
 */
function getOpeningBonus(piece, square, game) {
  let bonus = 0;
  
  switch (piece.type) {
    case 'n':
    case 'b':
      // Development bonus for minor pieces
      if (!isOnBackRank(square)) {
        bonus += 50;
      }
      // Central outpost bonus
      if (['d4', 'd5', 'e4', 'e5'].includes(square)) {
        bonus += 30;
      }
      break;
      
    case 'q':
      // Penalty for early queen development
      if (game.moveNumber() < 8) {
        bonus -= 200;
      }
      break;
      
    case 'k':
      // Bonus for castling preparation
      if (square === 'g1' || square === 'c1' || square === 'g8' || square === 'c8') {
        bonus += 100;
      }
      break;
      
    case 'p':
      // Bonus for center pawn control
      if (['d4', 'd5', 'e4', 'e5'].includes(square)) {
        bonus += 40;
      }
      break;
  }
  
  return bonus;
}

/**
 * Middlegame-specific piece bonuses
 */
function getMiddlegameBonus(piece, square, game) {
  let bonus = 0;
  
  switch (piece.type) {
    case 'r':
      // Open file bonus
      if (isOnOpenFile(square, game)) {
        bonus += 50;
      }
      // 7th rank bonus
      const rank = parseInt(square[1]);
      if ((piece.color === 'w' && rank === 7) || (piece.color === 'b' && rank === 2)) {
        bonus += 80;
      }
      break;
      
    case 'q':
      // Queen centralization bonus
      if (['d4', 'd5', 'e4', 'e5'].includes(square)) {
        bonus += 40;
      }
      break;
      
    case 'n':
    case 'b':
      // Outpost bonuses
      if (isOutpost(square, piece, game)) {
        bonus += 60;
      }
      break;
  }
  
  return bonus;
}

/**
 * Evaluate king safety for opening/middlegame
 */
function evaluateKingSafety(game, color, isOpening) {
  let safety = 0;
  
  // Castling bonus in opening
  if (isOpening && isCastled(game, color)) {
    safety += 150;
  }
  
  // Check for king exposure
  const kingSquare = getKingSquare(game, color);
  if (kingSquare) {
    const kingSafety = calculateKingExposure(game, kingSquare, color);
    safety -= kingSafety * 30;
  }
  
  return safety;
}

/**
 * Evaluate pawn structure
 */
function evaluatePawnStructure(game, color) {
  let structure = 0;
  const pawns = getPawnsByColor(game, color);
  
  // Doubled pawns penalty
  const fileGroups = {};
  pawns.forEach(square => {
    const file = square[0];
    fileGroups[file] = (fileGroups[file] || 0) + 1;
  });
  
  Object.values(fileGroups).forEach(count => {
    if (count > 1) {
      structure -= (count - 1) * 50; // Penalty for each doubled pawn
    }
  });
  
  // Isolated pawns penalty
  pawns.forEach(square => {
    if (isIsolatedPawn(square, pawns)) {
      structure -= 30;
    }
  });
  
  return structure;
}

/**
 * Evaluate piece activity for middlegame
 */
function evaluatePieceActivity(game, color, isMiddlegame) {
  if (!isMiddlegame) return 0;
  
  let activity = 0;
  
  // Count legal moves (mobility)
  const moves = game.moves({ verbose: true });
  const myMoves = moves.filter(m => {
    const piece = game.get(m.from);
    return piece && piece.color === color;
  });
  
  activity += myMoves.length * 2;
  
  // Bonus for attacking opponent pieces
  const attacks = myMoves.filter(m => m.captured);
  activity += attacks.length * 10;
  
  return activity;
}

/**
 * Calculate move score for opening/middlegame
 */
export function calculateOpeningMiddlegameMoveScore(game, move, availableCards, color) {
  const piece = game.get(move.from);
  let score = 0;
  const reasons = [];
  
  // Make temporary move to evaluate position
  const tempGame = new Chess(game.fen());
  const moveObj = tempGame.move(move);
  
  if (!moveObj) return { score: -10000, reasons: ["Illegal move"] };
  
  // Checkmate is always best
  if (tempGame.isCheckmate()) {
    return { score: 100000, reasons: ["Checkmate!"] };
  }
  
  // Avoid stalemate
  if (tempGame.isStalemate()) {
    return { score: -50000, reasons: ["Causes stalemate"] };
  }
  
  // PRIORITY 1: SAFETY FIRST in opening
  const gamePhase = getGamePhaseTransition(game);
  if (gamePhase < 0.4) { // Opening phase
    const safetyEval = evaluateOpeningSafety(game, move, piece, color);
    score += safetyEval.score;
    reasons.push(...safetyEval.reasons);
    
    // If move is very unsafe, heavily penalize
    if (safetyEval.score < -200) {
      score -= 1000;
      reasons.push("UNSAFE: Risks piece loss");
    }
  }
  
  // PRIORITY 2: Tactical gains (captures, checks)
  if (moveObj.captured) {
    const captureValue = PIECE_VALUES[moveObj.captured];
    const pieceValue = PIECE_VALUES[piece.type];
    
    // Enhanced capture evaluation with safety
    const captureEval = evaluateSafeCapture(game, move, captureValue, pieceValue, color);
    score += captureEval.score;
    reasons.push(...captureEval.reasons);
  }
  
  // Check bonus (but only if reasonably safe)
  if (tempGame.isCheck()) {
    const checkSafety = evaluateCheckSafety(game, move, piece, color);
    if (checkSafety.score > -100) { // Only if check doesn't hang piece badly
      score += 100; // Reduced from 150
      reasons.push("Delivers check");
    }
  }
  
  // PRIORITY 3: Development (only if safe)
  if (gamePhase < 0.4) {
    const developmentEval = evaluateSafeDevelopment(game, move, piece, color);
    score += developmentEval.score;
    reasons.push(...developmentEval.reasons);
  }
  
  // PRIORITY 4: Quiet positional moves
  const quietEval = evaluateQuietPositionalMoves(game, move, piece, color);
  score += quietEval.score;
  reasons.push(...quietEval.reasons);
  
  return { score, reasons };
}


/**
 * Evaluate opening safety with hanging piece detection
 */
function evaluateOpeningSafety(game, move, piece, color) {
  let score = 0;
  const reasons = [];
  
  // Check if piece will be hanging
  const tempGame = new Chess(game.fen());
  tempGame.move(move);
  
  const attackers = countAttackersOnSquare(tempGame, move.to, color === 'w' ? 'b' : 'w');
  const defenders = countDefenders(tempGame, move.to, color);
  
  if (attackers > defenders) {
    const pieceValue = PIECE_VALUES[piece.type];
    score -= pieceValue * 0.8;
    reasons.push(`Piece becomes hanging (${attackers}v${defenders})`);
  }
  
  // King safety
  if (piece.type === 'k' && !isCastlingMove(move)) {
    score -= 150; // Heavy penalty for early king moves
    reasons.push("King exposed early");
  }
  
  return { score, reasons };
}

/**
 * Safe capture evaluation
 */
function evaluateSafeCapture(game, move, captureValue, pieceValue, color) {
  let score = captureValue;
  const reasons = [`Captures ${move.captured} (+${captureValue})`];
  
  const tempGame = new Chess(game.fen());
  tempGame.move(move);
  
  const recaptures = tempGame.moves({ verbose: true }).filter(m => m.to === move.to);
  
  if (recaptures.length > 0) {
    const cheapestRecapture = Math.min(...recaptures.map(m => {
      const recapturingPiece = tempGame.get(m.from);
      return PIECE_VALUES[recapturingPiece.type];
    }));
    
    if (pieceValue > cheapestRecapture) {
      const tradeLoss = pieceValue - cheapestRecapture;
      score -= tradeLoss * 0.7;
      reasons.push("Unfavorable trade setup");
    } else if (pieceValue < cheapestRecapture) {
      score += (cheapestRecapture - pieceValue) * 0.4;
      reasons.push("Favorable trade");
    }
  }
  
  return { score, reasons };
}

/**
 * Safe development evaluation
 */
function evaluateSafeDevelopment(game, move, piece, color) {
  let score = 0;
  const reasons = [];
  
  // First check if development square is safe
  const tempGame = new Chess(game.fen());
  tempGame.move(move);
  
  const attackers = countAttackersOnSquare(tempGame, move.to, color === 'w' ? 'b' : 'w');
  const defenders = countDefenders(tempGame, move.to, color);
  
  // Only give development bonuses if piece won't be hanging
  if (attackers <= defenders) {
    switch (piece.type) {
      case 'n':
        if (['c3', 'f3', 'c6', 'f6'].includes(move.to)) {
          score += 60; // Reduced from previous high values
          reasons.push("Knight to natural square");
        }
        break;
        
      case 'b':
        if (isOnBackRank(move.from) && !isOnBackRank(move.to)) {
          score += 50;
          reasons.push("Bishop development");
        }
        break;
        
      case 'p':
        if (['d4', 'e4', 'd5', 'e5'].includes(move.to)) {
          score += 80;
          reasons.push("Central pawn control");
        }
        break;
    }
  } else {
    reasons.push("Development square unsafe");
  }
  
  return { score, reasons };
}

/**
 * Evaluate quiet positional moves
 */
function evaluateQuietPositionalMoves(game, move, piece, color) {
  let score = 0;
  const reasons = [];
  
  const tempGame = new Chess(game.fen());
  const moveObj = tempGame.move(move);
  
  // Only for non-capture, non-check moves
  if (!moveObj.captured && !tempGame.isCheck()) {
    const materialBalance = getMaterialBalance(game, color);
    
    // When ahead, reward consolidating moves
    if (materialBalance > 100) {
      score += 20;
      reasons.push("Consolidates advantage");
    }
    
    // Reward moves that improve piece coordination
    if (improvesCoordination(game, move, color)) {
      score += 15;
      reasons.push("Improves coordination");
    }
  }
  
  return { score, reasons };
}

/**
 * Check if move improves piece coordination
 */
function improvesCoordination(game, move, color) {
  // Simple check: does this move defend another piece?
  const tempGame = new Chess(game.fen());
  tempGame.move(move);
  
  const myMoves = tempGame.moves({ verbose: true }).filter(m => {
    const p = tempGame.get(m.from);
    return p && p.color === color;
  });
  
  // Count how many of our pieces this move can now defend
  const defensiveCount = myMoves.filter(m => {
    const targetPiece = tempGame.get(m.to);
    return targetPiece && targetPiece.color === color;
  }).length;
  
  return defensiveCount > 0;
}

/**
 * Evaluate check safety
 */
function evaluateCheckSafety(game, move, piece, color) {
  const tempGame = new Chess(game.fen());
  tempGame.move(move);
  
  // Check if giving check hangs our piece
  const attackers = countAttackersOnSquare(tempGame, move.to, color === 'w' ? 'b' : 'w');
  const defenders = countDefenders(tempGame, move.to, color);
  
  if (attackers > defenders) {
    const pieceValue = PIECE_VALUES[piece.type];
    return { score: -pieceValue * 0.6, reasons: ["Check hangs piece"] };
  }
  
  return { score: 0, reasons: [] };
}

// Helper function for counting attackers
function countAttackersOnSquare(game, square, attackerColor) {
  const moves = game.moves({ verbose: true });
  return moves.filter(move => {
    const piece = game.get(move.from);
    return piece && piece.color === attackerColor && move.to === square;
  }).length;
}

/**
 * Evaluate opening-specific move qualities
 */
function evaluateOpeningMove(game, move, piece, color) {
  let score = 0;
  const reasons = [];
  
  switch (piece.type) {
    case 'p':
      // Central pawn moves
      if (['d4', 'e4', 'd5', 'e5'].includes(move.to)) {
        score += 120;
        reasons.push("Central pawn control");
      }
      // Don't move same pawn twice early
      if (game.moveNumber() < 10 && hasMovedPawnBefore(game, move.from)) {
        score -= 80;
        reasons.push("Pawn moved again too early");
      }
      break;
      
    case 'n':
      // Development to good squares
      if (['c3', 'f3', 'c6', 'f6', 'd2', 'e2'].includes(move.to)) {
        score += 100;
        reasons.push("Knight to natural square");
      }
      // Avoid knight on rim
      if (isRimSquare(move.to)) {
        score -= 50;
        reasons.push("Knight on rim is dim");
      }
      break;
      
    case 'b':
      // Long diagonal bishops
      if (isOnLongDiagonal(move.to)) {
        score += 80;
        reasons.push("Bishop on long diagonal");
      }
      // Early development
      if (isOnBackRank(move.from) && !isOnBackRank(move.to)) {
        score += 90;
        reasons.push("Bishop development");
      }
      break;
      
    case 'q':
      // Heavy penalty for early queen moves
      if (game.moveNumber() < 8) {
        score -= 300;
        reasons.push("Queen too early in opening");
      }
      break;
      
    case 'k':
      // Castling bonus
      if (isCastlingMove(move)) {
        score += 200;
        reasons.push("Castling for safety");
      }
      break;
  }
  
  return { score, reasons };
}

/**
 * Evaluate middlegame-specific move qualities
 */
function evaluateMiddlegameMove(game, move, piece, color) {
  let score = 0;
  const reasons = [];
  
  switch (piece.type) {
    case 'r':
      // Open file occupation
      if (isOnOpenFile(move.to, game)) {
        score += 100;
        reasons.push("Rook to open file");
      }
      // Seventh rank penetration
      const rank = parseInt(move.to[1]);
      if ((color === 'w' && rank === 7) || (color === 'b' && rank === 2)) {
        score += 120;
        reasons.push("Rook to seventh rank");
      }
      break;
      
    case 'q':
      // Queen centralization in middlegame
      if (['d4', 'd5', 'e4', 'e5'].includes(move.to)) {
        score += 80;
        reasons.push("Queen centralization");
      }
      // Active queen placement
      if (isActiveQueenSquare(move.to, game, color)) {
        score += 60;
        reasons.push("Active queen placement");
      }
      break;
      
    case 'n':
    case 'b':
      // Outpost evaluation
      if (isOutpost(move.to, piece, game)) {
        score += 100;
        reasons.push("Piece to strong outpost");
      }
      // Attack enemy pieces
      if (attacksEnemyPieces(game, move, color)) {
        score += 50;
        reasons.push("Attacks enemy pieces");
      }
      break;
      
    case 'p':
      // Pawn breaks in middlegame
      if (isPawnBreak(game, move, color)) {
        score += 80;
        reasons.push("Strategic pawn break");
      }
      break;
  }
  
  return { score, reasons };
}

/**
 * Evaluate move safety
 */
function evaluateMoveSafety(game, move, piece, color) {
  let score = 0;
  const reasons = [];
  
  // Check if piece would be hanging after move
  const tempGame = new Chess(game.fen());
  tempGame.move(move);
  
  // Switch turn to see if opponent can capture our piece
  const opponentMoves = tempGame.moves({ verbose: true });
  const capturesOurPiece = opponentMoves.filter(m => m.to === move.to && m.captured);
  
  if (capturesOurPiece.length > 0) {
    const pieceValue = PIECE_VALUES[piece.type];
    
    // Check if piece is defended
    const defenders = countDefenders(game, move.to, color);
    const attackers = capturesOurPiece.length;
    
    if (attackers > defenders) {
      score -= pieceValue * 0.7;
      reasons.push("Piece would be hanging");
    } else if (attackers === defenders) {
      // Equal trade - evaluate if favorable
      const attackerValues = capturesOurPiece.map(m => {
        const attackingPiece = tempGame.get(m.from);
        return PIECE_VALUES[attackingPiece.type];
      });
      const minAttackerValue = Math.min(...attackerValues);
      
      if (pieceValue > minAttackerValue) {
        score -= (pieceValue - minAttackerValue) * 0.3;
        reasons.push("Unfavorable trade setup");
      }
    }
  }
  
  return { score, reasons };
}

// Helper functions
function isOnBackRank(square) {
  const rank = parseInt(square[1]);
  return rank === 1 || rank === 8;
}

function isRimSquare(square) {
  const file = square[0];
  const rank = parseInt(square[1]);
  return file === 'a' || file === 'h' || rank === 1 || rank === 8;
}

function isOnLongDiagonal(square) {
  const longDiagonals = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8', 
                        'a8', 'b7', 'c6', 'd5', 'e4', 'f3', 'g2', 'h1'];
  return longDiagonals.includes(square);
}

function isCastlingMove(move) {
  return Math.abs(move.from.charCodeAt(0) - move.to.charCodeAt(0)) > 1;
}

function isCastled(game, color) {
  const history = game.history({ verbose: true });
  return history.some(move => 
    move.color === color && 
    (move.flags.includes("k") || move.flags.includes("q"))
  );
}

function getKingSquare(game, color) {
  const board = game.board();
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece && piece.type === 'k' && piece.color === color) {
        return String.fromCharCode(97 + file) + (rank + 1);
      }
    }
  }
  return null;
}

function calculateKingExposure(game, kingSquare, color) {
  // Simplified king exposure calculation
  // Check how many squares around king are attacked by opponent
  let exposure = 0;
  const adjacentSquares = getAdjacentSquares(kingSquare);
  
  adjacentSquares.forEach(square => {
    if (isSquareAttackedBy(game, square, color === 'w' ? 'b' : 'w')) {
      exposure++;
    }
  });
  
  return exposure;
}

function getAdjacentSquares(square) {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1]) - 1;
  const adjacent = [];
  
  for (let dr = -1; dr <= 1; dr++) {
    for (let df = -1; df <= 1; df++) {
      if (dr === 0 && df === 0) continue;
      
      const newRank = rank + dr;
      const newFile = file + df;
      
      if (newRank >= 0 && newRank <= 7 && newFile >= 0 && newFile <= 7) {
        adjacent.push(String.fromCharCode(97 + newFile) + (newRank + 1));
      }
    }
  }
  
  return adjacent;
}

function isSquareAttackedBy(game, square, attackerColor) {
  const moves = game.moves({ verbose: true });
  return moves.some(move => {
    const piece = game.get(move.from);
    return piece && piece.color === attackerColor && move.to === square;
  });
}

function getPawnsByColor(game, color) {
  const pawns = [];
  const board = game.board();
  
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece && piece.type === 'p' && piece.color === color) {
        pawns.push(String.fromCharCode(97 + file) + (rank + 1));
      }
    }
  }
  
  return pawns;
}

function isIsolatedPawn(pawnSquare, allPawns) {
  const file = pawnSquare[0];
  const adjacentFiles = [
    String.fromCharCode(file.charCodeAt(0) - 1),
    String.fromCharCode(file.charCodeAt(0) + 1)
  ];
  
  return !allPawns.some(square => adjacentFiles.includes(square[0]));
}

function isOnOpenFile(square, game) {
  const file = square[0];
  const board = game.board();
  
  for (let rank = 0; rank < 8; rank++) {
    const piece = board[rank][file.charCodeAt(0) - 97];
    if (piece && piece.type === 'p') {
      return false;
    }
  }
  
  return true;
}

function isOutpost(square, piece, game) {
  // Simplified outpost detection
  const rank = parseInt(square[1]);
  const isAdvanced = (piece.color === 'w' && rank >= 5) || (piece.color === 'b' && rank <= 4);
  
  return isAdvanced && !canBeCapturedByPawn(square, piece.color === 'w' ? 'b' : 'w', game);
}

function canBeCapturedByPawn(square, opponentColor, game) {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1]) - 1;
  
  const pawnCaptureSquares = opponentColor === 'w' ? 
    [String.fromCharCode(96 + file) + (rank), String.fromCharCode(98 + file) + (rank)] :
    [String.fromCharCode(96 + file) + (rank + 2), String.fromCharCode(98 + file) + (rank + 2)];
  
  return pawnCaptureSquares.some(sq => {
    const piece = game.get(sq);
    return piece && piece.type === 'p' && piece.color === opponentColor;
  });
}

function hasMovedPawnBefore(game, pawnSquare) {
  const history = game.history({ verbose: true });
  const file = pawnSquare[0];
  
  return history.some(move => {
    const piece = game.get(move.from);
    return piece && piece.type === 'p' && move.from[0] === file;
  });
}

function isActiveQueenSquare(square, game, color) {
  // Queen is active if it attacks multiple enemy pieces or controls key squares
  const tempGame = new Chess(game.fen());
  const queenMoves = tempGame.moves({ square, verbose: true });
  
  const attacks = queenMoves.filter(move => move.captured);
  const controlsCenter = queenMoves.some(move => 
    ['d4', 'd5', 'e4', 'e5'].includes(move.to)
  );
  
  return attacks.length >= 2 || controlsCenter;
}

function attacksEnemyPieces(game, move, color) {
  const tempGame = new Chess(game.fen());
  tempGame.move(move);
  
  const pieceMoves = tempGame.moves({ square: move.to, verbose: true });
  return pieceMoves.some(m => m.captured);
}

function isPawnBreak(game, move, color) {
  const piece = game.get(move.from);
  if (piece.type !== 'p') return false;
  
  // Check if pawn move attacks enemy pawn or breaks pawn chain
  const tempGame = new Chess(game.fen());
  const moveObj = tempGame.move(move);
  
  return moveObj && (moveObj.captured === 'p' || 
    breaksEnemyPawnChain(tempGame, move.to, color));
}

function breaksEnemyPawnChain(game, square, color) {
  // Simplified pawn chain break detection
  const opponentColor = color === 'w' ? 'b' : 'w';
  const file = square[0];
  const rank = parseInt(square[1]);
  
  // Check adjacent files for enemy pawns
  const adjacentFiles = [
    String.fromCharCode(file.charCodeAt(0) - 1),
    String.fromCharCode(file.charCodeAt(0) + 1)
  ];
  
  return adjacentFiles.some(adjFile => {
    const adjSquare = adjFile + rank;
    const piece = game.get(adjSquare);
    return piece && piece.type === 'p' && piece.color === opponentColor;
  });
}

function countDefenders(game, square, color) {
  const moves = game.moves({ verbose: true });
  return moves.filter(move => {
    const piece = game.get(move.from);
    return piece && piece.color === color && move.to === square;
  }).length;
}

// function getGamePhaseTransition(game) {
//   // Import this from gamePhaseDetector if needed, or implement locally
//   const totalMaterial = getTotalMaterial(game);
//   const moveNumber = Math.floor(game.moveNumber() / 2) + 1;
  
//   let transition = 0;
//   transition += Math.max(0, (4000 - totalMaterial) / 4000) * 0.6;
//   transition += Math.min(1, Math.max(0, (moveNumber - 10) / 30)) * 0.4;
  
//   return Math.min(1, transition);
// }

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