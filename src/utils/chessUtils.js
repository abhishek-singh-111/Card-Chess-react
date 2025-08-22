/**
 * Build available cards from the current chess position.
 * Each card represents a piece type or pawn-file restriction.
 */
export function buildAvailableCards(game) {
  const moves = game.moves({ verbose: true }) || [];
  const set = new Set();

  moves.forEach((m) => {
    if (m.piece === "p") set.add(`pawn-${m.from[0]}`);
    else if (m.piece === "n") set.add("knight");
    else if (m.piece === "b") set.add("bishop");
    else if (m.piece === "r") set.add("rook");
    else if (m.piece === "q") set.add("queen");
    else if (m.piece === "k") set.add("king");
  });

  return Array.from(set);
}

/**
 * Pick a random element from an array.
 */
export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Get highlight styles for all legal moves from a given square.
 */
export function getLegalMoveSquares(game, square) {
  const moves = game.moves({ square, verbose: true }) || [];
  const styles = {};

  moves.forEach((m) => {
    styles[m.to] = {
      background: m.captured
        ? "radial-gradient(circle, rgba(255,0,0,0.45) 36%, transparent 40%)"
        : "radial-gradient(circle, rgba(0,200,0,0.45) 36%, transparent 40%)",
      borderRadius: "50%",
    };
  });

  styles[square] = { background: "rgba(255,255,0,0.35)" };
  return styles;
}

/**
 * Check if a move is allowed by the drawn cards.
 */
export function isMoveAllowedByAnyCard(square, pieceType, options) {
  if (!options.length) return false;

  if (pieceType === "p") {
    const file = square[0]; // 'a'..'h'
    return options.some((op) => op === "pawn-" + file);
  } else {
    const map = {
      n: "knight",
      b: "bishop",
      r: "rook",
      q: "queen",
      k: "king",
    };
    return options.includes(map[pieceType]);
  }
}

/**
 * Merge highlight squares with last move highlights.
 */
export function getMergedStyles(highlightSquares, lastMoveSquares) {
  const styles = { ...highlightSquares };
  if (lastMoveSquares) {
    const { from, to } = lastMoveSquares;
    styles[from] = { background: "rgba(255, 255, 0, 0.5)" };
    styles[to] = { background: "rgba(255, 255, 0, 0.5)" };
  }
  return styles;
}

