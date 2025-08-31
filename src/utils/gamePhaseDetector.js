// src/utils/gamePhaseDetector.js - Accurate Game Phase Detection


// Enhanced piece values for material calculation
const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0, // King doesn't count for material
};

/**
 * Get total material value on the board (excluding kings)
 */
export function getTotalMaterial(game) {
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

/**
 * Get material balance for a specific color
 */
export function getMaterialBalance(game, color) {
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

/**
 * Count pieces on the board
 */
export function getPieceCount(game) {
  let white = 0, black = 0, total = 0;
  const board = game.board();
  
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece) {
        total++;
        if (piece.color === 'w') white++;
        else black++;
      }
    }
  }
  
  return { white, black, total };
}

/**
 * Check how many major pieces remain for each side
 */
export function getMajorPieceCount(game) {
  let whiteMajor = 0, blackMajor = 0;
  const board = game.board();
  
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece && (piece.type === 'q' || piece.type === 'r')) {
        if (piece.color === 'w') whiteMajor++;
        else blackMajor++;
      }
    }
  }
  
  return { white: whiteMajor, black: blackMajor, total: whiteMajor + blackMajor };
}

/**
 * Determine current game phase with enhanced detection
 */
export function getGamePhase(game) {
  const moveNumber = Math.floor(game.moveNumber() / 2) + 1;
  const totalMaterial = getTotalMaterial(game);
  const pieceCount = getPieceCount(game);
  const majorPieces = getMajorPieceCount(game);
  
  // Opening phase criteria
  if (moveNumber <= 15 && totalMaterial >= 3500) {
    return "opening";
  }
  
  // Endgame criteria (multiple conditions)
  const isEndgame = (
    totalMaterial <= 1500 ||  // Low material
    pieceCount.total <= 8 ||   // Few pieces left
    majorPieces.total <= 2 ||  // Few major pieces
    (moveNumber > 40 && totalMaterial <= 2000) // Late game with reduced material
  );
  
  if (isEndgame) {
    return "endgame";
  }
  
  return "middlegame";
}

/**
 * Check if position is definitively in endgame
 */
export function isEndgame(game) {
  return getGamePhase(game) === "endgame";
}

/**
 * Check if position is in opening
 */
export function isOpening(game) {
  return getGamePhase(game) === "opening";
}

/**
 * Check if position is in middlegame  
 */
export function isMiddlegame(game) {
  return getGamePhase(game) === "middlegame";
}

/**
 * Get endgame type for specialized evaluation
 */
export function getEndgameType(game) {
  const pieces = { w: [], b: [] };
  const board = game.board();
  
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece && piece.type !== 'k') {
        pieces[piece.color].push(piece.type);
      }
    }
  }
  
  // Classify endgame types
  const whitePieces = pieces.w;
  const blackPieces = pieces.b;
  
  // King and pawn endgames
  if (whitePieces.every(p => p === 'p') && blackPieces.every(p => p === 'p')) {
    return "king_pawn";
  }
  
  // Queen endgames
  if (whitePieces.includes('q') || blackPieces.includes('q')) {
    return "queen_endgame";
  }
  
  // Rook endgames
  if (whitePieces.includes('r') || blackPieces.includes('r')) {
    return "rook_endgame";
  }
  
  // Minor piece endgames
  if (whitePieces.some(p => p === 'n' || p === 'b') || 
      blackPieces.some(p => p === 'n' || p === 'b')) {
    return "minor_piece_endgame";
  }
  
  return "basic_endgame";
}

/**
 * Calculate game phase transition score (0-1)
 * 0 = pure opening, 1 = pure endgame
 */
export function getGamePhaseTransition(game) {
  const totalMaterial = getTotalMaterial(game);
  const moveNumber = Math.floor(game.moveNumber() / 2) + 1;
  const pieceCount = getPieceCount(game);
  
  let transition = 0;
  
  // Material-based transition (40% weight)
  const materialTransition = Math.max(0, (4000 - totalMaterial) / 4000);
  transition += materialTransition * 0.4;
  
  // Move-based transition (30% weight)
  const moveTransition = Math.min(1, Math.max(0, (moveNumber - 10) / 30));
  transition += moveTransition * 0.3;
  
  // Piece count transition (30% weight)
  const pieceTransition = Math.max(0, (32 - pieceCount.total) / 24);
  transition += pieceTransition * 0.3;
  
  return Math.min(1, transition);
}