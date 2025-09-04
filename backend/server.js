// server.js - Fixed for Fly.io deployment
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "https://card-chess.netlify.app",
  "http://localhost:3000", // keep for local dev
];

// CRITICAL FIX: Force websocket-only transport for Fly.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingInterval: 25000, // Increased for Fly.io stability
  pingTimeout: 60000, // Increased timeout
  transports: ["websocket"], // FORCE websocket only - no polling fallback
  allowEIO3: true, // Better compatibility
  connectTimeout: 45000, // Connection timeout
  upgrade: true,
  rememberUpgrade: true,
});

app.get("/", (req, res) => {
  res.send("CardChess backend is running ✅");
});

// Health check endpoint for Fly.io
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    activeRooms: rooms.size,
    waitingPlayers: waiting.length,
  });
});

const PORT = process.env.PORT || 4000;

// CRITICAL: Use in-memory storage with proper cleanup
const waiting = [];
const rooms = new Map();
const disconnectTimers = new Map();
const DISCONNECT_GRACE_MS = 15000; // Increased grace period

// Enhanced room cleanup
function cleanupRoom(roomId) {
  const room = rooms.get(roomId);
  if (room) {
    if (room.interval) {
      clearInterval(room.interval);
    }
    rooms.delete(roomId);
  }
  if (disconnectTimers.has(roomId)) {
    clearTimeout(disconnectTimers.get(roomId));
    disconnectTimers.delete(roomId);
  }
}

// Periodic cleanup of abandoned rooms
setInterval(() => {
  for (const [roomId, room] of rooms.entries()) {
    const whiteSocket = room.players.white
      ? io.sockets.sockets.get(room.players.white)
      : null;
    const blackSocket = room.players.black
      ? io.sockets.sockets.get(room.players.black)
      : null;

    // If both players are disconnected, clean up the room
    if (!whiteSocket && !blackSocket) {
      console.log(`Cleaning up abandoned room: ${roomId}`);
      cleanupRoom(roomId);
    }
  }
}, 30000); // Check every 30 seconds

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
  const whiteSocket = io.sockets.sockets.get(room.players.white);
  return !!whiteSocket;
}

function smartDrawFor(g) {
  const avail = buildAvailableCardsFromGame(g);
  if (avail.length <= 3) {
    return avail;
  }
  const sample = [];
  while (sample.length < 3) {
    const pick = avail[Math.floor(Math.random() * avail.length)];
    if (!sample.includes(pick)) sample.push(pick);
  }
  return sample;
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

function startTimer(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.mode !== "timed") return;
  if (room.interval) return; // Already running

  // Add 2-second delay like chess.com, then start both timers
  setTimeout(() => {
    if (!rooms.get(roomId)) return; // Room might be deleted

    room.interval = setInterval(() => {
      if (!room || room.state !== "active") {
        clearInterval(room.interval);
        room.interval = null;
        return;
      }

      const turn = room.game.turn();
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
  }, 2000); // 2 second delay before timers start
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

// Enhanced connection handling for Fly.io
io.engine.on("connection_error", (err) => {
  //console.log("Connection error:", err.req);
  //console.log("Error code:", err.code);
  //console.log("Error message:", err.message);
  //console.log("Error context:", err.context);
});

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Enhanced connection stability
  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
    handleDisconnect(socket);
  });

  socket.on("connect_error", (error) => {
    console.log("Connect error:", error);
  });

  // FIXED: Enhanced find_game with better logging
  socket.on("find_game", ({ mode }) => {
    console.log(
      `Player ${socket.id} looking for ${mode} game. Waiting queue:`,
      waiting.length
    );

    if (mode !== "timed") mode = "standard";

    // Remove player from queue if already waiting (prevent duplicates)
    const existingIdx = waiting.findIndex((w) => w.id === socket.id);
    if (existingIdx !== -1) {
      waiting.splice(existingIdx, 1);
    }

    // Find opponent with same mode
    const idx = waiting.findIndex((w) => w.mode === mode);
    if (idx !== -1) {
      const otherEntry = waiting.splice(idx, 1)[0];
      const other = otherEntry.id;

      // Verify the other socket still exists
      const otherSocket = io.sockets.sockets.get(other);
      if (!otherSocket) {
        console.log(
          `Other player ${other} disconnected, adding current player to queue`
        );
        waiting.push({ id: socket.id, mode });
        socket.emit("waiting");
        return;
      }

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

      console.log(
        `Match found! Room: ${roomId}, White: ${other}, Black: ${socket.id}`
      );

      socket.join(roomId);
      otherSocket.join(roomId);

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

      // Add this:
      if (mode === "timed") {
        startTimer(roomId);
      }

      // Draw cards for white
      const whiteSid = players.white;
      const cardChoices = smartDrawFor(game);
      rooms.get(roomId).drawn[whiteSid] = {
        options: cardChoices,
        chosen: null,
      };
      io.to(whiteSid).emit("cards_drawn", { cards: cardChoices });
    } else {
      console.log(`No opponent found, adding ${socket.id} to waiting queue`);
      waiting.push({ id: socket.id, mode });
      socket.emit("waiting");
    }
  });

  // FIXED: Enhanced room creation with better error handling
  socket.on("create_room", ({ mode }) => {
    if (mode !== "timed") mode = "standard";

    // Generate a more unique room ID
    const roomId = `friend-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .substr(2, 6)}`;
    const game = new Chess();
    const players = { white: socket.id, black: null };

    const room = {
      game,
      players,
      drawn: {},
      state: "waiting", // Start as waiting for second player
      mode,
      timers: { w: 600, b: 600 },
      interval: null,
      created: Date.now(),
    };

    rooms.set(roomId, room);
    socket.join(roomId);

    console.log(`Room created: ${roomId} by ${socket.id}`);
    socket.emit("room_created", { roomId, mode });
  });

  // FIXED: Enhanced room checking
  // Enhanced room checking with better validation
  socket.on("check_room", ({ roomId, mode }) => {
    console.log(`Checking room: ${roomId}`);

    const room = rooms.get(roomId);
    if (!room) {
      console.log(`Room ${roomId} not found`);
      return socket.emit("error", "room-not-found");
    }

    if (!isRoomCreatorPresent(roomId)) {
      console.log(`Room ${roomId} creator not present`);
      cleanupRoom(roomId);
      return socket.emit("error", "room-abandoned");
    }

    if (room.players.black) {
      console.log(`Room ${roomId} is full`);
      return socket.emit("error", "room-full");
    }

    // Ensure we keep the mode passed by the client
    if (mode) {
      room.mode = mode;
    }

    console.log(`Room ${roomId} is valid`);
    socket.emit("room-ok", { roomId, mode: room.mode });
  });

  // FIXED: Enhanced room joining
  socket.on("join_room", ({ roomId, mode }) => {
    console.log(`Player ${socket.id} attempting to join room: ${roomId}`);

    const room = rooms.get(roomId);
    if (!room) {
      console.log(`Room ${roomId} not found for join`);
      return socket.emit("error", "room-not-found");
    }

    if (!isRoomCreatorPresent(roomId)) {
      console.log(`Room ${roomId} creator not present for join`);
      cleanupRoom(roomId);
      return socket.emit("error", "room-abandoned");
    }

    if (room.players.black) {
      console.log(`Room ${roomId} is full for join`);
      return socket.emit("error", "room-full");
    }

    room.players.black = socket.id;
    room.state = "active";
    socket.join(roomId);

    console.log(`Player ${socket.id} joined room ${roomId} as black`);

    io.to(room.players.white).emit("match_found", {
      roomId,
      color: "w",
      fen: room.game.fen(),
      mode: room.mode,
    });
    io.to(room.players.black).emit("match_found", {
      roomId,
      color: "b",
      fen: room.game.fen(),
      mode: room.mode,
    });

    if (room.mode === "timed") {
      startTimer(roomId);
    }

    // Draw cards for white
    const whiteSid = room.players.white;
    const cardChoices = smartDrawFor(room.game);
    room.drawn[whiteSid] = { options: cardChoices, chosen: null };
    io.to(whiteSid).emit("cards_drawn", { cards: cardChoices });
  });

  socket.on("cancel_search", () => {
    const idx = waiting.findIndex((w) => w.id === socket.id);
    if (idx !== -1) {
      waiting.splice(idx, 1);
      console.log(`Removed ${socket.id} from waiting queue`);
    }
  });

  socket.on("make_move", ({ roomId, from, to }) => {
    const room = rooms.get(roomId);
    if (!room) {
      console.log(`Move attempted in non-existent room: ${roomId}`);
      return socket.emit("error", "room-not-found");
    }

    const { game, players, drawn } = room;

    const turn = game.turn();
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

    const verboseMoves = game.moves({ square: from, verbose: true });
    const chosen = verboseMoves.find((m) => m.to === to);
    if (!chosen) return socket.emit("invalid_move", "illegal");

    game.move({ from, to, promotion: "q" });

    // Consume only the used card
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
      endGame(roomId, "checkmate", {
        winner: game.turn() === "w" ? "b" : "w",
        message: `Checkmate! ${game.turn() === "w" ? "Black" : "White"} wins!`,
      });
      return;
    }

    if (status.isDraw) {
      endGame(roomId, "draw", {
        message: "Game ended in a draw.",
      });
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

    endGame(roomId, "resign", {
      resignedId: socket.id,
      message: `${
        socket.id === room.players.white ? "White" : "Black"
      } resigned.`,
    });
  });

  socket.on("leave_match", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const isWhite = room.players.white === socket.id;
    const isBlack = room.players.black === socket.id;

    console.log(`Player ${socket.id} leaving room ${roomId}`);

    // Clear any running timer interval
    if (room.interval) {
      clearInterval(room.interval);
      room.interval = null;
    }

    if (room.state === "active") {
      socket.to(roomId).emit("opponent_left");
      cleanupRoom(roomId);
    } else {
      if (isWhite) room.players.white = null;
      if (isBlack) room.players.black = null;

      if (!room.players.white && !room.players.black) {
        cleanupRoom(roomId);
      }
    }
    socket.leave(roomId);
  });

  socket.on("request_initial_cards", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const entry = room.drawn[socket.id];
    if (entry && entry.options) {
      console.log(`Sending initial cards to ${socket.id} in room ${roomId}`);
      io.to(socket.id).emit("cards_drawn", { cards: entry.options });
    }
  });

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
      room.state = "active";

      // Reset and clear timers
      room.timers = { w: 600, b: 600 };
      if (room.interval) {
        clearInterval(room.interval);
        room.interval = null;
      }

      io.to(roomId).emit("rematch_response", { accepted, roomId });
      io.to(roomId).emit("timer_update", room.timers);

      if (room.mode === "timed") {
        startTimer(roomId);
      }

      // Redraw cards for white to start
      const whiteSid = room.players.white;
      const cardChoices = smartDrawFor(newGame);
      room.drawn[whiteSid] = { options: cardChoices, chosen: null };
      io.to(whiteSid).emit("cards_drawn", { cards: cardChoices });

      console.log(`Rematch started in room ${roomId}`);
    } else {
      io.to(requester).emit("rematch_declined");
      io.to(socket.id).emit("return_home");
      cleanupRoom(roomId);
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

    io.to(socket.id).emit("return_home");
    cleanupRoom(roomId);
  });

  // Enhanced rejoin functionality
  socket.on("rejoin_room", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit("error", "room-not-found");

    let rejoined = false;
    let playerColor = null;

    // Check if this socket belongs to an existing player
    if (room.players.white === socket.id) {
      socket.join(roomId);
      rejoined = true;
      playerColor = "w";
    } else if (room.players.black === socket.id) {
      socket.join(roomId);
      rejoined = true;
      playerColor = "b";
    } else {
      // Try to reassign disconnected players
      if (room.players.white && !io.sockets.sockets.get(room.players.white)) {
        room.players.white = socket.id;
        socket.join(roomId);
        rejoined = true;
        playerColor = "w";
      } else if (
        room.players.black &&
        !io.sockets.sockets.get(room.players.black)
      ) {
        room.players.black = socket.id;
        socket.join(roomId);
        rejoined = true;
        playerColor = "b";
      }
    }

    if (!rejoined) {
      return socket.emit("error", "rejoin-denied");
    }

    // Clear pending disconnect cleanup for this room
    if (disconnectTimers.has(roomId)) {
      clearTimeout(disconnectTimers.get(roomId));
      disconnectTimers.delete(roomId);
    }

    // Send current state back
    const { game, drawn } = room;
    const fen = game.fen();
    const status = {
      isCheck: game.isCheck(),
      isCheckmate: game.isCheckmate(),
      isDraw: game.isDraw(),
    };

    const entry = drawn[socket.id];
    const cards = entry && entry.options ? entry.options : [];

    socket.emit("rejoined", { fen, status, lastMove: null, cards });
    console.log(
      `Player ${socket.id} rejoined room ${roomId} as ${playerColor}`
    );
  });

  // Enhanced disconnect handling
  function handleDisconnect(socket) {
    // Remove from waiting queue if present
    const idx = waiting.findIndex((w) => w.id === socket.id);
    if (idx !== -1) {
      waiting.splice(idx, 1);
      console.log(`Removed ${socket.id} from waiting queue on disconnect`);
    }

    for (const [roomId, room] of rooms.entries()) {
      let role = null;
      if (room.players.white === socket.id) role = "white";
      if (room.players.black === socket.id) role = "black";

      if (!role) continue;

      console.log(
        `Player ${socket.id} (${role}) disconnected from room ${roomId}`
      );

      if (roomId.startsWith("friend-")) {
        // Friend game → notify immediately
        if (room.state === "active") {
          socket.to(roomId).emit("opponent_left");
          cleanupRoom(roomId);
        } else {
          if (room.players.white === socket.id) room.players.white = null;
          if (room.players.black === socket.id) room.players.black = null;
          if (!room.players.white && !room.players.black) {
            cleanupRoom(roomId);
          }
        }
      } else {
        // Online matchmaking → use grace timer
        if (disconnectTimers.has(roomId)) {
          clearTimeout(disconnectTimers.get(roomId));
        }

        disconnectTimers.set(
          roomId,
          setTimeout(() => {
            const stillThere = rooms.get(roomId);
            if (!stillThere) return;

            if (stillThere.state === "active") {
              socket.to(roomId).emit("opponent_left");
              cleanupRoom(roomId);
            } else {
              if (stillThere.players.white === socket.id)
                stillThere.players.white = null;
              if (stillThere.players.black === socket.id)
                stillThere.players.black = null;
              if (!stillThere.players.white && !stillThere.players.black) {
                cleanupRoom(roomId);
              }
            }
            disconnectTimers.delete(roomId);
          }, DISCONNECT_GRACE_MS)
        );
      }
      break;
    }
  }
});

// Graceful shutdown handling
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  //console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
