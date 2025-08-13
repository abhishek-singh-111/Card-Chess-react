// src/OnlineGame.jsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { io } from 'socket.io-client';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:4000';

function CardSVG({ cardId, large = false }) {
  if (!cardId) return null;
  const isPawn = cardId.startsWith('pawn-');
  const label = isPawn ? `Pawn ${cardId.split('-')[1].toUpperCase()}` : cardId[0].toUpperCase() + cardId.slice(1);
  const symbol =
    isPawn ? '♟' :
    cardId === 'knight' ? '♞' :
    cardId === 'bishop' ? '♝' :
    cardId === 'rook'   ? '♜' :
    cardId === 'queen'  ? '♛' : '♚';
  const width = large ? 160 : 90, height = large ? 240 : 140, bg = isPawn ? '#fde68a' : '#bfdbfe';
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ borderRadius: 12 }}>
      <rect x={0} y={0} width={width} height={height} rx={12} fill={bg} />
      <text x={width / 2} y={height * 0.36} textAnchor='middle' fontSize={large ? 56 : 34}>{symbol}</text>
      <text x={width / 2} y={height * 0.72} textAnchor='middle' fontSize={large ? 18 : 11} style={{ fontWeight: 600 }}>{label}</text>
    </svg>
  );
}

export default function OnlineGame({ onExit }) {
  const socketRef = useRef(null);

  // core state
  const [statusText, setStatusText] = useState('Connecting...');
  const [roomId, setRoomId] = useState(null);
  const [color, setColor] = useState(null); // 'w' | 'b'
  const [game, setGame] = useState(() => new Chess());
  const [gameFen, setGameFen] = useState(new Chess().fen());

  // Optional: still display available cards if server sends them (debug/UX)
  const [availableCards, setAvailableCards] = useState([]);

  const [drawnCard, setDrawnCard] = useState(null);
  const [highlightSquares, setHighlightSquares] = useState({});
  const [selectedFrom, setSelectedFrom] = useState(null);
  const [gameOver, setGameOver] = useState(false);

  const isMyTurn = useMemo(() => {
    if (!game || !color) return false;
    return game.turn() === color;
  }, [game, color]);

  useEffect(() => {
    const s = io(SERVER_URL);
    socketRef.current = s;

    s.on('connect', () => {
      setStatusText('Connected. Finding match...');
      s.emit('find_game');
    });

    s.on('waiting', () => setStatusText('Waiting for opponent...'));

    s.on('match_found', ({ roomId: rid, color: col, fen }) => {
      setRoomId(rid);
      setColor(col);
      setStatusText('Matched! You are ' + (col === 'w' ? 'White' : 'Black'));
      const g = new Chess(fen);
      setGame(g);
      setGameFen(fen);
      setDrawnCard(null);
      setAvailableCards([]);
      setSelectedFrom(null);
      setHighlightSquares({});
      setGameOver(false);

      // NOTE: server will auto-draw for the player to move and send `card_drawn` to that player.
      // If this client is White, it will receive `card_drawn` right away; if Black, it will wait.
    });

    // (Optional) still supported by server for debug/UX
    s.on('available_cards', (arr) => {
      setAvailableCards(arr);
      // do not clear status here; we’ll update when we get `card_drawn`
    });

    s.on('card_drawn', ({ card }) => {
      setDrawnCard(card);
      setStatusText(
        'Card drawn: ' + (card.startsWith?.('pawn-') ? `Pawn ${card.split('-')[1].toUpperCase()}` : card)
      );
    });

    s.on('game_state', ({ fen, status }) => {
      // authoritative update after a successful move
      const g = new Chess(fen);
      setGame(g);
      setGameFen(fen);

      // Your card was consumed by the server on success; clear locally.
      setDrawnCard(null);

      // clear available until server sends to next player (optional)
      setAvailableCards([]);

      if (status.isCheckmate) {
        setStatusText('Checkmate! Game over.');
        setGameOver(true);
      } else if (status.isDraw) {
        setStatusText('Draw. Game over.');
        setGameOver(true);
      } else if (status.isCheck) {
        setStatusText('Check!');
        setGameOver(false);
      } else {
        // After a move, we await either opponent’s move (if not our turn)
        // or an auto `card_drawn` from server (if it becomes our turn).
        setStatusText(isMyTurn ? 'Waiting for your card...' : "Opponent's turn");
        setGameOver(false);
      }

      setSelectedFrom(null);
      setHighlightSquares({});
    });

    s.on('invalid_move', (reason) => {
      let msg = '';
      if (reason === 'card_restriction') msg = 'Move not allowed by drawn card — try again.';
      else if (reason === 'illegal') msg = 'Illegal move — try again.';
      else if (reason === 'not-your-turn') msg = "It's not your turn.";
      else if (reason === 'no-piece') msg = 'No piece at source square.';
      else msg = 'Invalid move: ' + reason;
      setStatusText(msg);

      setSelectedFrom(null);
      setHighlightSquares({});
      // do NOT clear drawnCard; user must retry
    });

    s.on('opponent_left', () => {
      setStatusText('Opponent left. Returning to menu.');
      setTimeout(() => onExit(), 900);
    });

    s.on('disconnect', () => setStatusText('Disconnected from server.'));

    return () => { s.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function isMoveAllowedByDrawnCard(srcSquare, pieceType) {
    if (!drawnCard) return false; // must have received auto card from server
    if (drawnCard.startsWith('pawn-')) {
      if (pieceType !== 'p') return false;
      const srcFile = srcSquare[0];
      return srcFile === drawnCard.split('-')[1];
    } else {
      const map = { knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
      return map[drawnCard] === pieceType;
    }
  }

  function performMoveIfValid(sourceSquare, targetSquare) {
    if (gameOver) return false;
    const srcPiece = game.get(sourceSquare);
    if (!srcPiece) { setStatusText('No piece at selected square.'); return false; }
    if (!isMoveAllowedByDrawnCard(sourceSquare, srcPiece.type)) {
      setStatusText(drawnCard ? 'This piece is not allowed by the card.' : 'Waiting for your card...');
      return false;
    }
    const moves = game.moves({ square: sourceSquare, verbose: true }) || [];
    const chosen = moves.find((m) => m.to === targetSquare);
    if (!chosen) { setStatusText('Not a legal destination for this piece.'); return false; }

    socketRef.current.emit('make_move', { roomId, from: sourceSquare, to: targetSquare });
    setStatusText('Waiting for server...');
    setSelectedFrom(null);
    setHighlightSquares({});
    return true;
  }

  function onPieceDrop(sourceSquare, targetSquare) {
    if (!roomId || !socketRef.current) return false;

    if (!isMyTurn) { setStatusText("It's not your turn."); return false; }
    if (!drawnCard) { setStatusText('Waiting for your card...'); return false; }

    socketRef.current.emit('make_move', { roomId, from: sourceSquare, to: targetSquare });
    return true;
  }

  function onSquareClick(square) {
    if (gameOver) return;
    const piece = game.get(square);
    const turn = game.turn();

    if (!drawnCard) { setStatusText('Waiting for your card...'); return; }

    if (!selectedFrom) {
      if (piece && piece.color === turn && isMoveAllowedByDrawnCard(square, piece.type)) {
        setSelectedFrom(square);
        setHighlightSquares(getLegalMoveSquares(square));
        setStatusText('');
      } else {
        if (piece && piece.color === turn) setStatusText('Selected piece not allowed by card.');
      }
      return;
    }

    if (performMoveIfValid(selectedFrom, square)) {
      // sent; wait for server
    } else {
      if (piece && piece.color === turn && isMoveAllowedByDrawnCard(square, piece.type)) {
        setSelectedFrom(square);
        setHighlightSquares(getLegalMoveSquares(square));
      } else {
        setSelectedFrom(null);
        setHighlightSquares({});
      }
    }
  }

  function onSquareRightClick() {
    setSelectedFrom(null);
    setHighlightSquares({});
  }

  function getCardPrettyName(cardId) {
    if (!cardId) return '—';
    if (cardId.startsWith('pawn-')) return `Pawn ${cardId.split('-')[1].toUpperCase()}`;
    return cardId[0].toUpperCase() + cardId.slice(1);
  }

  // keep local drawnCard consistent if game changes (e.g., opponent moved)
  useEffect(() => {
    // If opponent moved and server consumed our previous card,
    // we’ll either receive a new `card_drawn` (if it's our turn)
    // or just sit without one (if it's not our turn).
    // Nothing to recompute here.
  }, [game]);

  return (
    <div style={{ display: 'flex', gap: 20, padding: 20 }}>
      <div>
        <h2>Online Match</h2>
        <div style={{ marginBottom: 6 }}>
          {statusText || (isMyTurn ? "Your turn" : "Opponent's turn")}
        </div>

        <Chessboard
          position={gameFen}
          boardOrientation={color === 'w' ? 'white' : 'black'}
          boardWidth={560}
          onPieceDrop={(src, dst) => onPieceDrop(src, dst)}
          onSquareClick={onSquareClick}
          onSquareRightClick={onSquareRightClick}
          customSquareStyles={highlightSquares}
        />
      </div>

      <div style={{ width: 320 }}>
        <h3>Card Deck</h3>

        {/* Button removed — auto-draw handled by server */}

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, color: "#333", marginBottom: 6 }}>Drawn Card</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 170, height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {drawnCard ? <CardSVG cardId={drawnCard} large={true} /> : <div style={{ color: "#777" }}>Waiting for your card…</div>}
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>{drawnCard ? getCardPrettyName(drawnCard) : '—'}</div>
              <div style={{ marginTop: 6, color: "#555", fontSize: 13 }}>
                {drawnCard ? "You must move this piece type this turn." : "The system will draw automatically when it's your turn."}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <button onClick={onExit}>Back</button>
        </div>

        {/* Optional debug info */}
        <div style={{ marginTop: 12, color: '#666', fontSize: 13 }}>
          <div><strong>Your color:</strong> {color === 'w' ? 'White' : color === 'b' ? 'Black' : '—'}</div>
          {availableCards?.length ? (
            <div><strong>Available cards (server):</strong> {availableCards.join(', ')}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
