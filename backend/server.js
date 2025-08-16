// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 4000;

const waiting = [];
// roomId -> { game: Chess(), players: { white: sid, black: sid|null }, drawn: { sid: cardId|null } }
const rooms = new Map();

function buildAvailableCardsFromGame(g) {
  const moves = g.moves({ verbose: true }) || [];
  const cardSet = new Set();
  moves.forEach((m) => {
    const p = m.piece;
    if (p === "p") cardSet.add(`pawn-${m.from[0]}`);
    else if (p === "n") cardSet.add("knight");
    else if (p === "b") cardSet.add("bishop");
    else if (p === "r") cardSet.add("rook");
    else if (p === "q") cardSet.add("queen");
    else if (p === "k") cardSet.add("king");
  });
  return Array.from(cardSet).sort();
}

// NEW: helper to auto-draw for a specific socket id based on current game
function autoDrawFor(g, sid) {
  const avail = buildAvailableCardsFromGame(g);
  if (!avail.length) {
    // No legal moves → stalemate/checkmate is handled after moves;
    // here we just signal no card.
    io.to(sid).emit("no_cards");
    return null;
  }
  const choice = avail[Math.floor(Math.random() * avail.length)];
  return choice;
}

io.on("connection", (socket) => {
  console.log("connected", socket.id);

  // MATCHMAKING
  socket.on("find_game", () => {
    if (waiting.length > 0) {
      const other = waiting.shift();
      const roomId = `room-${socket.id.slice(0, 6)}-${other.slice(0, 6)}`;
      const game = new Chess();
      const players = { white: other, black: socket.id };
      rooms.set(roomId, { game, players, drawn: {} });

      socket.join(roomId);
      const otherSock = io.sockets.sockets.get(other);
      if (otherSock) otherSock.join(roomId);

      io.to(other).emit("match_found", { roomId, color: "w", fen: game.fen() });
      io.to(socket.id).emit("match_found", {
        roomId,
        color: "b",
        fen: game.fen(),
      });

      // CHANGED: auto-draw for White immediately
      const whiteSid = players.white;
      const firstCard = autoDrawFor(game, whiteSid);
      if (firstCard) {
        rooms.get(roomId).drawn[whiteSid] = firstCard;
        io.to(whiteSid).emit("card_drawn", { card: firstCard });
      }
      // Optional: still share available cards for UI/debug if you want
      io.to(whiteSid).emit(
        "available_cards",
        buildAvailableCardsFromGame(game)
      );
    } else {
      waiting.push(socket.id);
      socket.emit("waiting");
    }
  });

  // FRIEND MODE - CREATE ROOM
  socket.on("create_room", () => {
    const roomId = `friend-${Math.random().toString(36).substr(2, 6)}`;
    const game = new Chess();
    const players = { white: socket.id, black: null };
    rooms.set(roomId, { game, players, drawn: {} });

    socket.join(roomId);
    socket.emit("room_created", { roomId });
  });

  // FRIEND MODE - JOIN ROOM
  socket.on("join_room", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit("error", "room-not-found");
    if (room.players.black) return socket.emit("error", "room-full");

    room.players.black = socket.id;
    socket.join(roomId);

    io.to(room.players.white).emit("match_found", {
      roomId,
      color: "w",
      fen: room.game.fen(),
    });
    io.to(room.players.black).emit("match_found", {
      roomId,
      color: "b",
      fen: room.game.fen(),
    });

    // CHANGED: auto-draw for White on friend start too
    const whiteSid = room.players.white;
    const firstCard = autoDrawFor(room.game, whiteSid);
    if (firstCard) {
      room.drawn[whiteSid] = firstCard;
      io.to(whiteSid).emit("card_drawn", { card: firstCard });
    }
    io.to(whiteSid).emit(
      "available_cards",
      buildAvailableCardsFromGame(room.game)
    );
  });

  // (Optional) You can keep this for backward-compat or remove it:
  socket.on("draw_card", ({ roomId }) => {
    // No-op in auto-draw mode, or keep legacy behavior:
    const room = rooms.get(roomId);
    if (!room) return;
    const { game } = room;
    const choice = autoDrawFor(game, socket.id);
    if (!choice) return;
    room.drawn[socket.id] = choice;
    socket.emit("card_drawn", { card: choice });
  });

  socket.on("make_move", ({ roomId, from, to }) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit("error", "room-not-found");
    const { game, players, drawn } = room;

    const turn = game.turn(); // 'w' or 'b'
    const playerColor =
      players.white === socket.id
        ? "w"
        : players.black === socket.id
        ? "b"
        : null;

    if (!playerColor) return socket.emit("error", "not-in-room");
    if (turn !== playerColor)
      return socket.emit("invalid_move", "not-your-turn");

    const drawnCard = drawn[socket.id] || null;
    const piece = game.get(from);
    if (!piece) return socket.emit("invalid_move", "no-piece");

    function isAllowedByCard(dCard, srcSquare, pType) {
      if (!dCard) return false; // must have a drawn card
      if (dCard.startsWith("pawn-")) {
        return pType === "p" && srcSquare[0] === dCard.split("-")[1];
      }
      const map = {
        knight: "n",
        bishop: "b",
        rook: "r",
        queen: "q",
        king: "k",
      };
      return map[dCard] === pType;
    }

    if (!isAllowedByCard(drawnCard, from, piece.type)) {
      return socket.emit("invalid_move", "card_restriction");
    }

    const verboseMoves = game.moves({ square: from, verbose: true });
    const chosen = verboseMoves.find((m) => m.to === to);
    if (!chosen) return socket.emit("invalid_move", "illegal");

    game.move({ from, to, promotion: "q" });

    // consume mover's card
    drawn[socket.id] = null;

    // broadcast new state
    const fen = game.fen();
    const status = {
      isCheck: game.isCheck(),
      isCheckmate: game.isCheckmate(),
      isDraw: game.isDraw(),
    };
    io.to(roomId).emit("game_state", { fen, status, lastMove: { from, to } });

    // If game over, don't draw for next player
    if (status.isCheckmate || status.isDraw) return;

    // CHANGED: auto-draw for the next player immediately
    const nextSid = game.turn() === "w" ? players.white : players.black;
    const nextCard = autoDrawFor(game, nextSid);
    if (nextCard) {
      drawn[nextSid] = nextCard;
      io.to(nextSid).emit("card_drawn", { card: nextCard });
    }
    // Optional debug info
    io.to(nextSid).emit("available_cards", buildAvailableCardsFromGame(game));
  });

  socket.on("resign", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    io.to(roomId).emit("gameOver", {
      reason: "resign",
      resignedId: socket.id,
    });

    rooms.delete(roomId);
  });

  socket.on("disconnect", () => {
    const idx = waiting.indexOf(socket.id);
    if (idx !== -1) waiting.splice(idx, 1);
    for (const [roomId, room] of rooms.entries()) {
      if (
        room.players.white === socket.id ||
        room.players.black === socket.id
      ) {
        const other =
          room.players.white === socket.id
            ? room.players.black
            : room.players.white;
        if (other) io.to(other).emit("opponent_left");
        rooms.delete(roomId);
      }
    }
  });
});

server.listen(PORT, () => console.log("Server listening on", PORT));
