import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { socket } from '../services/socket';
import { Room, Role, Player, RoundRecord } from '../types/game';

interface PhaseData {
  phase: string;
  data?: {
    policeName?: string;
    policeId?: string;
    accusedName?: string;
    accusedRole?: Role;
    isCorrect?: boolean;
    winner?: string;
    points?: number;
  };
  roundHistory?: RoundRecord[];
}

export const GamePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();

  const initialRoom: Room | null = location.state?.room ?? null;
  const [room, setRoom] = useState<Room | null>(initialRoom);
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [policeName, setPoliceName] = useState<string>('');
  const [verdict, setVerdict] = useState<{
    accusedName: string;
    accusedRole: Role;
    isCorrect: boolean;
    policeName: string;
  } | null>(null);
  const [winner, setWinner] = useState<{ name: string; points: number } | null>(null);
  const [error, setError] = useState('');
  const [players, setPlayers] = useState<Player[]>(initialRoom?.players || []);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [roundHistory, setRoundHistory] = useState<RoundRecord[]>([]);

  useEffect(() => {
    if (!initialRoom) {
      setError('No game data. Redirecting to lobby...');
      setTimeout(() => navigate('/lobby'), 2000);
    }
  }, [initialRoom, navigate]);

  useEffect(() => {
    const handleYourRole = (role: Role) => {
      setMyRole(role);
    };
    socket.on('your-role', handleYourRole);
    return () => { socket.off('your-role', handleYourRole); };
  }, []);

  useEffect(() => {
    const handlePhaseChanged = (phaseData: PhaseData) => {
      setCurrentPhase(phaseData.phase);
      if (phaseData.roundHistory) setRoundHistory(phaseData.roundHistory);
      if (phaseData.phase === 'police-reveal') {
        setPoliceName(phaseData.data?.policeName || '');
        setVerdict(null);
        setCountdown(null);
      } else if (phaseData.phase === 'role-assignment') {
        setCountdown(3);
      } else if (phaseData.phase === 'verdict' && phaseData.data) {
        setVerdict({
          accusedName: phaseData.data.accusedName!,
          accusedRole: phaseData.data.accusedRole!,
          isCorrect: phaseData.data.isCorrect!,
          policeName: phaseData.data.policeName!,
        });
      } else if (phaseData.phase === 'game-over' && phaseData.data) {
        setWinner({ name: phaseData.data.winner!, points: phaseData.data.points! });
      }
    };
    socket.on('phase-changed', handlePhaseChanged);
    return () => { socket.off('phase-changed', handlePhaseChanged); };
  }, []);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => (c ? c - 1 : 0)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    const handleGameStarted = (updatedRoom: Room) => {
      setRoom(updatedRoom);
      setPlayers(updatedRoom.players);
    };
    socket.on('game-started', handleGameStarted);
    return () => { socket.off('game-started', handleGameStarted); };
  }, []);

  const handleAccuse = (accusedPlayerId: string) => {
    socket.emit('accuse', roomId, accusedPlayerId);
  };

  const handleNextRound = () => {
    socket.emit('next-round', roomId);
  };

  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!room) return <div className="p-8">Loading game...</div>;

  return (
    <div className="p-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-2">Game - Room {room.id}</h1>
      <p className="text-gray-500 mb-4">
        Round: {room.currentRound} | Phase: {currentPhase}
      </p>

      {/* Scores */}
      <div className="border rounded p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Scores</h2>
        {players.map(p => (
          <div key={p.id} className="flex justify-between py-1">
            <span>{p.name} {p.socketId === socket.id ? '(You)' : ''}</span>
            <span className="font-bold">{p.points}</span>
          </div>
        ))}
      </div>

      {/* Your role */}
      <div className="border rounded p-4 bg-yellow-50 mb-6">
        <p className="text-center text-lg">
          Your role:{' '}
          {myRole ? <span className="font-bold">{myRole}</span> : <span className="italic text-gray-400">Waiting...</span>}
        </p>
      </div>

      {/* Countdown */}
      {countdown !== null && currentPhase === 'role-assignment' && (
        <div className="border rounded p-4 bg-gray-100 mb-6 text-center">
          <p className="text-4xl font-bold">{countdown}</p>
          <p className="text-sm text-gray-600">Memorise your role...</p>
        </div>
      )}

      {/* Police reveal */}
      {currentPhase === 'police-reveal' && policeName && (
        <div className="border rounded p-4 bg-blue-50 mb-6">
          <p className="text-center text-lg">
            🚔 <span className="font-bold">{policeName}</span> is the Police!
          </p>
          {myRole === 'Police' && (
            <p className="text-center text-sm mt-2 text-blue-700">
              That's you! Accuse someone below.
            </p>
          )}
        </div>
      )}

      {/* Accusation buttons for police */}
      {currentPhase === 'police-reveal' && myRole === 'Police' && (
        <div className="border rounded p-4 mb-6">
          <h3 className="font-semibold mb-2">Who is the Thief?</h3>
          {players.filter(p => p.socketId !== socket.id).map(p => (
            <button
              key={p.id}
              onClick={() => handleAccuse(p.id)}
              className="block w-full text-left p-2 mb-1 border rounded hover:bg-gray-100"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Verdict display */}
      {currentPhase === 'verdict' && verdict && (
        <div className={`border rounded p-4 mb-6 ${verdict.isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className="text-center text-lg font-bold">
            {verdict.isCorrect ? '✅ Correct!' : '❌ Wrong!'}
          </p>
          <p className="text-center">
            {verdict.policeName} accused {verdict.accusedName}
          </p>
          <p className="text-center">
            They were the <span className="font-bold">{verdict.accusedRole}</span>
            {verdict.isCorrect ? ' — Police gets bonus points!' : ' — Thief gets bonus points!'}
          </p>
          <div className="text-center mt-3">
            <button onClick={handleNextRound} className="bg-purple-600 text-white px-4 py-2 rounded">
              Next Round
            </button>
          </div>
        </div>
      )}

      {/* Round History */}
      {roundHistory.length > 0 && (
        <div className="border rounded p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">Round History</h2>
          {roundHistory.map((rec, i) => (
            <div key={i} className="text-sm py-1 border-b last:border-0">
              Round {rec.round}: {rec.policeName} accused {rec.accusedName} —{' '}
              {rec.isCorrect ? '✅ Correct (was Thief)' : `❌ Wrong (was ${rec.accusedRole})`}
            </div>
          ))}
        </div>
      )}

      {/* Game Over */}
      {currentPhase === 'game-over' && winner && (
        <div className="border rounded p-4 bg-yellow-100 mb-6 text-center">
          <p className="text-xl font-bold">🏆 {winner.name} wins!</p>
          <p className="text-lg">with {winner.points} points</p>
          <button
            onClick={() => navigate('/lobby')}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
          >
            Back to Lobby
          </button>
        </div>
      )}

      {/* Waiting messages */}
      {currentPhase === 'role-assignment' && countdown === null && (
        <p className="text-center text-gray-400 italic">Roles are being assigned...</p>
      )}
      {currentPhase === 'police-reveal' && myRole !== 'Police' && (
        <p className="text-center text-gray-400 italic">Watch the Police make their accusation...</p>
      )}
    </div>
  );
};
