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
// roomId -> { game: Chess(), players: { white: sid, black: sid|null },
//            drawn: { sid: { options: [], chosen: null } }  }
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

function isRoomCreatorPresent(roomId) {
  const room = rooms.get(roomId);
  if (!room) return false;

  // Check if white player exists and their socket is still connected
  const whiteSocket = io.sockets.sockets.get(room.players.white);
  return !!whiteSocket;
}

// NEW: Smart draw returns 1-3 cards
function smartDrawFor(g) {
  const avail = buildAvailableCardsFromGame(g);
  if (avail.length <= 3) {
    // if fewer than 3 available, just return them
    return avail;
  }
  // Simple heuristic: random sample of 3
  const sample = [];
  while (sample.length < 3) {
    const pick = avail[Math.floor(Math.random() * avail.length)];
    if (!sample.includes(pick)) sample.push(pick);
  }
  return sample;
}

io.on("connection", (socket) => {
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

      // Draw for white
      const whiteSid = players.white;
      const cardChoices = smartDrawFor(game);
      rooms.get(roomId).drawn[whiteSid] = {
        options: cardChoices,
        chosen: null,
      };
      io.to(whiteSid).emit("cards_drawn", { cards: cardChoices });
    } else {
      waiting.push(socket.id);
      socket.emit("waiting");
    }
  });

  socket.on("create_room", () => {
    const roomId = `friend-${Math.random().toString(36).substr(2, 6)}`;
    const game = new Chess();
    const players = { white: socket.id, black: null };
    rooms.set(roomId, { game, players, drawn: {} });

    socket.join(roomId);
    socket.emit("room_created", { roomId });
  });

  socket.on("check_room", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit("error", "room-not-found");
    if (!isRoomCreatorPresent(roomId)) {
      rooms.delete(roomId);
      return socket.emit("error", "room-abandoned");
    }
    if (room.players.black) return socket.emit("error", "room-full");

    socket.emit("room-ok", { roomId });
  });

  socket.on("join_room", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit("error", "room-not-found");
    if (!isRoomCreatorPresent(roomId)) {
      rooms.delete(roomId); // Clean up abandoned room
      return socket.emit("error", "room-abandoned");
    }
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

    // Draw for white
    const whiteSid = room.players.white;
    const cardChoices = smartDrawFor(room.game);
    room.drawn[whiteSid] = { options: cardChoices, chosen: null };
    io.to(whiteSid).emit("cards_drawn", { cards: cardChoices });
  });

  socket.on("cancel_search", () => {
    const idx = waiting.indexOf(socket.id);
    if (idx !== -1) {
      waiting.splice(idx, 1);
    }
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

    const cardEntry = drawn[socket.id];

    if (!cardEntry || !cardEntry.options || cardEntry.options.length === 0) {
      return socket.emit("invalid_move", "no-cards-available");
    }

    const piece = game.get(from);
    if (!piece) return socket.emit("invalid_move", "no-piece");

    let usedCard = null;
    for (const c of cardEntry.options) {
      if (isAllowedByCard(c, from, piece.type)) {
        usedCard = c;
        break;
      }
    }

    if (!usedCard) {
      return socket.emit("invalid_move", "card_restriction");
    }

    function isAllowedByCard(card, srcSquare, pType) {
      if (!card) return false;
      if (card.startsWith("pawn-")) {
        return pType === "p" && srcSquare[0] === card.split("-")[1];
      }
      const map = {
        knight: "n",
        bishop: "b",
        rook: "r",
        queen: "q",
        king: "k",
      };
      return map[card] === pType;
    }

    const verboseMoves = game.moves({ square: from, verbose: true });
    const chosen = verboseMoves.find((m) => m.to === to);
    if (!chosen) return socket.emit("invalid_move", "illegal");

    game.move({ from, to, promotion: "q" });

    // consume only the used card
    room.drawn[socket.id].options = cardEntry.options.filter(
      (c) => c !== usedCard
    );

    const fen = game.fen();
    const status = {
      isCheck: game.isCheck(),
      isCheckmate: game.isCheckmate(),
      isDraw: game.isDraw(),
    };
    io.to(roomId).emit("game_state", { fen, status, lastMove: { from, to } });

    if (status.isCheckmate || status.isDraw) return;

    const nextSid = game.turn() === "w" ? players.white : players.black;
    const nextChoices = smartDrawFor(game);
    room.drawn[nextSid] = { options: nextChoices, chosen: null };
    io.to(nextSid).emit("cards_drawn", { cards: nextChoices });
  });

  socket.on("resign", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    io.to(roomId).emit("gameOver", {
      reason: "resign",
      resignedId: socket.id,
    });
  });

  socket.on("leave_match", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    // Remove this player from the room, but DO NOT delete the entire room if another player remains
    if (room.players.white === socket.id) {
      // Notify any waiting players that the room is abandoned
      rooms.delete(roomId);
      io.to(roomId).emit("error", "room-abandoned");
    } else if (room.players.black === socket.id) {
      room.players.black = null;
      io.to(roomId).emit("opponent_left");
    }
    socket.leave(roomId);
  });

  socket.on("request_initial_cards", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const entry = room.drawn[socket.id];
    if (entry && entry.options) {
      io.to(socket.id).emit("cards_drawn", { cards: entry.options });
    }
  });

  // Handle rematch request from one of the players
  socket.on("rematch_request", ({ roomId }) => {
    const room = rooms.get(roomId);

    if (!room) return;

    // Send prompt to the OTHER player
    const otherId =
      room.players.white === socket.id
        ? room.players.black
        : room.players.white;

    if (otherId) {
      io.to(socket.id).emit("rematch_prompt", { roomId });
      io.to(otherId).emit("rematch_request", { roomId });
    }
  });

  // Handle response to rematch (accept or reject)
  socket.on("rematch_response", ({ roomId, accepted }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const requester =
      socket.id === room.players.white
        ? room.players.black
        : room.players.white;

    if (accepted) {
      // Reset the room's Chess game
      const newGame = new Chess();
      room.game = newGame;
      room.drawn = {};
      // Send back acceptance boolean to both players
      io.to(roomId).emit("rematch_response", { accepted, roomId });
      // Redraw cards for white to start
      const whiteSid = room.players.white;
      const cardChoices = smartDrawFor(newGame);
      room.drawn[whiteSid] = { options: cardChoices, chosen: null };
      io.to(whiteSid).emit("cards_drawn", { cards: cardChoices });
    } else {
      io.to(requester).emit("rematch_declined");
      // Also return both to menu
      io.to(socket.id).emit("return_home");
      rooms.delete(roomId);
    }
  });

  socket.on("end_friend_match", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (!roomId.startsWith("friend-")) return;

    const other =
      room.players.white === socket.id
        ? room.players.black
        : room.players.white;

    if (other) {
      io.to(other).emit("opponent_left");
    }

    io.to(socket.id).emit("return_home"); // immediate back for the one who clicked
    rooms.delete(roomId);
  });

  socket.on("disconnect", () => {
    for (const [roomId, room] of rooms.entries()) {
      let role = null;
      if (room.players.white === socket.id) role = "white";
      if (room.players.black === socket.id) role = "black";
      if (role) {
        // Notify the opponent
        socket.to(roomId).emit("opponent_left");

        // Clean up room completely
        rooms.delete(roomId);
        break;
      }
    }
  });
});

server.listen(PORT, () => console.log("Server listening on", PORT));
