const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const rooms = new Map();

function generateRoomId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 6; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
}

class Room {
  constructor(roomId, hostId, maxRounds = 10) {
    this.roomId = roomId;
    this.hostId = hostId;
    this.players = [];
    this.gameActive = false;
    this.currentRound = 1;
    this.maxRounds = maxRounds;
    this.policeId = null;
    this.thiefId = null;
    this.roundActive = false;
    this.policeGuess = null;
    this.roundEndedFlag = false; // BUG FIX #2: deduplication guard
    // BUG FIX #3: track all server-side timeouts for cleanup
    this._timeouts = [];
  }

  _addTimeout(fn, ms) {
    const t = setTimeout(fn, ms);
    this._timeouts.push(t);
    return t;
  }

  // BUG FIX #3: clear all pending timeouts when room is destroyed
  clearAllTimeouts() {
    this._timeouts.forEach(clearTimeout);
    this._timeouts = [];
  }

  addPlayer(id, name) {
    const existingPlayer = this.players.find((p) => p.id === id);
    if (existingPlayer) {
      // BUG FIX #6: do NOT wipe score on reconnect
      existingPlayer.name = name;
      return existingPlayer;
    }
    const player = { id, name, score: 0, currentRole: null };
    this.players.push(player);
    return player;
  }

  removePlayer(id) {
    const removedPlayer = this.players.find((p) => p.id === id);
    this.players = this.players.filter((p) => p.id !== id);

    if (this.players.length === 0) return { isEmpty: true, removedPlayer };

    if (id === this.hostId && this.players.length > 0) {
      this.hostId = this.players[0].id;
    }

    const wasPolice = id === this.policeId;
    const wasThief = id === this.thiefId;

    return { isEmpty: false, wasPolice, wasThief, removedPlayer };
  }

  assignRoles() {
    if (this.players.length < 4) return false;
    this.roundEndedFlag = false; // reset dedup guard each round
    this.policeGuess = null;

    const shuffled = [...this.players].sort(() => Math.random() - 0.5);
    this.policeId = shuffled[0].id;
    this.thiefId = shuffled[1].id;

    const civilianRoles = ["king", "queen", "bishop", "rook", "knight", "pawn"];
    shuffled.forEach((player, idx) => {
      if (idx === 0) player.currentRole = "police";
      else if (idx === 1) player.currentRole = "thief";
      else player.currentRole = civilianRoles[(idx - 2) % civilianRoles.length];
    });
    return true;
  }

  endRound(selectedThiefId) {
    // BUG FIX #2: deduplication — only allow endRound once per round
    if (this.roundEndedFlag) return null;
    this.roundEndedFlag = true;

    const isCorrect = !!selectedThiefId && selectedThiefId === this.thiefId;
    const policeSkipped = !selectedThiefId;

    this.players.forEach((player) => {
      if (isCorrect && player.id === this.policeId) {
        player.score += 50;
      } else if ((policeSkipped || !isCorrect) && player.id === this.thiefId) {
        player.score += 20;
      } else if ((policeSkipped || !isCorrect) && player.id !== this.policeId && player.id !== this.thiefId) {
        const rolePoints = { king: 25, queen: 20, bishop: 15, rook: 10, knight: 8, pawn: 5 };
        player.score += rolePoints[player.currentRole] || 5;
      }
    });

    this.currentRound++;
    this.roundActive = false;
    this.policeGuess = null;
    return { isCorrect, policeSkipped };
  }

  checkWinner() {
    return this.players.find((p) => p.score >= 1000) || null;
  }

  checkMaxRounds() {
    return this.currentRound > this.maxRounds;
  }
}

// BUG FIX #7: clean up ghost rooms
function destroyRoom(roomId) {
  const room = rooms.get(roomId);
  if (room) {
    room.clearAllTimeouts();
    rooms.delete(roomId);
    console.log(`Room ${roomId} destroyed and cleaned up.`);
  }
}

function startNextRound(room) {
  if (!room.gameActive || room.players.length < 4) return;
  room.assignRoles();

  room.players.forEach((p) => {
    io.to(p.id).emit("role_assigned", { role: p.currentRole });
  });

  io.to(room.roomId).emit("next_round_starting", { round: room.currentRound });

  room._addTimeout(() => {
    if (!room.gameActive) return;
    const policePlayer = room.players.find((p) => p.id === room.policeId);
    io.to(room.roomId).emit("police_revealed", {
      policeId: room.policeId,
      policeName: policePlayer?.name,
    });
    room.roundActive = true;
  }, 10000);
}

function handleRoundEnd(room) {
  const result = room.endRound(room.policeGuess);
  if (!result) return; // already ended (dedup guard)

  const roundResults = room.players.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.currentRole,
    score: p.score,
  }));

  io.to(room.roomId).emit("round_ended", {
    result,
    roundResults,
    currentRound: room.currentRound - 1,
  });

  const winner = room.checkWinner();
  const maxRoundsReached = room.checkMaxRounds();

  if (winner || maxRoundsReached) {
    room._addTimeout(() => {
      if (!rooms.has(room.roomId)) return;
      const finalWinner =
        winner || [...room.players].sort((a, b) => b.score - a.score)[0];
      io.to(room.roomId).emit("game_over", {
        winnerId: finalWinner.id,
        winnerName: finalWinner.name,
        winnerScore: finalWinner.score,
        reason: winner ? "score" : "rounds",
        finalScores: room.players.map((p) => ({ name: p.name, score: p.score })),
      });
      room.gameActive = false;
      // BUG FIX #7: ghost room cleanup after game over
      destroyRoom(room.roomId);
    }, 15000);
  } else {
    room._addTimeout(() => {
      if (!rooms.has(room.roomId) || !room.gameActive) return;
      startNextRound(room);
    }, 15000);
  }
}

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  socket.on("create_room", ({ username, maxRounds }, callback) => {
    try {
      let roomId = generateRoomId();
      while (rooms.has(roomId)) roomId = generateRoomId();

      const room = new Room(roomId, socket.id, maxRounds || 10);
      rooms.set(roomId, room);
      room.addPlayer(socket.id, username);
      socket.join(roomId);

      callback({ success: true, roomId, playerId: socket.id, isHost: true, hostId: socket.id });
      console.log(`Room ${roomId} created by ${username}`);
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });

  socket.on("join_game", ({ username, roomId }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) return callback({ success: false, error: "Room not found" });

      room.addPlayer(socket.id, username);
      socket.join(roomId);

      const isHost = socket.id === room.hostId;

      callback({
        success: true,
        playerId: socket.id,
        isHost,
        hostId: room.hostId, // BUG FIX #5: send hostId so client can render badge
        roomId,
        gameActive: room.gameActive,
        maxRounds: room.maxRounds,
        players: room.players,
      });

      io.to(roomId).emit("player_joined", {
        players: room.players,
        hostId: room.hostId,
        message: `${username} joined the room`,
      });

      console.log(`${username} joined room ${roomId}`);
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });

  // BUG FIX #10: chat maps socket.id to player name correctly and broadcasts to room
  socket.on("send_chat", ({ message }) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    io.to(room.roomId).emit("chat_message", {
      username: player.name,
      message: message.slice(0, 200),
      timestamp: Date.now(),
    });
  });

  socket.on("start_game", (callback) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return callback({ success: false, error: "Room not found" });
    if (socket.id !== room.hostId) return callback({ success: false, error: "Only host can start" });
    if (room.players.length < 4) return callback({ success: false, error: "Need 4+ players" });
    if (room.gameActive) return callback({ success: false, error: "Game already active" });

    room.gameActive = true;
    room.currentRound = 1;
    room.assignRoles();

    io.to(room.roomId).emit("game_started", {
      round: room.currentRound,
      maxRounds: room.maxRounds,
    });

    room.players.forEach((p) => {
      io.to(p.id).emit("role_assigned", { role: p.currentRole });
    });

    room._addTimeout(() => {
      if (!room.gameActive) return;
      const policePlayer = room.players.find((p) => p.id === room.policeId);
      io.to(room.roomId).emit("police_revealed", {
        policeId: room.policeId,
        policeName: policePlayer?.name,
      });
      room.roundActive = true;
    }, 10000);

    callback({ success: true });
  });

  socket.on("submit_guess", ({ selectedThiefId }) => {
    const room = findRoomBySocket(socket.id);
    if (!room || !room.gameActive || !room.roundActive) return;
    if (socket.id !== room.policeId) return;
    if (room.roundEndedFlag) return; // BUG FIX #2

    room.policeGuess = selectedThiefId;
    io.to(room.roomId).emit("police_submitted", {
      message: "Police has submitted their guess!",
    });

    // Police can choose to end round early
    handleRoundEnd(room);
  });

  // BUG FIX #2: server-authoritative timeout — client signals, server deduplicates
  socket.on("round_timeout", () => {
    const room = findRoomBySocket(socket.id);
    if (!room || !room.gameActive || !room.roundActive) return;
    if (room.roundEndedFlag) return; // BUG FIX #2: already ended
    handleRoundEnd(room);
  });

  socket.on("leave_game", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    handlePlayerLeave(socket, room, "left the room");
  });

  socket.on("disconnect", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    handlePlayerLeave(socket, room, "disconnected");
  });

  function handlePlayerLeave(sock, room, reason) {
    const result = room.removePlayer(sock.id);
    // BUG FIX #4: properly leave the socket room
    sock.leave(room.roomId);

    const playerName = result.removedPlayer?.name || "A player";

    if (result.isEmpty) {
      // BUG FIX #3 + #7: clear timeouts and delete ghost room
      destroyRoom(room.roomId);
      return;
    }

    io.to(room.roomId).emit("player_left", {
      players: room.players,
      hostId: room.hostId,
      message: `${playerName} ${reason}`,
    });

    // BUG FIX #5: notify new host
    if (result.removedPlayer?.id !== room.hostId) {
      io.to(room.hostId).emit("you_are_host", { isHost: true, hostId: room.hostId });
    }

    if (room.gameActive) {
      if ((result.wasPolice || result.wasThief) && room.roundActive && !room.roundEndedFlag) {
        io.to(room.roomId).emit("round_terminated", {
          message: `Round ended: ${result.wasPolice ? "Police" : "Thief"} disconnected`,
        });
        room.roundActive = false;
        room.roundEndedFlag = true;
      }

      if (room.players.length < 4) {
        io.to(room.roomId).emit("game_ended", { message: "Not enough players. Game ended." });
        room.gameActive = false;
        room.clearAllTimeouts(); // BUG FIX #3
      }
    }

    console.log(`${playerName} ${reason} from ${room.roomId}`);
  }
});

function findRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.id === socketId)) return room;
  }
  return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
