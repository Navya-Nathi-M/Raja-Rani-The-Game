import { Socket } from 'socket.io';
import { Room, Player } from '../types';

// In-memory storage (no database yet)
export const rooms = new Map<string, Room>();

export const setupRoomHandlers = (socket: Socket) => {

  // Create a new room and join it
  socket.on('create-room', (playerName: string) => {
    const roomId = generateRoomId();   // random 6-char code
    const room: Room = {
      id: roomId,
      players: [],
      maxPlayers: 8,
      gameStarted: false,
      currentRound: 0,
    };

    const player: Player = {
      id: socket.id,
      name: playerName,
      socketId: socket.id,
      points: 0,
    };

    room.players.push(player);
    rooms.set(roomId, room);
    socket.join(roomId);

    // Send the room state to the new host
    socket.emit('room-created', room);
    console.log(`Room ${roomId} created by ${playerName}`);
  });

  // Join an existing room
  socket.on('join-room', (roomId: string, playerName: string) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
    if (room.gameStarted) {
      socket.emit('error', 'Game already started');
      return;
    }
    if (room.players.length >= room.maxPlayers) {
      socket.emit('error', 'Room is full (max 8 players)');
      return;
    }

    const player: Player = {
      id: socket.id,
      name: playerName,
      socketId: socket.id,
      points: 0,
    };

    room.players.push(player);
    socket.join(roomId);

    // Notify everyone in the room (including the new player)
    socket.emit('room-joined', room);            // to the new player
    socket.to(roomId).emit('player-joined', player); // to existing players
    console.log(`${playerName} joined room ${roomId}`);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    // Find and remove player from any room they were in
    rooms.forEach((room, roomId) => {
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        room.players.splice(playerIndex, 1);

        socket.to(roomId).emit('player-left', player);

        // If room is empty, delete it
        if (room.players.length === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        } else {
          // Optionally, update host if the host left (we'll handle later)
          console.log(`${player.name} left room ${roomId}`);
        }
      }
    });
  });
    // Host starts the game
  socket.on('start-game', (roomId: string) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
    // Only the first player (host) can start
    if (room.players[0]?.socketId !== socket.id) {
      socket.emit('error', 'Only the host can start the game');
      return;
    }
    if (room.players.length < 2) {
      socket.emit('error', 'Need at least 2 players to start');
      return;
    }
    if (room.gameStarted) {
      socket.emit('error', 'Game already started');
      return;
    }

    room.gameStarted = true;
    room.currentRound = 1;

    // For now, just broadcast that the game has started
    // Later we'll assign roles here
    socket.emit('game-started', room);
    socket.to(roomId).emit('game-started', room);
    console.log(`Game started in room ${roomId}`);
  });
    // Chat message in room
  socket.on('chat-message', (roomId: string, message: string) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const sender = room.players.find(p => p.socketId === socket.id);
    if (!sender) return;
    const chatData = {
      senderId: socket.id,
      senderName: sender.name,
      message,
      timestamp: Date.now(),
    };
    socket.to(roomId).emit('chat-message', chatData);     // to others
    socket.emit('chat-message', chatData);                // back to sender
  });
};

// Simple random room ID generator (6 alphanumeric chars)
function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
