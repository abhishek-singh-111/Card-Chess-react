// src/utils/enhancedSmartAI.js - Enhanced Main AI with Better Endgame Strategy
import { Chess } from "chess.js";
import { 
  getGamePhase, 
  isEndgame, 
  getMaterialBalance, 
  getGamePhaseTransition 
} from "./gamePhaseDetector";
import { 
  calculateOpeningMiddlegameMoveScore

} from "./openingMiddlegameAI";
import { 
  calculateEndgameMoveScore, 
  findMatingSequence,
  wouldCauseStalemate,
  evaluatePawnAdvancement
} from "./endgameAI";

/**
 * Check if move is allowed by available cards
 */
function isMoveAllowedByCards(game, move, availableCards) {
  const piece = game.get(move.from);
  if (!piece) return false;

  return availableCards.some((cardId) => {
    // Pawn cards are file-specific
    if (cardId.startsWith("pawn-")) {
      const file = cardId.split("-")[1];
      return piece.type === "p" && move.from[0] === file;
    }

    // Other piece cards
    const normalizedCardId = cardId.toLowerCase();
    const cardToPieceType = {
      knight: "n", n: "n",
      bishop: "b", b: "b", 
      rook: "r", r: "r",
      queen: "q", q: "q",
      king: "k", k: "k",
      pawn: "p", p: "p",
    };

    return piece.type === cardToPieceType[normalizedCardId];
  });
}

/**
 * Enhanced position danger calculation
 */
function getPositionDanger(game, color) {
  let dangerLevel = 0;

  // In check
  if (game.isCheck() && game.turn() === color) {
    dangerLevel += 6; // Increased from 4
  }

  // King safety evaluation - much more important in opening
  const gamePhase = getGamePhaseTransition(game);
  if (gamePhase < 0.4) { // Opening phase
    const kingDanger = evaluateKingSafetyDanger(game, color);
    dangerLevel += kingDanger;
  }

  // Material disadvantage (reduced impact)
  const materialBalance = getMaterialBalance(game, color);
  if (materialBalance < -200) dangerLevel += 1; // Reduced from 2
  if (materialBalance < -500) dangerLevel += 2; // Reduced from 2
  if (materialBalance < -800) dangerLevel += 2; // Reduced from 2

  // Immediate piece threats
  const pieceThreats = countHangingPieces(game, color);
  dangerLevel += pieceThreats * 2;

  return Math.min(dangerLevel, 10);
}

/**
 * Count immediate threats to pieces of a specific color
 */


/**
 * Get piece value
 */
function getPieceValue(pieceType) {
  const values = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
  return values[pieceType] || 0;
}

/**
 * Check if king has castled
 */
function isCastled(game, color) {
  const history = game.history({ verbose: true });
  return history.some(move => 
    move.color === color && 
    (move.flags.includes("k") || move.flags.includes("q"))
  );
}

/**
 * Enhanced move evaluation with better endgame handling
 */
function evaluateMovesWithPhaseSpecificLogic(game, availableCards, color) {
  const gamePhase = getGamePhase(game);
  const dangerLevel = getPositionDanger(game, color);
  const inEndgame = isEndgame(game);
  const materialBalance = getMaterialBalance(game, color);
  
  console.log(`🎯 AI Analysis - Phase: ${gamePhase}, Danger: ${dangerLevel}, Material: ${materialBalance}`);

  // Get all legal moves that match available cards
  const allMoves = game.moves({ verbose: true });
  const allowedMoves = allMoves.filter(move => 
    isMoveAllowedByCards(game, move, availableCards)
  );

  if (allowedMoves.length === 0) {
    return [];
  }

  // PRIORITY 1: Look for forced checkmate
  if (inEndgame) {
    const matingSequence = findMatingSequence(game, color, 2);
    if (matingSequence && matingSequence.length > 0) {
      const firstMove = matingSequence[0];
      if (allowedMoves.some(m => m.from === firstMove.from && m.to === firstMove.to)) {
        console.log(`🏆 Found forced mate sequence starting with ${firstMove.san}`);
        return [{
          move: firstMove,
          score: 1000000,
          reasoning: ["Forced mate sequence!"],
          gamePhase,
          dangerLevel
        }];
      }
    }
  }

  // PRIORITY 2: Enhanced stalemate prevention
  const safeAllowedMoves = allowedMoves.filter(move => {
    if (wouldCauseStalemate(game, move)) {
      // Only allow stalemate if we're significantly losing
      return materialBalance < -200;
    }
    return true;
  });

  const movesToEvaluate = safeAllowedMoves.length > 0 ? safeAllowedMoves : allowedMoves;

  // PRIORITY 3: Enhanced endgame strategy filtering
  let filteredMoves = movesToEvaluate;
  
  if (inEndgame) {
    filteredMoves = applyEndgameMovePriorities(game, movesToEvaluate, color, materialBalance);
  }

  // PRIORITY 4: Phase-specific move evaluation


  // PRIORITY 3.5: Filter out obviously unsafe moves in opening
if (getGamePhase(game) === "opening") {
  const materialBalance = getMaterialBalance(game, color);
  
  filteredMoves = filteredMoves.filter(move => {
    // Quick safety check - don't hang pieces unless desperate
    if (materialBalance > -300) {
      const tempGame = new Chess(game.fen());
      tempGame.move(move);
      
      const attackers = countAttackersOnSquare(tempGame, move.to, color === 'w' ? 'b' : 'w');
      const defenders = countDefenders(tempGame, move.to, color);
      
      if (attackers > defenders) {
        const piece = game.get(move.from);
        const pieceValue = getPieceValue(piece.type);
        
        // Don't hang pieces worth 300+ unless we're losing badly
        if (pieceValue >= 300) {
          return false;
        }
      }
    }
    return true;
  });
  
  // If all moves hang pieces, allow them (desperate situation)
  if (filteredMoves.length === 0) {
    filteredMoves = movesToEvaluate;
  }
}
  const scoredMoves = filteredMoves.map(move => {
    let evaluation;
    
    if (inEndgame) {
      evaluation = calculateEndgameMoveScore(game, move, availableCards, color);
      
      // Apply material-based endgame adjustments
      evaluation = applyMaterialBasedEndgameBonus(game, move, evaluation, materialBalance, color);
    } else {
      evaluation = calculateOpeningMiddlegameMoveScore(game, move, availableCards, color);
    }

    // Apply danger-based adjustments
    if (dangerLevel > 6) {
      evaluation = applyEmergencyAdjustments(game, move, evaluation, color);
    }

    return {
      move,
      score: evaluation.score,
      reasoning: evaluation.reasons,
      gamePhase,
      dangerLevel,
      piece: game.get(move.from)
    };
  });

  // Sort by score (highest first)
  scoredMoves.sort((a, b) => b.score - a.score);

  // Enhanced debug logging
  console.log("🔍 Top 3 moves evaluated:");
  scoredMoves.slice(0, 3).forEach((sm, i) => {
    console.log(`${i + 1}. ${sm.move.san} (${sm.move.from}-${sm.move.to}) - Score: ${sm.score}`);
    console.log(`   Reasons: ${sm.reasoning.slice(0, 3).join(", ")}`);
    if (inEndgame) {
      console.log(`   Material Strategy: ${materialBalance > 0 ? "WINNING" : materialBalance < -200 ? "LOSING" : "EQUAL"}`);
    }
  });

  return scoredMoves;
}

/**
 * Apply endgame move priorities to prevent dancing
 */
function applyEndgameMovePriorities(game, moves, color, materialBalance) {
  const myPawns = getPawnsByColor(game, color);
  const opponentPawns = getPawnsByColor(game, color === 'w' ? 'b' : 'w');
  
  // When winning: Prioritize pawn moves and king moves that support pawns
  if (materialBalance > 100 && myPawns.length > 0) {
    const pawnEvaluations = evaluatePawnAdvancement(game, color);
    const topPriority = pawnEvaluations[0];
    
    if (topPriority && topPriority.promotionDistance <= 3) {
      // Filter to moves that advance top priority pawn or support it with king
      const priorityMoves = moves.filter(move => {
        const piece = game.get(move.from);
        
        // Direct pawn advancement
        if (piece.type === 'p' && move.from === topPriority.square) {
          return true;
        }
        
        // King moves that support the priority pawn
        if (piece.type === 'k') {
          const distanceToPawn = getSquareDistance(move.to, topPriority.square);
          const currentDistance = getSquareDistance(move.from, topPriority.square);
          return distanceToPawn <= currentDistance; // Moving closer or staying close
        }
        
        return false;
      });
      
      // If we have priority moves, use them; otherwise fall back to all moves
      if (priorityMoves.length > 0) {
        console.log(`🎯 WINNING STRATEGY: Focusing on pawn ${topPriority.square} (${priorityMoves.length} priority moves)`);
        return priorityMoves;
      }
    }
  }
  
  // When losing: Prioritize blocking opponent pawns
  if (materialBalance < -200 && opponentPawns.length > 0) {
    const opponentPawnEvals = evaluatePawnAdvancement(game, color === 'w' ? 'b' : 'w');
    const mostDangerous = opponentPawnEvals[0];
    
    if (mostDangerous && mostDangerous.promotionDistance <= 4) {
      // Filter to moves that block or approach the dangerous pawn
      const defensiveMoves = moves.filter(move => {
        const piece = game.get(move.from);
        
        if (piece.type === 'k') {
          const distanceToThreat = getSquareDistance(move.to, mostDangerous.square);
          const currentDistance = getSquareDistance(move.from, mostDangerous.square);
          return distanceToThreat <= currentDistance + 1; // Moving toward threat
        }
        
        return false;
      });
      
      if (defensiveMoves.length > 0) {
        console.log(`🛡️ LOSING STRATEGY: Blocking pawn ${mostDangerous.square} (${defensiveMoves.length} defensive moves)`);
        return defensiveMoves;
      }
    }
  }
  
  return moves; // No filtering needed
}

/**
 * Apply material-based bonuses to endgame evaluation
 */
function applyMaterialBasedEndgameBonus(game, move, evaluation, materialBalance, color) {
  const piece = game.get(move.from);
  let adjustedScore = evaluation.score;
  const adjustedReasons = [...evaluation.reasons];
  
  // When winning materially
  if (materialBalance > 100) {
    if (piece.type === 'p') {
      // Extra bonus for pawn advancement when winning
      const rank = parseInt(move.to[1]);
      const promotionDistance = color === 'w' ? (8 - rank) : (rank - 1);
      
      if (promotionDistance <= 2) {
        adjustedScore += 2000;
        adjustedReasons.push("CRITICAL: Pawn near promotion (winning)");
      } else if (promotionDistance <= 4) {
        adjustedScore += 800;
        adjustedReasons.push("Advances winning pawn");
      }
    }
    
    if (piece.type === 'k') {
      // King should actively support pawns when winning
      const myPawns = getPawnsByColor(game, color);
      if (myPawns.length > 0) {
        const closestPawn = myPawns.reduce((closest, pawn) => {
          const dist = getSquareDistance(move.to, pawn);
          return dist < getSquareDistance(move.to, closest) ? pawn : closest;
        });
        
        const supportDistance = getSquareDistance(move.to, closestPawn);
        if (supportDistance <= 2) {
          adjustedScore += 400;
          adjustedReasons.push("King actively supports pawns (winning)");
        }
      }
    }
  }
  
  // When losing materially
  if (materialBalance < -200) {
    if (piece.type === 'k') {
      // King should prioritize blocking opponent pawns
      const opponentPawns = getPawnsByColor(game, color === 'w' ? 'b' : 'w');
      if (opponentPawns.length > 0) {
        const mostDangerous = getMostAdvancedPawn(opponentPawns, color === 'w' ? 'b' : 'w');
        if (mostDangerous) {
          const blockDistance = getSquareDistance(move.to, mostDangerous);
          if (blockDistance <= 2) {
            adjustedScore += 600;
            adjustedReasons.push("King blocks dangerous pawn (losing)");
          }
        }
      }
    }
  }
  
  return {
    score: adjustedScore,
    reasons: adjustedReasons
  };
}

/**
 * Enhanced emergency adjustments
 */
function applyEmergencyAdjustments(game, move, evaluation, color) {
  const piece = game.get(move.from);
  let adjustedScore = evaluation.score;
  const adjustedReasons = [...evaluation.reasons];

  // Prioritize getting out of check
  if (game.isCheck()) {
    const tempGame = new Chess(game.fen());
    tempGame.move(move);
    if (!tempGame.isCheck()) {
      adjustedScore += 2000; // Increased priority
      adjustedReasons.push("Escapes check");
    }
  }

  // Enhanced piece safety evaluation
  if (piece.type !== 'k' && isPieceAttacked(game, move.from, color)) {
    const pieceValue = getPieceValue(piece.type);
    adjustedScore += pieceValue * 0.8; // Bonus for saving attacked piece
    adjustedReasons.push("Saves attacked piece");
  }

  // Enhanced risk assessment for moving into attacks
  if (wouldMoveIntoAttack(game, move, color)) {
    // const pieceValue = getPieceValue(piece.type);
    const riskAssessment = assessMoveRisk(game, move, color);
    
    adjustedScore -= riskAssessment.penalty;
    if (riskAssessment.penalty > 0) {
      adjustedReasons.push(riskAssessment.reason);
    }
  }

  return {
    score: adjustedScore,
    reasons: adjustedReasons
  };
}

/**
 * Enhanced risk assessment for moves
 */
function assessMoveRisk(game, move, color) {
  const piece = game.get(move.from);
  const pieceValue = getPieceValue(piece.type);
  
  const tempGame = new Chess(game.fen());
  tempGame.move(move);
  
  const opponentMoves = tempGame.moves({ verbose: true });
  const attacksOnPiece = opponentMoves.filter(m => 
    m.to === move.to && m.captured === piece.type
  );
  
  if (attacksOnPiece.length === 0) {
    return { penalty: 0, reason: "" };
  }
  
  // Count defenders
  const defenders = countDefenders(tempGame, move.to, color);
  const attackers = attacksOnPiece.length;
  
  if (attackers > defenders) {
    return { 
      penalty: pieceValue * 0.9, 
      reason: "Piece becomes hanging" 
    };
  }
  
  if (attackers === defenders && attackers > 0) {
    // Evaluate trade value
    const attackerValues = attacksOnPiece.map(m => {
      const attackingPiece = tempGame.get(m.from);
      return getPieceValue(attackingPiece.type);
    });
    const minAttackerValue = Math.min(...attackerValues);
    
    if (pieceValue > minAttackerValue) {
      return { 
        penalty: (pieceValue - minAttackerValue) * 0.6, 
        reason: "Unfavorable trade setup" 
      };
    }
  }
  
  return { penalty: 0, reason: "" };
}

/**
 * Main enhanced AI function
 */
export function makeEnhancedCardChessMove(game, availableCards, aiColor) {
  const scoredMoves = evaluateMovesWithPhaseSpecificLogic(game, availableCards, aiColor);

  if (scoredMoves.length === 0) {
    return null;
  }

  // Enhanced move selection logic
  const topMoves = scoredMoves.slice(0, 3);
  
  // In endgame, add extra validation to prevent mindless king dancing
  if (isEndgame(game)) {
    const validatedMove = validateEndgameMove(game, topMoves, aiColor);
    if (validatedMove) {
      return validatedMove;
    }
  }

  // Return the best move
  return scoredMoves[0].move;
}

/**
 * Validate endgame move to prevent dancing and ensure strategic progress
 */
function validateEndgameMove(game, topMoves, color) {
  // const materialBalance = getMaterialBalance(game, color);
  const history = game.history({ verbose: true });
  
  // Check for recent repetition
  if (history.length >= 4) {
    const lastMoves = history.slice(-4);
    const myLastMoves = lastMoves.filter(m => m.color === color);
    
    if (myLastMoves.length >= 2) {
      const [secondLast] = myLastMoves.slice(-2);
      
      // Check if top move would create oscillation
      const topMove = topMoves[0].move;
      const wouldOscillate = (
        secondLast.from === topMove.to && 
        secondLast.to === topMove.from
      );
      
      if (wouldOscillate) {
       // console.log(`⚠️ Preventing oscillation: ${topMove.san} would repeat ${secondLast.san}`);
        
        // Look for non-oscillating alternatives
        const alternatives = topMoves.slice(1).filter(sm => {
          const move = sm.move;
          return !(secondLast.from === move.to && secondLast.to === move.from);
        });
        
        if (alternatives.length > 0) {
          console.log(`✅ Using alternative: ${alternatives[0].move.san}`);
          return alternatives[0].move;
        }
      }
    }
  }
  
  // No validation issues
  return topMoves[0].move;
}

/**
 * Helper functions
 */

/**
 * Enhanced king safety evaluation for danger calculation
 */
function evaluateKingSafetyDanger(game, color) {
  const kingSquare = getKingSquare(game, color);
  if (!kingSquare) return 0;

  let danger = 0;
  
  // King not on starting square without castling = danger
  const startingSquare = color === 'w' ? 'e1' : 'e8';
  if (kingSquare !== startingSquare && !isCastled(game, color)) {
    danger += 4; // Major danger for exposed king
    
    // Extra danger if king is in center files
    const file = kingSquare[0];
    if (['d', 'e'].includes(file)) {
      danger += 2;
    }
  }
  
  // Check for lack of castling rights
  if (game.moveNumber() > 10 && !isCastled(game, color) && !canCastle(game, color)) {
    danger += 2;
  }
  
  return danger;
}

/**
 * Count pieces that are currently hanging
 */
function countHangingPieces(game, color) {
  const board = game.board();
  let hangingCount = 0;
  
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece && piece.color === color && piece.type !== 'k') {
        const square = String.fromCharCode(97 + file) + (rank + 1);
        
        if (isPieceHanging(game, square, color)) {
          const pieceValue = getPieceValue(piece.type);
          if (pieceValue >= 300) { // Only count valuable pieces
            hangingCount++;
          }
        }
      }
    }
  }
  
  return hangingCount;
}

/**
 * Check if a piece is hanging
 */
function isPieceHanging(game, square, pieceColor) {
  const attackers = countAttackersOnSquare(game, square, pieceColor === 'w' ? 'b' : 'w');
  const defenders = countDefenders(game, square, pieceColor);
  
  return attackers > 0 && attackers > defenders;
}

/**
 * Count attackers on a specific square
 */
function countAttackersOnSquare(game, square, attackerColor) {
  const moves = game.moves({ verbose: true });
  return moves.filter(move => {
    const piece = game.get(move.from);
    return piece && piece.color === attackerColor && move.to === square;
  }).length;
}

/**
 * Get king square
 */
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

/**
 * Check if can castle
 */
function canCastle(game, color) {
  const castlingRights = game.getCastlingRights(color);
  return castlingRights.k || castlingRights.q;
}
function isPieceAttacked(game, square, pieceColor) {
  const moves = game.moves({ verbose: true });
  return moves.some(move => {
    const piece = game.get(move.from);
    return piece && piece.color !== pieceColor && move.to === square;
  });
}

function wouldMoveIntoAttack(game, move, color) {
  const tempGame = new Chess(game.fen());
  tempGame.move(move);
  
  const opponentMoves = tempGame.moves({ verbose: true });
  return opponentMoves.some(oppMove => oppMove.to === move.to && oppMove.captured);
}

function countDefenders(game, square, color) {
  const moves = game.moves({ verbose: true });
  return moves.filter(move => {
    const piece = game.get(move.from);
    return piece && piece.color === color && move.to === square;
  }).length;
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

function getSquareDistance(square1, square2) {
  const file1 = square1.charCodeAt(0) - 97;
  const rank1 = parseInt(square1[1]) - 1;
  const file2 = square2.charCodeAt(0) - 97;
  const rank2 = parseInt(square2[1]) - 1;
  
  return Math.max(Math.abs(file1 - file2), Math.abs(rank1 - rank2));
}

/**
 * Backward compatibility
 */
export function makeSmartAIMove(game, availableCards, aiColor) {
  return makeEnhancedCardChessMove(game, availableCards, aiColor);
}

/**
 * Simple fallback AI for comparison/backup
 */
export function makeSimpleSmartMove(game, availableCards, aiColor) {
  const allMoves = game.moves({ verbose: true });
  const allowedMoves = allMoves.filter(move =>
    isMoveAllowedByCards(game, move, availableCards)
  );

  if (allowedMoves.length === 0) {
    return allMoves[Math.floor(Math.random() * allMoves.length)];
  }

  // Simple priorities
  
  // 1. Checkmate
  const checkmateMoves = allowedMoves.filter(m => {
    const temp = new Chess(game.fen());
    temp.move(m);
    return temp.isCheckmate();
  });
  if (checkmateMoves.length > 0) return checkmateMoves[0];

  // 2. High-value captures
  const captureMoves = allowedMoves.filter(m => m.captured);
  if (captureMoves.length > 0) {
    captureMoves.sort((a, b) => getPieceValue(b.captured) - getPieceValue(a.captured));
    if (getPieceValue(captureMoves[0].captured) >= 300) {
      return captureMoves[0];
    }
  }

  // 3. Checks (with basic risk assessment)
  const checkMoves = allowedMoves.filter(m => {
    const temp = new Chess(game.fen());
    temp.move(m);
    return temp.isCheck();
  });
  
  if (checkMoves.length > 0) {
    // Filter out obviously bad checking moves
    const safeChecks = checkMoves.filter(m => {
      const piece = game.get(m.from);
      const pieceValue = getPieceValue(piece.type);
      
      // Don't sacrifice valuable pieces for check unless desperate
      const materialBalance = getMaterialBalance(game, aiColor);
      if (materialBalance > -300 && pieceValue >= 300) {
        return !wouldMoveIntoAttack(game, m, aiColor);
      }
      
      return true;
    });
    
    if (safeChecks.length > 0) {
      return safeChecks[Math.floor(Math.random() * safeChecks.length)];
    }
  }

  // 4. Random allowed move
  return allowedMoves[Math.floor(Math.random() * allowedMoves.length)];
}