import { createContext, useContext } from 'react';
const GameContext = createContext({});
export const GameProvider = ({ children }: { children: React.ReactNode }) => (
  <GameContext.Provider value={{}}>{children}</GameContext.Provider>
);
export const useGame = () => useContext(GameContext);