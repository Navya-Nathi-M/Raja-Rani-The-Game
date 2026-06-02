import { Socket } from 'socket.io';
import { Room, Player, GamePhase } from '../types';
import { assignRoles } from '../game/RoleAssigner';

export const rooms = new Map<string, Room>();

export const setupRoomHandlers = (socket: Socket) => {

  socket.on('create-room', (playerName: string) => {
    const roomId = generateRoomId();
    const room: Room = {
      id: roomId,
      players: [],
      maxPlayers: 8,
      gameStarted: false,
      currentRound: 0,
      phase: 'lobby',
    };

    const player: Player = {
      id: socket.id,
      name: playerName,
      socketId: socket.id,
      points: 0,
      ready: false,
    };

    room.players.push(player);
    rooms.set(roomId, room);
    socket.join(roomId);

    socket.emit('room-created', room);
    console.log(`Room ${roomId} created by ${playerName}`);
  });

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
      ready: false,
    };

    room.players.push(player);
    socket.join(roomId);

    socket.emit('room-joined', room);
    socket.to(roomId).emit('player-joined', player);
    console.log(`${playerName} joined room ${roomId}`);
  });

  // Toggle ready status
  socket.on('player-ready', (roomId: string) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;
    player.ready = !player.ready;

    const io = socket.nsp.server;
    io.to(roomId).emit('player-ready-updated', { playerId: player.id, ready: player.ready });
  });

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

    // Check all players are ready
    const allReady = room.players.every(p => p.ready);
    if (!allReady) {
      socket.emit('error', 'All players must be ready before starting');
      return;
    }

    room.players = assignRoles(room.players);
    room.gameStarted = true;
    room.currentRound = 1;
    room.phase = 'role-assignment';

    const io = socket.nsp.server;

    room.players.forEach((player) => {
      io.to(player.socketId).emit('your-role', player.role);
    });

    const sanitisedRoom = {
      ...room,
      players: room.players.map(({ role, ...rest }) => rest),
    };
    io.to(roomId).emit('game-started', sanitisedRoom);
    console.log(`Game started in room ${roomId}`);

    setTimeout(() => {
      room.phase = 'police-reveal';
      const police = room.players.find(p => p.role === 'Police');
      io.to(roomId).emit('phase-changed', {
        phase: 'police-reveal',
        data: {
          policeName: police?.name,
          policeId: police?.id,
        },
      });
    }, 3000);
  });

  // Chat message
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
    socket.to(roomId).emit('chat-message', chatData);
    socket.emit('chat-message', chatData);
  });

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