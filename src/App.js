// src/App.js
import React, { useEffect, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

/*
  Card-Chess App.js
  - Inline SVG cards (no external assets)
  - 13 cards: pawn-a .. pawn-h, knight, bishop, rook, queen, king
  - Draw card restricts allowed piece(s) for the current turn
*/

const ALL_PAWN_FILES = ["a","b","c","d","e","f","g","h"];
const STATIC_PIECE_CARDS = ["knight","bishop","rook","queen","king"];

function CardSVG({ cardId, large = false }) {
  // cardId like 'pawn-a' or 'knight'
  const isPawn = cardId.startsWith("pawn-");
  const label = isPawn ? `Pawn ${cardId.split("-")[1].toUpperCase()}` : cardId[0].toUpperCase() + cardId.slice(1);
  const symbol = (() => {
    if (isPawn) return "♟";
    if (cardId === "knight") return "♞";
    if (cardId === "bishop") return "♝";
    if (cardId === "rook") return "♜";
    if (cardId === "queen") return "♛";
    if (cardId === "king") return "♚";
    return "?";
  })();

  const width = large ? 160 : 90;
  const height = large ? 240 : 140;
  const radius = 12;
  const bg = isPawn ? "#fde68a" : "#bfdbfe"; // pawn is warm, others cool

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ borderRadius: 12 }}>
      <defs>
        <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity="0.12"/>
        </filter>
      </defs>
      <rect x="0" y="0" rx={radius} ry={radius} width={width} height={height} fill={bg} filter="url(#soft)"/>
      <text x={width/2} y={height*0.36} textAnchor="middle" fontSize={large ? 56 : 34} style={{ pointerEvents: "none" }}>
        {symbol}
      </text>
      <text x={width/2} y={height*0.72} textAnchor="middle" fontSize={large ? 18 : 11} style={{ fontWeight: 600 }}>
        {label}
      </text>
      <rect x="6" y="6" rx={radius-2} ry={radius-2} width={width-12} height={height-12} fill="none" stroke="rgba(0,0,0,0.06)" />
    </svg>
  );
}

export default function App() {
  const [game, setGame] = useState(() => new Chess());
  const [selectedFrom, setSelectedFrom] = useState(null);
  const [highlightSquares, setHighlightSquares] = useState({});
  const [gameOver, setGameOver] = useState(false);
  const [status, setStatus] = useState("");

  // card-related state
  const [availableCards, setAvailableCards] = useState([]); // list of cardId strings
  const [drawnCard, setDrawnCard] = useState(null); // cardId or null
  const [mustMovePiece, setMustMovePiece] = useState(null); // 'p','n','b','r','q','k' or special pawn file obj {type:'p',file:'a'}

  // safe mutate
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

  // build legal move styles for a from-square
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

  // === Card filtering logic ===
  // Build available cards based on all legal moves for current player
  function filterAvailableCardsForCurrentPlayer(g = game) {
    // g.moves() returns SAN strings unless verbose true
    const moves = g.moves({ verbose: true }) || [];
    const cardSet = new Set();

    moves.forEach((m) => {
      const piece = m.piece; // p,n,b,r,q,k
      if (piece === "p") {
        // m.from like 'e2' -> file letter at index 0
        const file = m.from[0];
        cardSet.add(`pawn-${file}`);
      } else if (piece === "n") cardSet.add("knight");
      else if (piece === "b") cardSet.add("bishop");
      else if (piece === "r") cardSet.add("rook");
      else if (piece === "q") cardSet.add("queen");
      else if (piece === "k") cardSet.add("king");
    });

    // convert to array and sort for consistent UI ordering
    const arr = Array.from(cardSet).sort((a,b) => {
      // pawn-a..pawn-h first in file order, then others
      const pa = a.startsWith("pawn-"), pb = b.startsWith("pawn-");
      if (pa && pb) return a.localeCompare(b);
      if (pa) return -1;
      if (pb) return 1;
      return a.localeCompare(b);
    });
    setAvailableCards(arr);
    return arr;
  }

  // draw a random card from availableCards (shuffled)
  function drawRandomCard() {
    if (!availableCards.length || drawnCard) return null;
    const arr = [...availableCards];
    // simple shuffle
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const card = arr[Math.floor(Math.random() * arr.length)];
    setDrawnCard(card);

    // set mustMovePiece according to card
    if (card.startsWith("pawn-")) {
      const file = card.split("-")[1]; // 'a'..'h'
      setMustMovePiece({ type: "p", file });
    } else {
      const map = { knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" };
      setMustMovePiece(map[card] || null);
    }
    // also highlight only pieces allowed (optional)
    setSelectedFrom(null);
    setHighlightSquares({});
    return card;
  }

  // helper: returns true if the move from 'src' uses the allowed drawnCard
  function isMoveAllowedByDrawnCard(srcSquare, pieceType) {
    if (!drawnCard || !mustMovePiece) return true; // if no card drawn, allow (or you can choose to block)
    if (typeof mustMovePiece === "object" && mustMovePiece.type === "p") {
      // pawn-file card: piece must be pawn and srcSquare file must match
      if (pieceType !== "p") return false;
      const srcFile = srcSquare[0];
      return srcFile === mustMovePiece.file;
    } else {
      return pieceType === mustMovePiece;
    }
  }

  // perform move if legal and allowed
  function performMoveIfValid(sourceSquare, targetSquare) {
    if (gameOver) return false;

    const srcPiece = game.get(sourceSquare);
    if (!srcPiece) return false;

    // ensure drawnCard allows moving this piece
    if (!isMoveAllowedByDrawnCard(sourceSquare, srcPiece.type)) return false;

    const moves = game.moves({ square: sourceSquare, verbose: true }) || [];
    const chosen = moves.find((m) => m.to === targetSquare);
    if (!chosen) return false;

    // ok perform move
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

  // react-chessboard drag handler (must return boolean)
  function onPieceDrop(sourceSquare, targetSquare) {
    return performMoveIfValid(sourceSquare, targetSquare);
  }

  // click-to-move handlers
  function onSquareClick(square) {
    if (gameOver) return;
    const piece = game.get(square);
    const turn = game.turn();

    // must have a card drawn to move (game rule). If you prefer allow move when no card drawn, change this.
    if (!drawnCard) {
      // nothing to do — prompt user to draw
      // optional: flash UI - but simply ignore
      return;
    }

    if (!selectedFrom) {
      if (piece && piece.color === turn && isMoveAllowedByDrawnCard(square, piece.type)) {
        setSelectedFrom(square);
        setHighlightSquares(getLegalMoveSquares(square));
      }
      return;
    }

    // if a source is selected already, try to perform move
    if (performMoveIfValid(selectedFrom, square)) {
      // moved, done
    } else {
      // if clicked another of own allowed pieces -> switch selection
      if (piece && piece.color === turn && isMoveAllowedByDrawnCard(square, piece.type)) {
        setSelectedFrom(square);
        setHighlightSquares(getLegalMoveSquares(square));
        return;
      }
      // else clear
      setSelectedFrom(null);
      setHighlightSquares({});
    }
  }

  function onSquareRightClick() {
    setSelectedFrom(null);
    setHighlightSquares({});
  }

  // update available cards when game changes (new turn)
  useEffect(() => {
    const arr = filterAvailableCardsForCurrentPlayer();
    // if no available cards -> game over or stalemate will be reported by chess.js logic
    // if current drawn card is no longer valid (e.g., move changed board), clear it
    if (drawnCard && !arr.includes(drawnCard)) {
      setDrawnCard(null);
      setMustMovePiece(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  // initial populate
  useEffect(() => {
    filterAvailableCardsForCurrentPlayer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // small helper UI assistants
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
        <h2>Card Chess — board</h2>
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
          <div style={{ marginLeft: 12 }}>
            <strong>Turn:</strong> {game.turn() === "w" ? "White" : "Black"}
          </div>
        </div>
      </div>

      <div style={{ width: 320 }}>
        <h3>Card Deck</h3>

        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => {
              if (!availableCards.length) return;
              drawRandomCard();
            }}
            disabled={!availableCards.length || !!drawnCard || gameOver}
            style={{ padding: "8px 12px", fontWeight: 600 }}
          >
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
              {/* <div style={{ marginTop: 10 }}>
                <button onClick={() => { setDrawnCard(null); setMustMovePiece(null); }} disabled={!drawnCard}>
                  Discard Card
                </button>
              </div> */}
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
