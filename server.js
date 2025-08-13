// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Chess } = require('chess.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 4000;

const waiting = [];
const rooms = new Map();

function buildAvailableCardsFromGame(g) {
  const moves = g.moves({ verbose: true }) || [];
  const cardSet = new Set();
  moves.forEach((m) => {
    const p = m.piece;
    if (p === 'p') {
      cardSet.add(`pawn-${m.from[0]}`);
    } else if (p === 'n') cardSet.add('knight');
    else if (p === 'b') cardSet.add('bishop');
    else if (p === 'r') cardSet.add('rook');
    else if (p === 'q') cardSet.add('queen');
    else if (p === 'k') cardSet.add('king');
  });
  return Array.from(cardSet).sort();
}

io.on('connection', (socket) => {
  console.log('connected', socket.id);

  // MATCHMAKING
  socket.on('find_game', () => {
    if (waiting.length > 0) {
      const other = waiting.shift();
      const roomId = `room-${socket.id.slice(0, 6)}-${other.slice(0, 6)}`;
      const game = new Chess();
      const players = { white: other, black: socket.id };
      rooms.set(roomId, { game, players, drawn: {} });

      socket.join(roomId);
      const otherSock = io.sockets.sockets.get(other);
      if (otherSock) otherSock.join(roomId);

      io.to(other).emit('match_found', { roomId, color: 'w', fen: game.fen() });
      io.to(socket.id).emit('match_found', { roomId, color: 'b', fen: game.fen() });

      const avail = buildAvailableCardsFromGame(game);
      io.to(other).emit('available_cards', avail);
    } else {
      waiting.push(socket.id);
      socket.emit('waiting');
    }
  });

  // FRIEND MODE - CREATE ROOM
  socket.on('create_room', () => {
    const roomId = `friend-${Math.random().toString(36).substr(2, 6)}`;
    const game = new Chess();
    const players = { white: socket.id, black: null };
    rooms.set(roomId, { game, players, drawn: {} });

    socket.join(roomId);
    socket.emit('room_created', { roomId });
  });

  // FRIEND MODE - JOIN ROOM
  socket.on('join_room', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit('error', 'room-not-found');
    if (room.players.black) return socket.emit('error', 'room-full');

    room.players.black = socket.id;
    socket.join(roomId);

    io.to(room.players.white).emit('match_found', { roomId, color: 'w', fen: room.game.fen() });
    io.to(room.players.black).emit('match_found', { roomId, color: 'b', fen: room.game.fen() });

    const avail = buildAvailableCardsFromGame(room.game);
    io.to(room.players.white).emit('available_cards', avail);
  });

  socket.on('draw_card', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const { game } = room;
    const avail = buildAvailableCardsFromGame(game);
    if (!avail.length) {
      socket.emit('no_cards');
      return;
    }
    const choice = avail[Math.floor(Math.random() * avail.length)];
    room.drawn[socket.id] = choice;
    socket.emit('card_drawn', { card: choice });
  });

  socket.on('make_move', ({ roomId, from, to }) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit('error', 'room-not-found');
    const { game, players, drawn } = room;
    const turn = game.turn();
    const playerColor = players.white === socket.id ? 'w' : players.black === socket.id ? 'b' : null;
    if (!playerColor) return socket.emit('error', 'not-in-room');
    if (turn !== playerColor) return socket.emit('invalid_move', 'not-your-turn');

    const drawnCard = drawn[socket.id] || null;
    const piece = game.get(from);
    if (!piece) return socket.emit('invalid_move', 'no-piece');

    function isAllowedByCard(dCard, srcSquare, pType) {
      if (!dCard) return false;
      if (dCard.startsWith('pawn-')) {
        return pType === 'p' && srcSquare[0] === dCard.split('-')[1];
      }
      const map = { knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
      return map[dCard] === pType;
    }

    if (!isAllowedByCard(drawnCard, from, piece.type)) {
      return socket.emit('invalid_move', 'card_restriction');
    }

    const verboseMoves = game.moves({ square: from, verbose: true });
    const chosen = verboseMoves.find(m => m.to === to);
    if (!chosen) return socket.emit('invalid_move', 'illegal');

    game.move({ from, to, promotion: 'q' });
    drawn[socket.id] = null;

    const fen = game.fen();
    const status = {
      isCheck: game.isCheck(),
      isCheckmate: game.isCheckmate(),
      isDraw: game.isDraw()
    };
    io.to(roomId).emit('game_state', { fen, status });

    const nextAvail = buildAvailableCardsFromGame(game);
    const nextSid = game.turn() === 'w' ? players.white : players.black;
    io.to(nextSid).emit('available_cards', nextAvail);
  });

  socket.on('disconnect', () => {
    const idx = waiting.indexOf(socket.id);
    if (idx !== -1) waiting.splice(idx, 1);
    for (const [roomId, room] of rooms.entries()) {
      if (room.players.white === socket.id || room.players.black === socket.id) {
        const other = room.players.white === socket.id ? room.players.black : room.players.white;
        io.to(other).emit('opponent_left');
        rooms.delete(roomId);
      }
    }
  });
});

server.listen(PORT, () => console.log('Server listening on', PORT));
