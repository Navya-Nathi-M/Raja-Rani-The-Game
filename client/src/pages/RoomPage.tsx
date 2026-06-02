import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { socket } from '../services/socket';
import { Player, Room } from '../types/game';

interface ChatMessage {
  senderId: string;
  senderName: string;
  message: string;
  timestamp: number;
}

export const RoomPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();

  const initialRoom: Room | null = location.state?.room ?? null;
  const [room, setRoom] = useState<Room | null>(initialRoom);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!initialRoom) {
      setError('No room data. Please join from the lobby.');
      setTimeout(() => navigate('/lobby'), 2000);
    }
  }, [initialRoom, navigate]);

  // When room loads, sync my ready state from server (if already in room data)
  useEffect(() => {
    if (room) {
      const me = room.players.find(p => p.socketId === socket.id);
      if (me) setIsReady(me.ready);
    }
  }, [room]);

  // Listen for player join/leave
  useEffect(() => {
    if (!roomId) return;
    const handlePlayerJoined = (player: Player) => {
      setRoom(prev => prev ? { ...prev, players: [...prev.players, player] } : prev);
    };
    const handlePlayerLeft = (player: Player) => {
      setRoom(prev => prev ? { ...prev, players: prev.players.filter(p => p.id !== player.id) } : prev);
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
    return () => { socket.off('game-started', handleGameStarted); };
  }, [navigate]);

  // Chat
  useEffect(() => {
    const handleChatMessage = (msg: ChatMessage) => {
      setChatMessages(prev => [...prev, msg]);
    };
    socket.on('chat-message', handleChatMessage);
    return () => { socket.off('chat-message', handleChatMessage); };
  }, []);

  // Listen for ready updates from others
  useEffect(() => {
    const handleReadyUpdate = ({ playerId, ready }: { playerId: string; ready: boolean }) => {
      setRoom(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map(p => p.id === playerId ? { ...p, ready } : p),
        };
      });
    };
    socket.on('player-ready-updated', handleReadyUpdate);
    return () => { socket.off('player-ready-updated', handleReadyUpdate); };
  }, []);

  const hostPlayer = room?.players[0];
  const isHost = hostPlayer?.socketId === socket.id;
  const allReady = room?.players.every(p => p.ready) ?? false;

  const handleStartGame = () => socket.emit('start-game', roomId);
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    socket.emit('chat-message', roomId, newMessage.trim());
    setNewMessage('');
  };

  const toggleReady = () => {
    socket.emit('player-ready', roomId);
    // Optimistic update (server will confirm)
    setIsReady(prev => !prev);
  };

  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!room) return <div className="p-8">Loading room...</div>;

  return (
    <div className="p-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-2">Room: {room.id}</h1>
      <p className="text-gray-500 mb-4">Players: {room.players.length} / {room.maxPlayers}</p>

      <div className="border rounded p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Players</h2>
        {room.players.map((player, index) => (
          <div key={player.id} className="flex justify-between items-center py-1">
            <span>{player.name}</span>
            <span className="flex items-center gap-2">
              {index === 0 && <span className="text-yellow-600 font-bold text-sm">Host</span>}
              {player.socketId === socket.id && <span className="text-blue-500 text-sm">(You)</span>}
              <span className={`text-sm ${player.ready ? 'text-green-600' : 'text-gray-400'}`}>
                {player.ready ? '✅ Ready' : '⏳ Not Ready'}
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Ready toggle for current player */}
      <div className="mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isReady}
            onChange={toggleReady}
            className="w-5 h-5"
          />
          <span>I'm ready</span>
        </label>
      </div>

      {isHost && room.players.length >= 2 && (
        <button
          onClick={handleStartGame}
          disabled={!allReady}
          className={`px-4 py-2 rounded w-full mb-6 text-white ${
            allReady ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {allReady ? 'Start Game' : 'Waiting for everyone to be ready...'}
        </button>
      )}

      {!isHost && (
        <p className="text-center text-gray-400 italic mb-6">
          Waiting for host to start the game...
        </p>
      )}

      {/* Chat */}
      <div className="border rounded p-4">
        <h3 className="font-semibold mb-2">Room Chat</h3>
        <div className="h-40 overflow-y-auto border rounded p-2 mb-2 bg-gray-50">
          {chatMessages.map((msg, i) => (
            <div key={i} className="mb-1 text-sm">
              <span className="font-bold">{msg.senderName}:</span> {msg.message}
            </div>
          ))}
        </div>
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            className="border p-1 flex-1 rounded"
            placeholder="Type a message..."
          />
          <button type="submit" className="bg-blue-500 text-white px-3 py-1 rounded">
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
