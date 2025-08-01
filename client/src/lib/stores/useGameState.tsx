import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { Player, GameTile, GamePhase } from "../types/game";
import { Missile } from "../../shared/schema";
import { TileData } from "../geometry/GlobeGeometry";

interface GameState {
  // Game phase
  gamePhase: GamePhase;
  
  // Players
  players: Map<string, Player>;
  currentPlayer: Player | null;
  
  // World state
  tiles: Map<number, GameTile>;
  missiles: Map<string, Missile>;
  hoveredTile: TileData | null;
  
  // UI state
  buildingOptions: {
    tileId: number;
    canBuildPort: boolean;
    position: { x: number; y: number };
  } | null;
  alerts: { message: string; type: 'info' | 'warning' | 'error'; id: string }[];
  
  // Game time
  gameTime: number;
  
  // Actions
  setGamePhase: (phase: GamePhase) => void;
  setCurrentPlayer: (player: Player | null) => void;
  updatePlayer: (playerId: string, updates: Partial<Player>) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  updateTile: (tileId: number, updates: Partial<GameTile>) => void;
  addMissile: (missile: Missile) => void;
  removeMissile: (missileId: string) => void;
  setHoveredTile: (tile: TileData | null) => void;
  setBuildingOptions: (options: { tileId: number; canBuildPort: boolean; position: { x: number; y: number }; } | null) => void;
  addAlert: (message: string, type: 'info' | 'warning' | 'error') => void;
  removeAlert: (id: string) => void;
  updateGameTime: (time: number) => void;
  
  // Bulk updates from server
  updateGameState: (state: {
    players: Player[];
    tiles: GameTile[];
    gameTime: number;
  }) => void;
}

export const useGameState = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    gamePhase: 'waiting',
    players: new Map(),
    currentPlayer: null,
    tiles: new Map(),
    missiles: new Map(),
    hoveredTile: null,
    buildingOptions: null,
    alerts: [],
    gameTime: 0,
    
    setGamePhase: (phase) => set({ gamePhase: phase }),
    
    setCurrentPlayer: (player) => set({ currentPlayer: player }),
    
    updatePlayer: (playerId, updates) => set((state) => {
      const newPlayers = new Map(state.players);
      const existingPlayer = newPlayers.get(playerId);
      
      if (existingPlayer) {
        newPlayers.set(playerId, { ...existingPlayer, ...updates });
      }
      
      // Update current player if it's the same
      const newCurrentPlayer = state.currentPlayer?.id === playerId
        ? { ...state.currentPlayer, ...updates }
        : state.currentPlayer;
      
      return { 
        players: newPlayers,
        currentPlayer: newCurrentPlayer
      };
    }),
    
    addPlayer: (player) => set((state) => {
      const newPlayers = new Map(state.players);
      newPlayers.set(player.id, player);
      return { players: newPlayers };
    }),
    
    removePlayer: (playerId) => set((state) => {
      const newPlayers = new Map(state.players);
      newPlayers.delete(playerId);
      
      const newCurrentPlayer = state.currentPlayer?.id === playerId 
        ? null 
        : state.currentPlayer;
      
      return { 
        players: newPlayers,
        currentPlayer: newCurrentPlayer
      };
    }),
    
    updateTile: (tileId, updates) => set((state) => {
      const newTiles = new Map(state.tiles);
      const existingTile = newTiles.get(tileId);
      
      if (existingTile) {
        newTiles.set(tileId, { ...existingTile, ...updates });
      } else {
        newTiles.set(tileId, { id: tileId, ...updates } as GameTile);
      }
      
      return { tiles: newTiles };
    }),
    
    addMissile: (missile) => set((state) => {
      const newMissiles = new Map(state.missiles);
      newMissiles.set(missile.id, missile);
      return { missiles: newMissiles };
    }),
    
    removeMissile: (missileId) => set((state) => {
      const newMissiles = new Map(state.missiles);
      newMissiles.delete(missileId);
      return { missiles: newMissiles };
    }),
    
    setHoveredTile: (tile) => set({ hoveredTile: tile }),
    
    setBuildingOptions: (options) => set({ buildingOptions: options }),
    
    updateGameTime: (time) => set({ gameTime: time }),

    addAlert: (message, type) => set((state) => ({
      alerts: [...state.alerts, { message, type, id: Date.now().toString() }],
    })),
    removeAlert: (id) => set((state) => ({
      alerts: state.alerts.filter((alert) => alert.id !== id),
    })),

    updateGameState: (state) => set(() => {
      const newPlayers = new Map();
      state.players.forEach(player => {
        newPlayers.set(player.id, player);
      });
      
      const newTiles = new Map();
      state.tiles.forEach(tile => {
        newTiles.set(tile.id, tile);
      });
      
      return {
        players: newPlayers,
        tiles: newTiles,
        gameTime: state.gameTime
      };
    })
  }))
);

// Auto-update population and gold over time
useGameState.subscribe(
  (state) => state.gameTime,
  (gameTime) => {
    const state = useGameState.getState();
    if (!state.currentPlayer) return;
    
    // Update every second (assuming gameTime is in milliseconds)
    const now = Date.now();
    if (now - gameTime < 1000) return;
    
    const { currentPlayer, tiles } = state;
    const ownedTiles = Array.from(tiles.values()).filter(t => t.ownerId === currentPlayer.id);
    
    // Calculate population growth (cities boost growth)
    const baseGrowth = ownedTiles.length * 0.01;
    const cityBonus = ownedTiles.filter(t => t.structureType === 'city').length * 0.05;
    const populationGrowth = baseGrowth + cityBonus;
    
    // Calculate gold generation (workers generate gold)
    const workers = currentPlayer.population * (1 - currentPlayer.workerRatio);
    const goldPerSecond = workers * 0.1;
    
    // Update player stats
    state.updatePlayer(currentPlayer.id, {
      population: currentPlayer.population + populationGrowth,
      gold: currentPlayer.gold + goldPerSecond
    });
  }
);


