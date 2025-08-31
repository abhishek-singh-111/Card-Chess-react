// src/utils/endgameAI.js - Enhanced Endgame AI with Material-Based Strategy
import { Chess } from "chess.js";
import { getMaterialBalance } from "./gamePhaseDetector";

// Endgame-optimized piece values
const ENDGAME_PIECE_VALUES = {
  p: 120, // Pawns more valuable in endgame
  n: 300, // Knights less effective in endgame
  b: 320, // Bishops slightly less valuable
  r: 550, // Rooks more powerful in endgame
  q: 950, // Queen even more dominant
  k: 0,   // King activity is handled separately
};

// Enhanced endgame king table - promotes centralization and activity
const ENDGAME_KING_TABLE = [
  -50, -30, -30, -30, -30, -30, -30, -50,
  -30, -30,   0,   0,   0,   0, -30, -30,
  -30, -10,  20,  30,  30,  20, -10, -30,
  -30, -10,  30,  40,  40,  30, -10, -30,
  -30, -10,  30,  40,  40,  30, -10, -30,
  -30, -10,  20,  30,  30,  20, -10, -30,
  -30, -20, -10,   0,   0, -10, -20, -30,
  -50, -40, -30, -20, -20, -30, -40, -50,
];

// Winning endgame king table - more aggressive
const WINNING_KING_TABLE = [
  -30, -20, -10,   0,   0, -10, -20, -30,
  -20,  10,  20,  30,  30,  20,  10, -20,
  -10,  20,  40,  50,  50,  40,  20, -10,
  0,    30,  50,  60,  60,  50,  30,   0,
  0,    30,  50,  60,  60,  50,  30,   0,
  -10,  20,  40,  50,  50,  40,  20, -10,
  -20,  10,  20,  30,  30,  20,  10, -20,
  -30, -20, -10,   0,   0, -10, -20, -30,
];

// Losing endgame king table - defensive
const LOSING_KING_TABLE = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10,   0,   0,   0,   0,   0,   0, -10,
  -10,   0,  10,  15,  15,  10,   0, -10,
  -10,   0,  15,  20,  20,  15,   0, -10,
  -10,   0,  15,  20,  20,  15,   0, -10,
  -10,   0,  10,  15,  15,  10,   0, -10,
  -10,   0,   0,   0,   0,   0,   0, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
];

// Enhanced endgame pawn table
const ENDGAME_PAWN_TABLE = [
  0,   0,   0,   0,   0,   0,   0,   0,
  300, 300, 300, 300, 300, 300, 300, 300, // 7th rank - about to promote
  150, 150, 150, 150, 150, 150, 150, 150, // 6th rank
  80,  80,  80,  80,  80,  80,  80,  80,  // 5th rank
  40,  40,  40,  40,  40,  40,  40,  40,  // 4th rank
  20,  20,  20,  20,  20,  20,  20,  20,  // 3rd rank
  10,  10,  10,  10,  10,  10,  10,  10,  // 2nd rank
  0,   0,   0,   0,   0,   0,   0,   0,
];

/**
 * Convert square notation to array index
 */
function squareToIndex(square, isWhite = true) {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1]) - 1;
  const adjustedRank = isWhite ? 7 - rank : rank;
  return adjustedRank * 8 + file;
}

/**
 * Get king position for a color
 */
export function getKingSquare(game, color) {
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

/**
 * Calculate distance between two squares (Chebyshev distance)
 */
export function getSquareDistance(square1, square2) {
  const file1 = square1.charCodeAt(0) - 97;
  const rank1 = parseInt(square1[1]) - 1;
  const file2 = square2.charCodeAt(0) - 97;
  const rank2 = parseInt(square2[1]) - 1;
  
  return Math.max(Math.abs(file1 - file2), Math.abs(rank1 - rank2));
}

/**
 * Count legal moves for a king (mobility)
 */
export function getKingMobility(game, color) {
  const moves = game.moves({ verbose: true });
  return moves.filter(move => {
    const piece = game.get(move.from);
    return piece && piece.type === 'k' && piece.color === color;
  }).length;
}

/**
 * Get material advantage type
 */
function getMaterialAdvantageType(materialBalance) {
  if (materialBalance > 300) return "winning";
  if (materialBalance < -300) return "losing";
  return "equal";
}

/**
 * Enhanced endgame evaluation with material-based strategy
 */
export function evaluateEndgamePosition(game, color) {
  let score = 0;
  const board = game.board();
  //const opponentColor = color === 'w' ? 'b' : 'w';
  const materialBalance = getMaterialBalance(game, color);
  const advantageType = getMaterialAdvantageType(materialBalance);
  
  // Material evaluation with endgame values
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece) {
        const square = String.fromCharCode(97 + file) + (rank + 1);
        let pieceValue = ENDGAME_PIECE_VALUES[piece.type] || 0;
        let positionBonus = 0;
        
        // Apply material-specific position tables
        if (piece.type === 'k') {
          let kingTable;
          if (advantageType === "winning") {
            kingTable = WINNING_KING_TABLE;
          } else if (advantageType === "losing") {
            kingTable = LOSING_KING_TABLE;
          } else {
            kingTable = ENDGAME_KING_TABLE;
          }
          const tableIndex = squareToIndex(square, piece.color === "w");
          positionBonus = kingTable[tableIndex];
        } else if (piece.type === 'p') {
          const tableIndex = squareToIndex(square, piece.color === "w");
          positionBonus = ENDGAME_PAWN_TABLE[tableIndex];
        }
        
        const totalValue = pieceValue + positionBonus;
        
        if (piece.color === color) {
          score += totalValue;
        } else {
          score -= totalValue;
        }
      }
    }
  }
  
  // Material-specific strategic bonuses
  if (advantageType === "winning") {
    score += evaluateWinningStrategy(game, color);
  } else if (advantageType === "losing") {
    score += evaluateLosingStrategy(game, color);
  }
  
  return score;
}

/**
 * Evaluate strategy when winning material
 */
function evaluateWinningStrategy(game, color) {
  let score = 0;
  const myKingSquare = getKingSquare(game, color);
  const opponentKingSquare = getKingSquare(game, color === 'w' ? 'b' : 'w');
  
  if (!myKingSquare || !opponentKingSquare) return 0;
  
  // 1. PRIORITY: Support pawn advancement
  const myPawns = getPawnsByColor(game, color);
  if (myPawns.length > 0) {
    // Find most advanced pawn
    const mostAdvancedPawn = getMostAdvancedPawn(myPawns, color);
    if (mostAdvancedPawn) {
      const distanceToAdvancedPawn = getSquareDistance(myKingSquare, mostAdvancedPawn);
      
      // King should be close to advanced pawns (2-3 squares ideal)
      if (distanceToAdvancedPawn <= 2) {
        score += 400; // High priority for pawn support
      } else if (distanceToAdvancedPawn <= 3) {
        score += 200;
      } else {
        score -= distanceToAdvancedPawn * 50; // Penalty for being far from pawns
      }
    }
  }
  
  // 2. Restrict opponent king from stopping pawns
  const restrictionBonus = evaluateKingRestriction(myKingSquare, opponentKingSquare, myPawns, color);
  score += restrictionBonus;
  
  // 3. Control key squares for pawn promotion
  score += evaluatePromotionSquareControl(game, color);
  
  return score;
}

/**
 * Evaluate strategy when losing material
 */
function evaluateLosingStrategy(game, color) {
  let score = 0;
  const myKingSquare = getKingSquare(game, color);
  const opponentKingSquare = getKingSquare(game, color === 'w' ? 'b' : 'w');
  const opponentPawns = getPawnsByColor(game, color === 'w' ? 'b' : 'w');
  
  if (!myKingSquare || !opponentKingSquare) return 0;
  
  // 1. PRIORITY: Block opponent's most dangerous pawn
  if (opponentPawns.length > 0) {
    const mostDangerousPawn = getMostAdvancedPawn(opponentPawns, color === 'w' ? 'b' : 'w');
    if (mostDangerousPawn) {
      const blockadeDistance = getSquareDistance(myKingSquare, mostDangerousPawn);
      
      // King should blockade dangerous pawns
      if (blockadeDistance <= 2) {
        score += 600; // Very high priority for blocking
      } else if (blockadeDistance <= 3) {
        score += 300;
      } else {
        score -= blockadeDistance * 80; // Heavy penalty for being far from dangerous pawns
      }
    }
  }
  
  // 2. Stay centralized to cover multiple threats
  const centralization = calculateCentralization(myKingSquare);
  score += centralization * 100;
  
  // 3. Try to stay close to opponent king for counterplay
  const kingDistance = getSquareDistance(myKingSquare, opponentKingSquare);
  if (kingDistance <= 3) {
    score += 150; // Stay close for opposition/counterplay
  }
  
  return score;
}

/**
 * Get most advanced pawn for a color
 */
function getMostAdvancedPawn(pawns, color) {
  if (pawns.length === 0) return null;
  
  return pawns.reduce((mostAdvanced, pawn) => {
    const pawnRank = parseInt(pawn[1]);
    const advancedRank = parseInt(mostAdvanced[1]);
    
    if (color === 'w') {
      return pawnRank > advancedRank ? pawn : mostAdvanced;
    } else {
      return pawnRank < advancedRank ? pawn : mostAdvanced;
    }
  });
}

/**
 * Evaluate how well king restricts opponent from stopping pawns
 */
function evaluateKingRestriction(myKing, opponentKing, myPawns, color) {
  let restriction = 0;
  
  if (myPawns.length === 0) return 0;
  
  const mostAdvancedPawn = getMostAdvancedPawn(myPawns, color);
  if (!mostAdvancedPawn) return 0;
  
  // Calculate if our king cuts off opponent king from the pawn
  const pawnToOpponentKing = getSquareDistance(mostAdvancedPawn, opponentKing);
  const myKingToOpponentKing = getSquareDistance(myKing, opponentKing);
  
  // If our king is between opponent king and our pawn (or close to it)
  if (myKingToOpponentKing < pawnToOpponentKing) {
    restriction += 300;
  }
  
  // Opposition benefits
  if (hasOpposition(myKing, opponentKing, color)) {
    restriction += 200;
  }
  
  return restriction;
}

/**
 * Enhanced move scoring with material-based strategy and better risk assessment
 */
export function calculateEndgameMoveScore(game, move, availableCards, color) {
  //const piece = game.get(move.from);
  let score = 0;
  const reasons = [];
  const materialBalance = getMaterialBalance(game, color);
  const advantageType = getMaterialAdvantageType(materialBalance);
  
  // Make temporary move
  const tempGame = new Chess(game.fen());
  const moveObj = tempGame.move(move);
  
  if (!moveObj) return { score: -10000, reasons: ["Illegal move"] };
  
  // CRITICAL: Checkmate detection
  if (tempGame.isCheckmate()) {
    return { score: 1000000, reasons: ["CHECKMATE!"] };
  }
  
  // CRITICAL: Enhanced stalemate detection
  if (tempGame.isStalemate()) {
    if (materialBalance > 100) {
      // We're winning but caused stalemate - massive penalty
      return { score: -999999, reasons: ["CAUSES STALEMATE WHEN WINNING!"] };
    } else {
      // We're losing and caused stalemate - good for us
      return { score: 500000, reasons: ["Saves with stalemate"] };
    }
  }
  
  // Position evaluation
  const beforeEval = evaluateEndgamePosition(game, color);
  const afterEval = evaluateEndgamePosition(tempGame, color);
  const positionImprovement = afterEval - beforeEval;
  score += positionImprovement;
  
  // Material-specific strategy evaluation
  const strategyScore = evaluateMaterialSpecificStrategy(game, move, advantageType, color);
  score += strategyScore.score;
  reasons.push(...strategyScore.reasons);
  
  // Enhanced check evaluation with proper risk assessment
  if (tempGame.isCheck()) {
    const checkScore = evaluateCheckMove(game, move, materialBalance, color);
    score += checkScore.score;
    reasons.push(...checkScore.reasons);
  }
  
  // Anti-repetition mechanism
  const repetitionPenalty = calculateRepetitionPenalty(game, move, color);
  score -= repetitionPenalty;
  if (repetitionPenalty > 0) {
    reasons.push("Anti-repetition penalty");
  }
  
  // King mobility restriction (important but not overwhelming)
  const opponentColor = color === 'w' ? 'b' : 'w';
  const opponentMobility = getKingMobility(tempGame, opponentColor);
  const mobilityRestriction = (8 - opponentMobility) * 30; // Reduced from 80
  score += mobilityRestriction;
  
  if (opponentMobility <= 1) {
    score += 200; // Reduced from 500
    reasons.push("Severely limits opponent king");
  } else if (opponentMobility <= 3) {
    score += 80; // Reduced from 200
    reasons.push("Limits opponent king mobility");
  }
  
  return { score, reasons };
}

/**
 * Material-specific strategy evaluation
 */
function evaluateMaterialSpecificStrategy(game, move, advantageType, color) {
  const piece = game.get(move.from);
  let score = 0;
  const reasons = [];
  
  if (advantageType === "winning") {
    // WINNING STRATEGY: Advance pawns, support with king
    if (piece.type === 'k') {
      const kingWinningScore = evaluateWinningKingMove(game, move, color);
      score += kingWinningScore.score;
      reasons.push(...kingWinningScore.reasons);
    } else if (piece.type === 'p') {
      const pawnAdvanceScore = evaluatePawnAdvancementWinning(game, move, color);
      score += pawnAdvanceScore.score;
      reasons.push(...pawnAdvanceScore.reasons);
    }
  } else if (advantageType === "losing") {
    // LOSING STRATEGY: Block opponent pawns, seek counterplay
    if (piece.type === 'k') {
      const kingDefenseScore = evaluateDefensiveKingMove(game, move, color);
      score += kingDefenseScore.score;
      reasons.push(...kingDefenseScore.reasons);
    }
  }
  
  return { score, reasons };
}

/**
 * Evaluate king moves when winning
 */
function evaluateWinningKingMove(game, move, color) {
  let score = 0;
  const reasons = [];
  const myPawns = getPawnsByColor(game, color);
  
  if (myPawns.length > 0) {
    const mostAdvancedPawn = getMostAdvancedPawn(myPawns, color);
    const distanceToPawn = getSquareDistance(move.to, mostAdvancedPawn);
    
    // PRIORITY 1: Support most advanced pawn
    if (distanceToPawn === 1) {
      score += 800; // High bonus for direct pawn support
      reasons.push("King directly supports advanced pawn");
    } else if (distanceToPawn === 2) {
      score += 400;
      reasons.push("King moves to support pawn");
    } else if (distanceToPawn > 4) {
      score -= 300; // Penalty for moving away from pawns
      reasons.push("King moves away from critical pawns");
    }
    
    // PRIORITY 2: Clear path for pawn advancement
    if (clearsPawnPath(game, move, mostAdvancedPawn, color)) {
      score += 500;
      reasons.push("Clears path for pawn promotion");
    }
  }
  
  // PRIORITY 3: Cut off opponent king from our pawns
  const opponentKingSquare = getKingSquare(game, color === 'w' ? 'b' : 'w');
  if (opponentKingSquare && myPawns.length > 0) {
    const cutoffScore = evaluateKingCutoff(move.to, opponentKingSquare, myPawns, color);
    score += cutoffScore;
    if (cutoffScore > 0) {
      reasons.push("King cuts off opponent from pawns");
    }
  }
  
  return { score, reasons };
}

/**
 * Evaluate king moves when losing
 */
function evaluateDefensiveKingMove(game, move, color) {
  let score = 0;
  const reasons = [];
  const opponentPawns = getPawnsByColor(game, color === 'w' ? 'b' : 'w');
  
  if (opponentPawns.length > 0) {
    const mostDangerousPawn = getMostAdvancedPawn(opponentPawns, color === 'w' ? 'b' : 'w');
    const distanceToThreat = getSquareDistance(move.to, mostDangerousPawn);
    
    // PRIORITY 1: Block most dangerous pawn
    if (distanceToThreat === 1) {
      score += 900; // Very high priority for blocking
      reasons.push("King blocks dangerous pawn");
    } else if (distanceToThreat === 2) {
      score += 450;
      reasons.push("King moves to block pawn");
    }
    
    // PRIORITY 2: Get in front of passed pawns
    if (isPassedPawn(game, mostDangerousPawn, color === 'w' ? 'b' : 'w')) {
      if (canBlockPawn(move.to, mostDangerousPawn, color === 'w' ? 'b' : 'w')) {
        score += 700;
        reasons.push("King blocks passed pawn");
      }
    }
  }
  
  return { score, reasons };
}

/**
 * Enhanced check evaluation with proper risk assessment
 */
function evaluateCheckMove(game, move, materialBalance, color) {
  let score = 150; // Base check bonus (reduced from 300)
  const reasons = ["Delivers check"];
  const piece = game.get(move.from);
  
  // Risk assessment for checking moves
  const tempGame = new Chess(game.fen());
  tempGame.move(move);
  
  // Check if our piece becomes vulnerable after giving check
  const opponentMoves = tempGame.moves({ verbose: true });
  const canCaptureCheckingPiece = opponentMoves.filter(m => 
    m.to === move.to && m.captured === piece.type
  );
  
  if (canCaptureCheckingPiece.length > 0) {
    const pieceValue = ENDGAME_PIECE_VALUES[piece.type];
    const defenders = countDefenders(tempGame, move.to, color);
    
    if (defenders === 0) {
      // Undefended checking piece - major risk assessment
      score -= pieceValue * 0.7; // Heavy penalty
      reasons.push("CHECK PIECE BECOMES HANGING!");
      
      // Only worth it if we're desperately behind
      if (materialBalance < -500) {
        score += pieceValue * 0.3; // Partial recovery if desperate
        reasons.push("Desperate check when losing");
      }
    } else if (canCaptureCheckingPiece.length > defenders) {
      // Piece will be captured in unfavorable trade
      const attackerValues = canCaptureCheckingPiece.map(m => {
        const attackingPiece = tempGame.get(m.from);
        return ENDGAME_PIECE_VALUES[attackingPiece.type];
      });
      const minAttackerValue = Math.min(...attackerValues);
      
      if (pieceValue > minAttackerValue) {
        score -= (pieceValue - minAttackerValue) * 0.5;
        reasons.push("Check leads to unfavorable trade");
      }
    }
  }
  
  // Bonus for checks that lead to material gain or better position
  if (tempGame.isCheckmate()) {
    score += 999850; // Ensure checkmate is always chosen
    reasons.push("Check leads to mate!");
  } else {
    // Check if check leads to forced material gain
    const forcedGain = checkForForcedMaterialGain(tempGame, color);
    if (forcedGain > 0) {
      score += forcedGain;
      reasons.push("Check forces material gain");
    }
  }
  
  return { score, reasons };
}

/**
 * Calculate repetition penalty to avoid king dancing
 */
function calculateRepetitionPenalty(game, move, color) {
  const history = game.history({ verbose: true });
  if (history.length < 4) return 0;
  
  // Check last 8 moves for repetition patterns
  const recentMoves = history.slice(-8);
  const thisMove = `${move.from}-${move.to}`;
  
  // Count how many times this exact move was made recently
  const thisMoveCounts = recentMoves.filter(m => 
    m.color === color && `${m.from}-${m.to}` === thisMove
  ).length;
  
  // Heavy penalty for immediate repetition
  if (thisMoveCounts > 0) {
    return 400 + (thisMoveCounts * 200);
  }
  
  // Check for oscillation patterns (A-B-A-B)
  if (recentMoves.length >= 4) {
    const last4 = recentMoves.slice(-4);
    const myMoves = last4.filter(m => m.color === color);
    
    if (myMoves.length >= 2) {
      const [secondLast, last] = myMoves.slice(-2);
      const isOscillation = secondLast.from === move.to && secondLast.to === move.from;
      
      if (isOscillation) {
        return 600; // Heavy penalty for oscillation
      }
    }
  }
  
  return 0;
}

/**
 * Helper functions
 */
function clearsPawnPath(game, kingMove, pawnSquare, color) {
  // Check if king move removes itself from pawn's promotion path
  const pawnFile = pawnSquare[0];
  const pawnRank = parseInt(pawnSquare[1]);
  const kingFromFile = kingMove.from[0];
  const kingToFile = kingMove.to[0];
  
  // If king was blocking pawn's file and moves away
  if (kingFromFile === pawnFile && kingToFile !== pawnFile) {
    return true;
  }
  
  return false;
}

function evaluateKingCutoff(kingSquare, opponentKingSquare, myPawns, color) {
  if (myPawns.length === 0) return 0;
  
  const mostAdvancedPawn = getMostAdvancedPawn(myPawns, color);
  const pawnRank = parseInt(mostAdvancedPawn[1]);
  const kingRank = parseInt(kingSquare[1]);
  const oppKingRank = parseInt(opponentKingSquare[1]);
  
  // If our king is between opponent king and our pawn
  if (color === 'w') {
    if (kingRank > oppKingRank && kingRank <= pawnRank) {
      return 250;
    }
  } else {
    if (kingRank < oppKingRank && kingRank >= pawnRank) {
      return 250;
    }
  }
  
  return 0;
}

function evaluatePromotionSquareControl(game, color) {
  let control = 0;
  const myPawns = getPawnsByColor(game, color);
  
  myPawns.forEach(pawn => {
    const promotionSquare = getPromotionSquare(pawn, color);
    if (controlsSquare(game, promotionSquare, color)) {
      control += 100;
    }
  });
  
  return control;
}

function getPromotionSquare(pawnSquare, color) {
  const file = pawnSquare[0];
  const promotionRank = color === 'w' ? '8' : '1';
  return file + promotionRank;
}

function controlsSquare(game, square, color) {
  const moves = game.moves({ verbose: true });
  return moves.some(m => {
    const piece = game.get(m.from);
    return piece && piece.color === color && m.to === square;
  });
}

function canBlockPawn(kingSquare, pawnSquare, pawnColor) {
  const pawnFile = pawnSquare[0];
  const pawnRank = parseInt(pawnSquare[1]);
  const kingFile = kingSquare[0];
  const kingRank = parseInt(kingSquare[1]);
  
  // King is in front of pawn
  if (kingFile === pawnFile) {
    if (pawnColor === 'w' && kingRank > pawnRank) return true;
    if (pawnColor === 'b' && kingRank < pawnRank) return true;
  }
  
  return false;
}

function checkForForcedMaterialGain(game, color) {
  // Simplified check for obvious material gains after check
  const moves = game.moves({ verbose: true });
  const captures = moves.filter(m => m.captured);
  
  if (captures.length > 0) {
    const maxCapture = Math.max(...captures.map(m => ENDGAME_PIECE_VALUES[m.captured]));
    return maxCapture * 0.3; // Partial bonus for potential gains
  }
  
  return 0;
}

function countDefenders(game, square, color) {
  const moves = game.moves({ verbose: true });
  return moves.filter(move => {
    const piece = game.get(move.from);
    return piece && piece.color === color && move.to === square;
  }).length;
}

/**
 * Check if king has opposition
 */
function hasOpposition(myKing, opponentKing, color) {
  const myFile = myKing.charCodeAt(0) - 97;
  const myRank = parseInt(myKing[1]) - 1;
  const oppFile = opponentKing.charCodeAt(0) - 97;
  const oppRank = parseInt(opponentKing[1]) - 1;
  
  const fileDiff = Math.abs(myFile - oppFile);
  const rankDiff = Math.abs(myRank - oppRank);
  
  // Direct opposition
  return (fileDiff === 0 && rankDiff === 2) || (rankDiff === 0 && fileDiff === 2);
}

/**
 * Calculate how centralized a square is
 */
function calculateCentralization(square) {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1]) - 1;
  
  const distanceFromCenter = Math.max(
    Math.abs(3.5 - file),
    Math.abs(3.5 - rank)
  );
  
  return 4 - distanceFromCenter; // Higher score for more central
}

/**
 * Get pawns for a specific color
 */
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

/**
 * Check if pawn is passed
 */
export function isPassedPawn(game, pawnSquare, color) {
  const file = pawnSquare[0];
  const rank = parseInt(pawnSquare[1]);
  const opponentColor = color === 'w' ? 'b' : 'w';
  
  // Check files (same and adjacent) ahead of pawn
  const filesToCheck = [
    String.fromCharCode(file.charCodeAt(0) - 1),
    file,
    String.fromCharCode(file.charCodeAt(0) + 1)
  ];
  
  const ranksToCheck = color === 'w' ? 
    Array.from({length: 8 - rank}, (_, i) => rank + i + 1) :
    Array.from({length: rank - 1}, (_, i) => rank - i - 1);
  
  for (const checkFile of filesToCheck) {
    if (checkFile < 'a' || checkFile > 'h') continue;
    
    for (const checkRank of ranksToCheck) {
      const checkSquare = checkFile + checkRank;
      const piece = game.get(checkSquare);
      if (piece && piece.type === 'p' && piece.color === opponentColor) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Evaluate pawn advancement when winning
 */
function evaluatePawnAdvancementWinning(game, move, color) {
  let score = 0;
  const reasons = [];
  
  const rank = parseInt(move.to[1]);
  const promotionDistance = color === 'w' ? (8 - rank) : (rank - 1);
  
  // Massive bonus for promotion
  if (promotionDistance === 0) {
    score += 8000;
    reasons.push("PAWN PROMOTES TO QUEEN!");
  } else if (promotionDistance === 1) {
    score += 4000;
    reasons.push("Pawn one step from promotion!");
  } else if (promotionDistance <= 3) {
    score += 1000;
    reasons.push("Pawn advances toward promotion");
  }
  
  // Extra bonus if pawn is passed
  if (isPassedPawn(game, move.to, color)) {
    score += 500;
    reasons.push("Advances passed pawn");
  }
  
  // King support evaluation
  const myKingSquare = getKingSquare(game, color);
  if (myKingSquare) {
    const kingSupport = getSquareDistance(myKingSquare, move.to);
    if (kingSupport <= 2) {
      score += 200;
      reasons.push("Pawn has strong king support");
    }
  }
  
  return { score, reasons };
}

/**
 * Check if we have sufficient mating material
 */
export function hasMatingMaterial(game, color) {
  const pieces = [];
  const board = game.board();
  
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece && piece.color === color && piece.type !== 'k') {
        pieces.push(piece.type);
      }
    }
  }
  
  // Sufficient mating material conditions
  if (pieces.includes('q')) return true;
  if (pieces.includes('r')) return true;
  if (pieces.filter(p => p === 'p').length > 0) return true; // Pawns can promote
  if (pieces.includes('b') && pieces.includes('n')) return true;
  if (pieces.filter(p => p === 'n').length >= 2 && pieces.length >= 3) return true;
  
  return false;
}

/**
 * Check if move would cause stalemate
 */
export function wouldCauseStalemate(game, move) {
  const tempGame = new Chess(game.fen());
  try {
    tempGame.move(move);
    return tempGame.isStalemate();
  } catch {
    return false;
  }
}

/**
 * Find the best mating sequence if one exists
 */
export function findMatingSequence(game, color, depth = 3) {
  if (depth <= 0) return null;
  
  const moves = game.moves({ verbose: true });
  
  for (const move of moves) {
    const tempGame = new Chess(game.fen());
    tempGame.move(move);
    
    if (tempGame.isCheckmate()) {
      return [move]; // Found mate in 1
    }
    
    if (tempGame.isCheck() && depth > 1) {
      // Recursive search for forced mate
      const continuations = findMatingSequence(tempGame, color === 'w' ? 'b' : 'w', depth - 1);
      if (continuations) {
        return [move, ...continuations];
      }
    }
  }
  
  return null;
}

/**
 * Enhanced pawn advancement prioritization
 */
export function evaluatePawnAdvancement(game, color) {
  const myPawns = getPawnsByColor(game, color);
  const evaluations = [];
  
  myPawns.forEach(pawn => {
    const rank = parseInt(pawn[1]);
    const promotionDistance = color === 'w' ? (8 - rank) : (rank - 1);
    const isPassed = isPassedPawn(game, pawn, color);
    const hasKingSupport = hasKingSupportForPawn(game, pawn, color);
    
    evaluations.push({
      square: pawn,
      promotionDistance,
      isPassed,
      hasKingSupport,
      priority: calculatePawnPriority(promotionDistance, isPassed, hasKingSupport)
    });
  });
  
  return evaluations.sort((a, b) => b.priority - a.priority);
}

function calculatePawnPriority(distance, isPassed, hasKingSupport) {
  let priority = (8 - distance) * 100;
  if (isPassed) priority += 200;
  if (hasKingSupport) priority += 150;
  return priority;
}

function hasKingSupportForPawn(game, pawnSquare, color) {
  const kingSquare = getKingSquare(game, color);
  if (!kingSquare) return false;
  
  return getSquareDistance(kingSquare, pawnSquare) <= 2;
}