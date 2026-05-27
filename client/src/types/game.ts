export type Role = 'Police' | 'Thief' | 'King' | 'Queen' | 'Bishop' | 'MilkMan' | 'Gardener' | 'Farmer';

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
}