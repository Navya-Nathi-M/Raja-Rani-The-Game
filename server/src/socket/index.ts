import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { setupRoomHandlers } from './roomHandler';

export const setupSocket = (server: HttpServer) => {
  const io = new Server(server, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);
    setupRoomHandlers(socket);
  });

  return io;
};
