// src/LocalGame.jsx
import React, { useEffect, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

// CardSVG (same as before)
function CardSVG({ cardId, large = false }) {
  const isPawn = cardId?.startsWith("pawn-");
  const label = cardId ? (isPawn ? `Pawn ${cardId.split("-")[1].toUpperCase()}` : cardId[0].toUpperCase() + cardId.slice(1)) : "";
  const symbol = isPawn ? "♟" : cardId === "knight" ? "♞" : cardId === "bishop" ? "♝" : cardId === "rook" ? "♜" : cardId === "queen" ? "♛" : cardId === "king" ? "♚" : "?";
  const width = large ? 160 : 90;
  const height = large ? 240 : 140;
  const bg = isPawn ? "#fde68a" : "#bfdbfe";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ borderRadius: 12 }}>
      <rect x="0" y="0" rx="12" ry="12" width={width} height={height} fill={bg} />
      <text x={width/2} y={height*0.36} textAnchor="middle" fontSize={large?56:34}>{symbol}</text>
      <text x={width/2} y={height*0.72} textAnchor="middle" fontSize={large?18:11} style={{fontWeight:600}}>{label}</text>
    </svg>
  );
}

export default function LocalGame({ onExit }) {
  const [game, setGame] = useState(() => new Chess());
  const [selectedFrom, setSelectedFrom] = useState(null);
  const [highlightSquares, setHighlightSquares] = useState({});
  const [gameOver, setGameOver] = useState(false);
  const [status, setStatus] = useState("");

  // card-related
  const [availableCards, setAvailableCards] = useState([]);
  const [drawnCard, setDrawnCard] = useState(null);
  const [mustMovePiece, setMustMovePiece] = useState(null);

  function safeGameMutate(modify) {
    setGame((current) => {
      const cloned = new Chess(current.fen());
      modify(cloned);
      return cloned;
    });
  }

  function updateGameStatus(g) {
    if (g.isCheckmate()) {
      setStatus(`Checkmate! ${g.turn() === "w" ? "Black" : "White"} wins!`);
      setGameOver(true);
    } else if (g.isDraw()) {
      setStatus("Game over — Draw!");
      setGameOver(true);
    } else if (g.isCheck()) {
      setStatus(`${g.turn() === "w" ? "White" : "Black"} is in check!`);
    } else {
      setStatus("");
    }
  }

  function getLegalMoveSquares(square) {
    const moves = game.moves({ square, verbose: true }) || [];
    if (!moves.length) return {};
    const styles = {};
    moves.forEach((m) => {
      styles[m.to] = game.get(m.to)
        ? { background: "radial-gradient(circle, rgba(255,0,0,0.45) 36%, transparent 40%)", borderRadius: "50%" }
        : { background: "radial-gradient(circle, rgba(0,200,0,0.45) 36%, transparent 40%)", borderRadius: "50%" };
    });
    styles[square] = { background: "rgba(255,255,0,0.35)" };
    return styles;
  }

  function filterAvailableCardsForCurrentPlayer(g = game) {
    const moves = g.moves({ verbose: true }) || [];
    const cardSet = new Set();
    moves.forEach((m) => {
      const piece = m.piece;
      if (piece === "p") {
        const file = m.from[0];
        cardSet.add(`pawn-${file}`);
      } else if (piece === "n") cardSet.add("knight");
      else if (piece === "b") cardSet.add("bishop");
      else if (piece === "r") cardSet.add("rook");
      else if (piece === "q") cardSet.add("queen");
      else if (piece === "k") cardSet.add("king");
    });
    const arr = Array.from(cardSet).sort((a,b) => {
      const pa = a.startsWith("pawn-"), pb = b.startsWith("pawn-");
      if (pa && pb) return a.localeCompare(b);
      if (pa) return -1;
      if (pb) return 1;
      return a.localeCompare(b);
    });
    setAvailableCards(arr);
    return arr;
  }

  function drawRandomCard() {
    if (!availableCards.length || drawnCard) return null;
    const arr = [...availableCards];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const card = arr[Math.floor(Math.random() * arr.length)];
    setDrawnCard(card);
    if (card.startsWith("pawn-")) {
      const file = card.split("-")[1];
      setMustMovePiece({ type: "p", file });
    } else {
      const map = { knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" };
      setMustMovePiece(map[card] || null);
    }
    setSelectedFrom(null);
    setHighlightSquares({});
    return card;
  }

  function isMoveAllowedByDrawnCard(srcSquare, pieceType) {
    if (!drawnCard || !mustMovePiece) return false; // require a card to move locally
    if (typeof mustMovePiece === "object" && mustMovePiece.type === "p") {
      if (pieceType !== "p") return false;
      const srcFile = srcSquare[0];
      return srcFile === mustMovePiece.file;
    } else {
      return pieceType === mustMovePiece;
    }
  }

  function performMoveIfValid(sourceSquare, targetSquare) {
    if (gameOver) return false;
    const srcPiece = game.get(sourceSquare);
    if (!srcPiece) return false;
    if (!isMoveAllowedByDrawnCard(sourceSquare, srcPiece.type)) return false;
    const moves = game.moves({ square: sourceSquare, verbose: true }) || [];
    const chosen = moves.find((m) => m.to === targetSquare);
    if (!chosen) return false;

    safeGameMutate((g) => {
      if (chosen.promotion) g.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      else g.move({ from: sourceSquare, to: targetSquare });
      updateGameStatus(g);
      filterAvailableCardsForCurrentPlayer(g);
    });

    // after successful move, clear drawn card so next player must draw
    setDrawnCard(null);
    setMustMovePiece(null);
    setSelectedFrom(null);
    setHighlightSquares({});
    return true;
  }

  function onPieceDrop(sourceSquare, targetSquare) {
    return performMoveIfValid(sourceSquare, targetSquare);
  }

  function onSquareClick(square) {
    if (gameOver) return;
    const piece = game.get(square);
    const turn = game.turn();
    if (!drawnCard) return;
    if (!selectedFrom) {
      if (piece && piece.color === turn && isMoveAllowedByDrawnCard(square, piece.type)) {
        setSelectedFrom(square);
        setHighlightSquares(getLegalMoveSquares(square));
      }
      return;
    }
    if (performMoveIfValid(selectedFrom, square)) {
      // moved
    } else {
      if (piece && piece.color === turn && isMoveAllowedByDrawnCard(square, piece.type)) {
        setSelectedFrom(square);
        setHighlightSquares(getLegalMoveSquares(square));
        return;
      }
      setSelectedFrom(null);
      setHighlightSquares({});
    }
  }

  function onSquareRightClick() {
    setSelectedFrom(null);
    setHighlightSquares({});
  }

  useEffect(() => {
    const arr = filterAvailableCardsForCurrentPlayer();
    if (drawnCard && !arr.includes(drawnCard)) {
      setDrawnCard(null);
      setMustMovePiece(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  useEffect(() => {
    filterAvailableCardsForCurrentPlayer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getCardPrettyName(cardId) {
    if (!cardId) return "—";
    if (cardId.startsWith("pawn-")) return `Pawn ${cardId.split("-")[1].toUpperCase()}`;
    return cardId[0].toUpperCase() + cardId.slice(1);
  }

  function resetGame() {
    setGame(new Chess());
    setSelectedFrom(null);
    setHighlightSquares({});
    setGameOver(false);
    setStatus("");
    setAvailableCards([]);
    setDrawnCard(null);
    setMustMovePiece(null);
    setTimeout(() => { filterAvailableCardsForCurrentPlayer(new Chess()); }, 20);
  }

  return (
    <div style={{ display: "flex", padding: 20, gap: 20 }}>
      <div>
        <h2>Local Card Chess</h2>
        {status && <div style={{ color: gameOver ? "crimson" : "orange", marginBottom: 8 }}>{status}</div>}
        <Chessboard
          position={game.fen()}
          boardWidth={560}
          onPieceDrop={(src, dst) => onPieceDrop(src, dst)}
          onSquareClick={onSquareClick}
          onSquareRightClick={onSquareRightClick}
          customSquareStyles={highlightSquares}
        />
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={resetGame}>Restart</button>
          <button onClick={onExit}>Back</button>
          <div style={{ marginLeft: 12 }}>
            <strong>Turn:</strong> {game.turn() === "w" ? "White" : "Black"}
          </div>
        </div>
      </div>

      <div style={{ width: 320 }}>
        <h3>Card Deck</h3>
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => drawRandomCard()} disabled={!availableCards.length || !!drawnCard || gameOver} style={{ padding: "8px 12px", fontWeight: 600 }}>
            Shuffle & Draw
          </button>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, color: "#333", marginBottom: 6 }}>Drawn Card</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 170, height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {drawnCard ? <CardSVG cardId={drawnCard} large={true} /> : <div style={{ color: "#777" }}>No card drawn</div>}
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>{getCardPrettyName(drawnCard)}</div>
              <div style={{ marginTop: 6, color: "#555", fontSize: 13 }}>
                {drawnCard ? "You must move this piece type this turn." : "Press Shuffle & Draw to get a card."}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Notes</div>
          <ul style={{ paddingLeft: 18 }}>
            <li>You can click or drag to move (but the drawn card restricts which piece(s) you may move).</li>
            <li>Pawn cards are file-specific (Pawn A moves only pawns from file a).</li>
            <li>After you make a legal move, the drawn card is consumed and opponent must draw.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
