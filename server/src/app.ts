import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// REST health check
app.get('/', (_req, res) => {
  res.send('Raja Rani server running');
});

// Socket.IO test
io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('join-room', (roomId: string, playerName: string) => {
    socket.join(roomId);
    console.log(`${playerName} joined room ${roomId}`);
    // For now just broadcast a placeholder
    io.to(roomId).emit('player-joined', { id: socket.id, name: playerName });
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});