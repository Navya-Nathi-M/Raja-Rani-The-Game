import express from 'express';
import http from 'http';
import cors from 'cors';
import { setupSocket } from './socket';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
setupSocket(server);

// Health check
app.get('/', (_req, res) => {
  res.send('Raja Rani server running');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
