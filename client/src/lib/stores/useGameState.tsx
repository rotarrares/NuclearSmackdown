import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { Player, GameTile, GamePhase } from "../types/game";
import { Missile } from "../../../shared/schema";
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
    
    addMissile: (missile) => {
      console.log(`Adding missile ${missile.id} to game state with ${missile.trajectory.length} trajectory points`);
      set((state) => {
        const newMissiles = new Map(state.missiles);
        newMissiles.set(missile.id, missile);
        console.log(`Total missiles in state: ${newMissiles.size}`);
        return { missiles: newMissiles };
      });
    },
    
    removeMissile: (missileId) => {
      console.log(`Removing missile ${missileId} from game state`);
      set((state) => {
        const newMissiles = new Map(state.missiles);
        newMissiles.delete(missileId);
        console.log(`Total missiles after removal: ${newMissiles.size}`);
        return { missiles: newMissiles };
      });
    },
    
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

// REMOVED: Client-side gold generation to prevent sync issues
// The server is the authoritative source for all player stats including gold
// Only the server should update gold values to prevent desynchronization


