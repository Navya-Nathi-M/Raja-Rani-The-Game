export type Role = 'Police' | 'Thief' | 'Civilian' | 'Doctor' | 'Actor' | 'Chor' | 'Mama' | 'Don';

export interface Player {
  id: string;
  name: string;
  socketId: string;
  role?: Role;
  points: number;
  ready: boolean;
}

export interface RoundRecord {
  round: number;
  policeName: string;
  accusedName: string;
  accusedRole: Role;
  isCorrect: boolean;
}

export interface Room {
  id: string;
  players: Player[];
  maxPlayers: number;
  gameStarted: boolean;
  currentRound: number;
  phase: string;
  roundHistory: RoundRecord[];
}
