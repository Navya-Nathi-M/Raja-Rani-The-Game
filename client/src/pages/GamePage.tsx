import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { socket } from '../services/socket';
import { Room, Role } from '../types/game';

export const GamePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();

  const initialRoom: Room | null = location.state?.room ?? null;
  const [room, setRoom] = useState<Room | null>(initialRoom);
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initialRoom) {
      setError('No game data. Redirecting to lobby...');
      setTimeout(() => navigate('/lobby'), 2000);
    }
  }, [initialRoom, navigate]);

  // Listen for private role assignment
  useEffect(() => {
    const handleYourRole = (role: Role) => {
      setMyRole(role);
    };

    socket.on('your-role', handleYourRole);

    return () => {
      socket.off('your-role', handleYourRole);
    };
  }, []);

  if (error) {
    return <div className="p-8 text-red-500">{error}</div>;
  }

  if (!room) {
    return <div className="p-8">Loading game...</div>;
  }

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

      <div className="border rounded p-4 bg-yellow-50 mb-6">
        <p className="text-center text-lg">
          Your role:{' '}
          {myRole ? (
            <span className="font-bold">{myRole}</span>
          ) : (
            <span className="italic text-gray-400">Waiting for assignment...</span>
          )}
        </p>
      </div>

      {myRole === 'Police' && (
        <div className="border rounded p-4 bg-blue-50 mb-6">
          <p className="text-center">
            You are the <span className="font-bold">Police</span>! Soon you will reveal yourself and find the Thief.
          </p>
        </div>
      )}

      <p className="text-center text-gray-400 italic">
        {myRole ? 'Waiting for the next phase...' : 'Roles are being assigned...'}
      </p>
    </div>
  );
};