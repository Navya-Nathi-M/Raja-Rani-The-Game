import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import { GameProvider } from './context/GameContext';
import { HomePage } from './pages/HomePage';
import { LobbyPage } from './pages/LobbyPage';
import { RoomPage } from './pages/RoomPage';
import { GamePage } from './pages/GamePage';
import { ResultPage } from './pages/ResultPage';

function App() {
  return (
    <BrowserRouter>
      <SocketProvider>
        <GameProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/lobby" element={<LobbyPage />} />
            <Route path="/room/:roomId" element={<RoomPage />} />
            <Route path="/game/:roomId" element={<GamePage />} />
            <Route path="/results" element={<ResultPage />} />
          </Routes>
        </GameProvider>
      </SocketProvider>
    </BrowserRouter>
  );
}

export default App;