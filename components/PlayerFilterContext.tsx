"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface PlayerFilter {
  playerId: string | null;
  teamId: string | null;
}

interface PlayerFilterContextType {
  selectedPlayer: PlayerFilter;
  setSelectedPlayer: (filter: PlayerFilter) => void;
  clearFilter: () => void;
}

const PlayerFilterContext = createContext<PlayerFilterContextType | undefined>(
  undefined
);

export function PlayerFilterProvider({ children }: { children: ReactNode }) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerFilter>({
    playerId: null,
    teamId: null,
  });

  const clearFilter = () => {
    setSelectedPlayer({ playerId: null, teamId: null });
  };

  return (
    <PlayerFilterContext.Provider
      value={{ selectedPlayer, setSelectedPlayer, clearFilter }}
    >
      {children}
    </PlayerFilterContext.Provider>
  );
}

export function usePlayerFilter() {
  const context = useContext(PlayerFilterContext);
  if (context === undefined) {
    throw new Error(
      "usePlayerFilter must be used within a PlayerFilterProvider"
    );
  }
  return context;
}
