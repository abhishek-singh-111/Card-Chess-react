// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");

const app = express();
const server = http.createServer(app);
//const io = new Server(server, { cors: { origin: "*" } });
// const io = new Server(server, {
//   cors: { origin: "*" },
//   // keep-alive tuned for proxies / platforms (helps avoid mid-game drops)
//   pingInterval: 10000,   // send ping every 10s
//   pingTimeout: 30000,    // consider connection dead after 30s without pong
//   transports: ["websocket"] // prefer websocket (avoid polling fallback)
// });

const allowedOrigins = [
  "https://card-chess.netlify.app",
  "http://localhost:3000"  // keep for local dev
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  pingInterval: 10000,
  pingTimeout: 30000,
  transports: ["websocket"]
});

app.get("/", (req, res) => {
  res.send("CardChess backend is running ✅");
});

const PORT = process.env.PORT || 4000;

const waiting = [];
const rooms = new Map();
const disconnectTimers = new Map();
const DISCONNECT_GRACE_MS = 10000;

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
  const sample = [];
  while (sample.length < 3) {
    const pick = avail[Math.floor(Math.random() * avail.length)];
    if (!sample.includes(pick)) sample.push(pick);
  }
  return sample;
}

io.on("connection", (socket) => {
  socket.on("find_game", ({ mode }) => {
    // default safety
    if (mode !== "timed") mode = "standard";

    // find opponent with same mode
    const idx = waiting.findIndex((w) => w.mode === mode);
    if (idx !== -1) {
      const otherEntry = waiting.splice(idx, 1)[0];
      const other = otherEntry.id;
      const roomId = `room-${socket.id.slice(0, 6)}-${other.slice(0, 6)}`;
      const game = new Chess();
      const players = { white: other, black: socket.id };
      rooms.set(roomId, {
        game,
        players,
        drawn: {},
        state: "active",
        mode,
        timers: { w: 600, b: 600 },
        interval: null,
      });

      socket.join(roomId);
      const otherSock = io.sockets.sockets.get(other);
      if (otherSock) otherSock.join(roomId);

      io.to(other).emit("match_found", {
        roomId,
        color: "w",
        fen: game.fen(),
        mode,
      });
      io.to(socket.id).emit("match_found", {
        roomId,
        color: "b",
        fen: game.fen(),
        mode,
      });

      // Draw cards for white
      const whiteSid = players.white;
      const cardChoices = smartDrawFor(game);
      rooms.get(roomId).drawn[whiteSid] = {
        options: cardChoices,
        chosen: null,
      };
      io.to(whiteSid).emit("cards_drawn", { cards: cardChoices });
    } else {
      waiting.push({ id: socket.id, mode });
      socket.emit("waiting");
    }
  });

  // --- NEW: Start timer interval if timed game ---
  function startTimer(roomId) {
    const room = rooms.get(roomId);
    if (!room || room.mode !== "timed") return;

    // Avoid multiple intervals
    if (room.interval) return;

    room.interval = setInterval(() => {
      if (!room || room.state !== "active") {
        clearInterval(room.interval);
        room.interval = null;
        return;
      }

      const turn = room.game.turn(); // 'w' or 'b'
      room.timers[turn] = Math.max(0, room.timers[turn] - 1);

      // Emit to both players
      io.to(roomId).emit("timer_update", room.timers);

      // Timeout check
      if (room.timers[turn] <= 0) {
        endGame(roomId, "timeout", {
          winner: turn === "w" ? "b" : "w",
          message: `${turn === "w" ? "White" : "Black"} ran out of time!`,
        });
      }
    }, 1000);
  }

  function endGame(roomId, reason, extra = {}) {
    const room = rooms.get(roomId);
    if (!room) return;

    if (room.interval) {
      clearInterval(room.interval);
      room.interval = null;
    }

    room.state = "ended";

    io.to(roomId).emit("gameOver", { reason, ...extra });
  }

  socket.on("create_room", ({ mode }) => {
    if (mode !== "timed") mode = "standard";
    const roomId = `friend-${Math.random().toString(36).substr(2, 6)}`;
    const game = new Chess();
    const players = { white: socket.id, black: null };
    rooms.set(roomId, {
      game,
      players,
      drawn: {},
      state: "active",
      mode,
      timers: { w: 600, b: 600 },
      interval: null,
    });

    socket.join(roomId);
    socket.emit("room_created", { roomId });
  });

  socket.on("check_room", ({ roomId, mode }) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit("error", "room-not-found");
    if (!isRoomCreatorPresent(roomId)) {
      rooms.delete(roomId);
      return socket.emit("error", "room-abandoned");
    }
    if (room.players.black) return socket.emit("error", "room-full");

    // Ensure we keep the mode passed by the client
    if (mode) {
      room.mode = mode;
    }

    socket.emit("room-ok", { roomId, mode: room.mode });
  });

  socket.on("join_room", ({ roomId, mode }) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit("error", "room-not-found");
    if (!isRoomCreatorPresent(roomId)) {
      rooms.delete(roomId);
      return socket.emit("error", "room-abandoned");
    }
    if (room.players.black) return socket.emit("error", "room-full");

    room.players.black = socket.id;
    room.state = "active";
    socket.join(roomId);

    io.to(room.players.white).emit("match_found", {
      roomId,
      color: "w",
      fen: room.game.fen(),
      mode: room.mode, // ðŸ”‘ send mode to client
    });
    io.to(room.players.black).emit("match_found", {
      roomId,
      color: "b",
      fen: room.game.fen(),
      mode: room.mode, // ðŸ”‘ send mode to client
    });

    // draw cards for white
    const whiteSid = room.players.white;
    const cardChoices = smartDrawFor(room.game);
    room.drawn[whiteSid] = { options: cardChoices, chosen: null };
    io.to(whiteSid).emit("cards_drawn", { cards: cardChoices });
  });

  socket.on("cancel_search", () => {
    const idx = waiting.findIndex((w) => w.id === socket.id);
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

    //New
    if (room.mode === "timed") {
      startTimer(roomId);
    }

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

    if (status.isCheckmate) {
      io.to(roomId).emit("gameOver", {
        reason: "checkmate",
        winner: game.turn() === "w" ? "b" : "w", // opposite of the side to move
      });
      room.state = "ended"; // mark room as finished
      return;
    }

    if (status.isDraw) {
      io.to(roomId).emit("gameOver", {
        reason: "draw",
      });
      room.state = "ended"; // mark room as finished
      return;
    }

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
    room.state = "ended"; // keep room, allow winnerâ€™s modal to persist
  });

  // socket.on("leave_match", ({ roomId }) => {
  //   const room = rooms.get(roomId);
  //   if (!room) return;

  //   const isWhite = room.players.white === socket.id;
  //   const isBlack = room.players.black === socket.id;

  //   if (room.state === "active") {
  //     socket.to(roomId).emit("opponent_left");
  //     rooms.delete(roomId);
  //   } else {
  //     // Game already ended â†’ just let this player leave quietly
  //     if (isWhite) room.players.white = null;
  //     if (isBlack) room.players.black = null;

  //     // Delete room if empty
  //     if (!room.players.white && !room.players.black) {
  //       rooms.delete(roomId);
  //     }
  //   }
  //   socket.leave(roomId);
  // });
  socket.on("leave_match", ({ roomId }) => {
  const room = rooms.get(roomId);
  if (!room) return;

  const isWhite = room.players.white === socket.id;
  const isBlack = room.players.black === socket.id;

  // Clear any running timer interval
  if (room.interval) {
    clearInterval(room.interval);
    room.interval = null;
  }

  if (room.state === "active") {
    // Game is active - notify opponent they left
    socket.to(roomId).emit("opponent_left");
    rooms.delete(roomId);
  } else {
    // Game already ended - just let this player leave quietly
    if (isWhite) room.players.white = null;
    if (isBlack) room.players.black = null;

    // Delete room if empty
    if (!room.players.white && !room.players.black) {
      rooms.delete(roomId);
    }
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
  // socket.on("rematch_response", ({ roomId, accepted }) => {
  //   const room = rooms.get(roomId);
  //   if (!room) return;

  //   const requester =
  //     socket.id === room.players.white
  //       ? room.players.black
  //       : room.players.white;

  //   if (accepted) {
  //     // Reset the room's Chess game
  //     const newGame = new Chess();
  //     room.game = newGame;
  //     room.drawn = {};
  //     // Send back acceptance boolean to both players
  //     io.to(roomId).emit("rematch_response", { accepted, roomId });
  //     // Redraw cards for white to start
  //     const whiteSid = room.players.white;
  //     const cardChoices = smartDrawFor(newGame);
  //     room.timers = { w: 600, b: 600 };
  //     if (room.interval) {
  //       clearInterval(room.interval);
  //       room.interval = null;
  //     }
  //     room.drawn[whiteSid] = { options: cardChoices, chosen: null };
  //     io.to(whiteSid).emit("cards_drawn", { cards: cardChoices });
  //   } else {
  //     io.to(requester).emit("rematch_declined");
  //     // Also return both to menu
  //     io.to(socket.id).emit("return_home");
  //     rooms.delete(roomId);
  //   }
  // });
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
    room.state = "active"; // Ensure room state is active again
    
    // Reset and clear timers
    room.timers = { w: 600, b: 600 };
    if (room.interval) {
      clearInterval(room.interval);
      room.interval = null;
    }
    
    // Send back acceptance boolean to both players
    io.to(roomId).emit("rematch_response", { accepted, roomId });
    
    // Emit updated timer values to both players
    io.to(roomId).emit("timer_update", room.timers);
    
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

  socket.on("rejoin_room", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit("error", "room-not-found");

    // If this socket belongs to one of the players, swap in the new socket.id and rejoin.
    let rejoined = false;

    if (room.players.white && !io.sockets.sockets.get(room.players.white)) {
      // white was disconnected â€“ assign this socket as white
      room.players.white = socket.id;
      socket.join(roomId);
      rejoined = true;
    } else if (
      room.players.black &&
      !io.sockets.sockets.get(room.players.black)
    ) {
      // black was disconnected â€“ assign this socket as black
      room.players.black = socket.id;
      socket.join(roomId);
      rejoined = true;
    } else if (
      room.players.white === socket.id ||
      room.players.black === socket.id
    ) {
      // already correct id, just ensure joined
      socket.join(roomId);
      rejoined = true;
    }

    if (!rejoined) {
      // If both players are present, prevent hijacking
      return socket.emit("error", "rejoin-denied");
    }

    // Clear pending disconnect cleanup for this room
    if (disconnectTimers.has(roomId)) {
      clearTimeout(disconnectTimers.get(roomId));
      disconnectTimers.delete(roomId);
    }

    // Send current state back so client can resume immediately
    const { game, drawn } = room;
    const fen = game.fen();
    const status = {
      isCheck: game.isCheck(),
      isCheckmate: game.isCheckmate(),
      isDraw: game.isDraw(),
    };
    // Return any pending cards for this player (if any)
    const entry = drawn[socket.id];
    const cards = entry && entry.options ? entry.options : [];

    socket.emit("rejoined", { fen, status, lastMove: null, cards });
  });

  socket.on("disconnect", () => {
    // Remove from waiting queue if present
    const idx = waiting.findIndex((w) => w.id === socket.id);
    if (idx !== -1) {
      waiting.splice(idx, 1);
    }

    for (const [roomId, room] of rooms.entries()) {
      let role = null;
      if (room.players.white === socket.id) role = "white";
      if (room.players.black === socket.id) role = "black";

      if (!role) continue;

      if (roomId.startsWith("friend-")) {
        // Friend game â†’ notify immediately
        if (room.state === "active") {
          socket.to(roomId).emit("opponent_left");
          rooms.delete(roomId);
        } else {
          if (room.players.white === socket.id) room.players.white = null;
          if (room.players.black === socket.id) room.players.black = null;
          if (!room.players.white && !room.players.black) {
            rooms.delete(roomId);
          }
        }
      } else {
        // Online matchmaking â†’ use grace timer
        if (disconnectTimers.has(roomId))
          clearTimeout(disconnectTimers.get(roomId));
        disconnectTimers.set(
          roomId,
          setTimeout(() => {
            const stillThere = rooms.get(roomId);
            if (!stillThere) return;
            if (stillThere.state === "active") {
              socket.to(roomId).emit("opponent_left");
              rooms.delete(roomId);
            } else {
              if (stillThere.players.white === socket.id)
                stillThere.players.white = null;
              if (stillThere.players.black === socket.id)
                stillThere.players.black = null;
              if (!stillThere.players.white && !stillThere.players.black) {
                rooms.delete(roomId);
              }
            }
            disconnectTimers.delete(roomId);
          }, DISCONNECT_GRACE_MS)
        );
      }
      break;
    }
  });
});

server.listen(PORT, () => console.log("Server listening on", PORT));
