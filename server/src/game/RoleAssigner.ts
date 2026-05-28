import { Player } from '../types';

// Edit this list to match your actual roles from the original game
const ROLE_LIST = [
  'Police',
  'Thief',
  'Civilian',
  'Civilian',
  'Civilian',
  'Civilian',
  'Civilian',
  'Civilian',
];

export const assignRoles = (players: Player[]): Player[] => {
  // Shuffle the role list
  const shuffled = [...ROLE_LIST].sort(() => Math.random() - 0.5);

  // Assign one role to each player
  return players.map((player, index) => ({
    ...player,
    role: shuffled[index] || 'Civilian',
  }));
};