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
  const symbol = isPawn ? '♟' : cardId === 'knight' ? '♞' : cardId === 'bishop' ? '♝' : cardId === 'rook' ? '♜' : cardId === 'queen' ? '♛' : '♚';
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
  const [availableCards, setAvailableCards] = useState([]);
  const [drawnCard, setDrawnCard] = useState(null);
  const [highlightSquares, setHighlightSquares] = useState({});
  const [selectedFrom, setSelectedFrom] = useState(null);
  const [gameOver, setGameOver] = useState(false);

  // derived: is it my turn?
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
    });

    s.on('available_cards', (arr) => {
      // server gives available cards to the player whose turn it is
      setAvailableCards(arr);
      // clear any status that might have asked to wait
      setStatusText('');
    });

    s.on('card_drawn', ({ card }) => {
      // server told us which card we drew
      setDrawnCard(card);
      setStatusText('Card drawn: ' + (card.startsWith?.('pawn-') ? `Pawn ${card.split('-')[1].toUpperCase()}` : card));
    });

    s.on('game_state', ({ fen, status }) => {
      // authoritative update after a successful move
      const g = new Chess(fen);
      setGame(g);
      setGameFen(fen);

      // server consumed the player's card on success — clear local drawn card
      setDrawnCard(null);

      // clear available cards until server sends them to the next player
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
        setStatusText('');
        setGameOver(false);
      }

      // clear selection & highlights (new board)
      setSelectedFrom(null);
      setHighlightSquares({});
    });

    s.on('invalid_move', (reason) => {
      // SERVER REJECTED THE MOVE: do NOT clear drawnCard or availableCards.
      // Keep the card so player can try again (this is the fix you requested).
      // Update UI with a non-blocking message.
      let msg = '';
      if (reason === 'card_restriction') msg = 'Move not allowed by drawn card — try again.';
      else if (reason === 'illegal') msg = 'Illegal move — try again.';
      else if (reason === 'not-your-turn') msg = "It's not your turn.";
      else if (reason === 'no-piece') msg = 'No piece at source square.';
      else msg = 'Invalid move: ' + reason;
      setStatusText(msg);

      // allow user to re-select / try again
      setSelectedFrom(null);
      setHighlightSquares({});
      // IMPORTANT: do not change drawnCard or availableCards here
    });

    s.on('opponent_left', () => {
      setStatusText('Opponent left. Returning to menu.');
      // wait a tiny bit so player sees message, then call onExit
      setTimeout(() => onExit(), 900);
    });

    s.on('disconnect', () => {
      setStatusText('Disconnected from server.');
    });

    return () => {
      s.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // helper: compute legal move squares for a given square (based on local `game`)
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

  // helper: check piece allowed by drawn card
  function isMoveAllowedByDrawnCard(srcSquare, pieceType) {
    if (!drawnCard) return false;
    if (drawnCard.startsWith('pawn-')) {
      if (pieceType !== 'p') return false;
      const srcFile = srcSquare[0];
      return srcFile === drawnCard.split('-')[1];
    } else {
      const map = { knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
      return map[drawnCard] === pieceType;
    }
  }

  // performMove: send move to server for validation; do not clear drawnCard here
  function performMoveIfValid(sourceSquare, targetSquare) {
    if (gameOver) return false;
    const srcPiece = game.get(sourceSquare);
    if (!srcPiece) {
      setStatusText('No piece at selected square.');
      return false;
    }
    if (!isMoveAllowedByDrawnCard(sourceSquare, srcPiece.type)) {
      setStatusText('This piece is not allowed by the drawn card.');
      return false;
    }
    const moves = game.moves({ square: sourceSquare, verbose: true }) || [];
    const chosen = moves.find((m) => m.to === targetSquare);
    if (!chosen) {
      setStatusText('Not a legal destination for this piece.');
      return false;
    }

    // send to server — server will reply with game_state (accepted) or invalid_move (rejected)
    socketRef.current.emit('make_move', { roomId, from: sourceSquare, to: targetSquare });

    // show waiting state and keep drawnCard until server accepts
    setStatusText('Waiting for server...');
    // optionally hide highlights while waiting; we'll clear them on server game_state or invalid_move
    setSelectedFrom(null);
    setHighlightSquares({});
    return true;
  }

  // drag / drop handler (keeps UX like LocalGame but server-validated)
  function onPieceDrop(sourceSquare, targetSquare) {
    if (!roomId || !socketRef.current) return false;

    if (!isMyTurn) {
      // non-blocking message instead of alert
      setStatusText("It's not your turn.");
      return false;
    }

    if (!drawnCard) {
      setStatusText('You must draw a card before moving.');
      return false;
    }

    // send move to server (server will validate)
    socketRef.current.emit('make_move', { roomId, from: sourceSquare, to: targetSquare });

    // optimistic UI: allow the Chessboard to show it — server will correct if invalid
    return true;
  }

  // click-to-select handler (matches LocalGame behaviour)
  function onSquareClick(square) {
    if (gameOver) return;
    const piece = game.get(square);
    const turn = game.turn();

    if (!drawnCard) {
      // must draw a card first; show non-blocking message
      setStatusText('Draw a card first.');
      return;
    }

    if (!selectedFrom) {
      // selecting origin square
      if (piece && piece.color === turn && isMoveAllowedByDrawnCard(square, piece.type)) {
        setSelectedFrom(square);
        setHighlightSquares(getLegalMoveSquares(square));
        setStatusText(''); // clear any previous message
      } else {
        // either empty, opponent piece, or piece not allowed by card
        if (piece && piece.color === turn) setStatusText('Selected piece not allowed by card.');
      }
      return;
    }

    // if selectedFrom exists, try to perform move
    if (performMoveIfValid(selectedFrom, square)) {
      // move was sent; wait for server
    } else {
      // either try selecting another piece or clear
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

  function drawCard() {
    if (!roomId || !socketRef.current) return;
    socketRef.current.emit('draw_card', { roomId });
  }

  function getCardPrettyName(cardId) {
    if (!cardId) return '—';
    if (cardId.startsWith('pawn-')) return `Pawn ${cardId.split('-')[1].toUpperCase()}`;
    return cardId[0].toUpperCase() + cardId.slice(1);
  }

  // keep local available cards in sync with server when game changes
  useEffect(() => {
    // if current drawnCard is no longer valid with new game, clear it
    const arr = (() => {
      // recompute available cards locally (same logic as server)
      const moves = game.moves({ verbose: true }) || [];
      const cardSet = new Set();
      moves.forEach((m) => {
        const p = m.piece;
        if (p === 'p') cardSet.add(`pawn-${m.from[0]}`);
        else if (p === 'n') cardSet.add('knight');
        else if (p === 'b') cardSet.add('bishop');
        else if (p === 'r') cardSet.add('rook');
        else if (p === 'q') cardSet.add('queen');
        else if (p === 'k') cardSet.add('king');
      });
      return Array.from(cardSet).sort();
    })();

    // if drawnCard is now invalid (for example opponent made a move and server consumed it), clear it
    if (drawnCard && !arr.includes(drawnCard)) {
      setDrawnCard(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  return (
    <div style={{ display: 'flex', gap: 20, padding: 20 }}>
      <div>
        <h2>Online Match</h2>
        <div style={{ marginBottom: 6 }}>{statusText || (isMyTurn ? "Your turn" : "Opponent's turn")}</div>

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

        <div style={{ marginBottom: 12 }}>
          <button
            onClick={drawCard}
            disabled={
              !availableCards.length || // server hasn't given you any available cards
              !!drawnCard ||            // you already have a drawn card
              !isMyTurn ||              // not your turn
              gameOver                  // game finished
            }
            style={{ padding: '8px 12px', fontWeight: 600 }}
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
              <div style={{ fontWeight: 700 }}>{drawnCard ? getCardPrettyName(drawnCard) : '—'}</div>
              <div style={{ marginTop: 6, color: "#555", fontSize: 13 }}>
                {drawnCard ? "You must move this piece type this turn." : "Press Shuffle & Draw to get a card when it's your turn."}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <button onClick={onExit}>Back</button>
        </div>

        <div style={{ marginTop: 12, color: '#666', fontSize: 13 }}>
          <div><strong>Your color:</strong> {color === 'w' ? 'White' : color === 'b' ? 'Black' : '—'}</div>
          <div><strong>Available cards:</strong> {availableCards.length ? availableCards.join(', ') : '—'}</div>
        </div>
      </div>
    </div>
  );
}
