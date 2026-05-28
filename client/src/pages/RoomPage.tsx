import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { socket } from '../services/socket';
import { Player, Room } from '../types/game';

export const RoomPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();

  // Try to get initial room state from navigation state
  const initialRoom: Room | null = location.state?.room ?? null;

  const [room, setRoom] = useState<Room | null>(initialRoom);
  const [error, setError] = useState('');

  // If no room state (e.g., direct URL access), redirect to lobby
  useEffect(() => {
    if (!initialRoom) {
      setError('No room data. Please join from the lobby.');
      setTimeout(() => navigate('/lobby'), 2000);
    }
  }, [initialRoom, navigate]);

  // Listen for player join/leave updates
  useEffect(() => {
    if (!roomId) return;

    const handlePlayerJoined = (player: Player) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: [...prev.players, player],
        };
      });
    };

    const handlePlayerLeft = (player: Player) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.filter((p) => p.id !== player.id),
        };
      });
    };

    socket.on('player-joined', handlePlayerJoined);
    socket.on('player-left', handlePlayerLeft);

    return () => {
      socket.off('player-joined', handlePlayerJoined);
      socket.off('player-left', handlePlayerLeft);
    };
  }, [roomId]);
    // Listen for game start
  useEffect(() => {
    const handleGameStarted = (updatedRoom: Room) => {
      navigate(`/game/${updatedRoom.id}`, { state: { room: updatedRoom } });
    };

    socket.on('game-started', handleGameStarted);

    return () => {
      socket.off('game-started', handleGameStarted);
    };
  }, [navigate]);

  const hostPlayer = room?.players[0]; // first player is host
  const isHost = hostPlayer?.socketId === socket.id;

  const handleStartGame = () => {
    socket.emit('start-game', roomId);
    // We'll handle the game-started event later
  };

  if (error) {
    return <div className="p-8 text-red-500">{error}</div>;
  }

  if (!room) {
    return <div className="p-8">Loading room...</div>;
  }

  return (
    <div className="p-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-2">Room: {room.id}</h1>
      <p className="text-gray-500 mb-4">
        Players: {room.players.length} / {room.maxPlayers}
      </p>

      <div className="border rounded p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Players</h2>
        {room.players.map((player, index) => (
          <div key={player.id} className="flex justify-between py-1">
            <span>{player.name}</span>
            {index === 0 && <span className="text-yellow-600 font-bold">(Host)</span>}
            {player.socketId === socket.id && (
              <span className="text-blue-500">(You)</span>
            )}
          </div>
        ))}
      </div>

      {isHost && room.players.length >= 2 && (
        <button
          onClick={handleStartGame}
          className="bg-purple-600 text-white px-4 py-2 rounded w-full"
        >
          Start Game
        </button>
      )}

      {!isHost && (
        <p className="text-center text-gray-400 italic">
          Waiting for host to start the game...
        </p>
      )}
    </div>
  );
};