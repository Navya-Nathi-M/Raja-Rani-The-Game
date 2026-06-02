import { Socket } from 'socket.io';
import { rooms } from './roomHandler';
import { calculatePoints } from '../game/ScoreCalculator';
import { assignRoles } from '../game/RoleAssigner';
import { RoundRecord } from '../types';

export const setupGameHandlers = (socket: Socket) => {

  socket.on('accuse', (roomId: string, accusedPlayerId: string) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.phase !== 'police-reveal') return;

    const police = room.players.find(p => p.role === 'Police');
    if (!police || police.socketId !== socket.id) {
      socket.emit('error', 'Only the Police can accuse');
      return;
    }

    const accused = room.players.find(p => p.id === accusedPlayerId);
    if (!accused) {
      socket.emit('error', 'Player not found');
      return;
    }

    const isCorrect = accused.role === 'Thief';
    const bonusPlayerId = isCorrect ? police.id : accused.id;
    room.players = calculatePoints(room.players, bonusPlayerId);

    // Record round result
    const roundRecord: RoundRecord = {
      round: room.currentRound,
      policeName: police.name,
      accusedName: accused.name,
      accusedRole: accused.role!,
      isCorrect,
    };
    room.roundHistory.push(roundRecord);

    room.phase = 'verdict';

    const io = socket.nsp.server;
    io.to(roomId).emit('phase-changed', {
      phase: 'verdict',
      data: {
        accusedName: accused.name,
        accusedRole: accused.role,
        isCorrect,
        policeName: police.name,
      },
      roundHistory: room.roundHistory,
    });
  });

  socket.on('next-round', (roomId: string) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.phase !== 'verdict') return;

    const winner = room.players.find(p => p.points >= 10);
    if (winner) {
      room.phase = 'game-over';
      const io = socket.nsp.server;
      io.to(roomId).emit('phase-changed', {
        phase: 'game-over',
        data: { winner: winner.name, points: winner.points },
        roundHistory: room.roundHistory,
      });
      return;
    }

    room.currentRound++;
    room.phase = 'role-assignment';
    room.players = assignRoles(room.players);

    const io = socket.nsp.server;
    room.players.forEach((player) => {
      io.to(player.socketId).emit('your-role', player.role);
    });

    const sanitisedRoom = {
      ...room,
      players: room.players.map(({ role, ...rest }) => rest),
    };
    io.to(roomId).emit('game-started', sanitisedRoom);

    setTimeout(() => {
      room.phase = 'police-reveal';
      const police = room.players.find(p => p.role === 'Police');
      io.to(roomId).emit('phase-changed', {
        phase: 'police-reveal',
        data: {
          policeName: police?.name,
          policeId: police?.id,
        },
        roundHistory: room.roundHistory,
      });
    }, 3000);
  });
};
