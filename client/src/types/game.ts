export type Role = 'Police' | 'Thief' | 'Civilian' | 'Doctor' | 'Actor' | 'Chor' | 'Mama' | 'Don';

export type GamePhase = 'lobby' | 'role-assignment' | 'police-reveal' | 'accusation' | 'verdict' | 'game-over';

export interface Player {
  id: string;
  name: string;
  socketId: string;
  role?: Role;
  points: number;
}

export interface Room {
  id: string;
  players: Player[];
  maxPlayers: number;
  gameStarted: boolean;
  currentRound: number;
  phase: GamePhase;
}