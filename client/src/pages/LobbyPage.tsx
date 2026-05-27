import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../services/socket';

export const LobbyPage = () => {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    socket.emit('create-room', playerName.trim());
    socket.once('room-created', (room) => {
      navigate(`/room/${room.id}`);
    });
    socket.once('error', (msg) => setError(msg));
  };

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomId.trim()) {
      setError('Please enter a room code');
      return;
    }
    socket.emit('join-room', roomId.trim().toUpperCase(), playerName.trim());
    socket.once('room-joined', (room) => {
      navigate(`/room/${room.id}`);
    });
    socket.once('error', (msg) => setError(msg));
  };

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Raja Rani Lobby</h1>

      <div className="mb-4">
        <label className="block mb-1">Your Name</label>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          className="border p-2 w-full rounded"
          placeholder="Enter your name"
        />
      </div>

      <div className="mb-6">
        <button
          onClick={handleCreateRoom}
          className="bg-green-500 text-white px-4 py-2 rounded w-full mb-2"
        >
          Create New Room
        </button>
      </div>

      <div className="border-t pt-4">
        <h2 className="text-lg font-semibold mb-2">Join Existing Room</h2>
        <div className="mb-2">
          <label className="block mb-1">Room Code</label>
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            className="border p-2 w-full rounded"
            placeholder="Enter room code"
            maxLength={6}
          />
        </div>
        <button
          onClick={handleJoinRoom}
          className="bg-blue-500 text-white px-4 py-2 rounded w-full"
        >
          Join Room
        </button>
      </div>

      {error && <p className="text-red-500 mt-4">{error}</p>}
    </div>
  );
};
