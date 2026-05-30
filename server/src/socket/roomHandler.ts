import { Socket } from 'socket.io';
import { Room, Player } from '../types';
import { assignRoles } from '../game/RoleAssigner';

// In-memory storage (no database yet)
export const rooms = new Map<string, Room>();

export const setupRoomHandlers = (socket: Socket) => {

  // Create a new room and join it
  socket.on('create-room', (playerName: string) => {
    const roomId = generateRoomId();
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

    socket.emit('room-joined', room);
    socket.to(roomId).emit('player-joined', player);
    console.log(`${playerName} joined room ${roomId}`);
  });

  // Host starts the game
  socket.on('start-game', (roomId: string) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
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

    // Assign roles
    room.players = assignRoles(room.players);
    room.gameStarted = true;
    room.currentRound = 1;

    // io instance from socket
    const io = socket.nsp.server;

    // Send private role to each player
    room.players.forEach((player) => {
      io.to(player.socketId).emit('your-role', player.role);
    });

    // Broadcast game-start with roles hidden
    const sanitisedRoom = {
      ...room,
      players: room.players.map(({ role, ...rest }) => rest),
    };

    io.to(roomId).emit('game-started', sanitisedRoom);
    console.log(`Game started in room ${roomId}`);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        room.players.splice(playerIndex, 1);

        socket.to(roomId).emit('player-left', player);

        if (room.players.length === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        } else {
          console.log(`${player.name} left room ${roomId}`);
        }
      }
    });
  });
};

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}