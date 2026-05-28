import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { socket } from '../services/socket';
import { Room } from '../types/game';

export const GamePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();

  const initialRoom: Room | null = location.state?.room ?? null;
  const [room, setRoom] = useState<Room | null>(initialRoom);

  useEffect(() => {
    if (!initialRoom) {
      setTimeout(() => navigate('/lobby'), 2000);
    }
  }, [initialRoom, navigate]);

  if (!room) {
    return <div className="p-8">Loading game...</div>;
  }

  const myPlayer = room.players.find((p) => p.socketId === socket.id);

  return (
    <div className="p-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-2">Game - Room {room.id}</h1>
      <p className="text-gray-500 mb-4">Round: {room.currentRound}</p>

      <div className="border rounded p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Players</h2>
        {room.players.map((player) => (
          <div key={player.id} className="flex justify-between py-1">
            <span>{player.name}</span>
            {player.socketId === socket.id && (
              <span className="text-blue-500">(You)</span>
            )}
          </div>
        ))}
      </div>

      {myPlayer && (
        <div className="border rounded p-4 bg-yellow-50">
          <p className="text-center text-lg">
            Your role: <span className="font-bold">{myPlayer.role ?? 'Not assigned yet'}</span>
          </p>
        </div>
      )}

      <p className="text-center text-gray-400 italic mt-4">
        Waiting for roles to be assigned...
      </p>
    </div>
  );
};