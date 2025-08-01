import { create } from "zustand";
import { useGameState } from "./useGameState";
import { Player, GameTile } from "../types/game";

interface MultiplayerState {
  socket: WebSocket | null;
  isConnected: boolean;
  isConnecting: boolean;
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  spawnPlayer: () => void;
  selectTile: (tileId: number) => void;
  expandTerritory: (tileId: number) => void;
  adjustWorkerRatio: (ratio: number) => void;
  
  // Message handlers
  handleMessage: (event: MessageEvent) => void;
}

export const useMultiplayer = create<MultiplayerState>((set, get) => ({
  socket: null,
  isConnected: false,
  isConnecting: false,
  
  connect: () => {
    const state = get();
    if (state.socket || state.isConnecting) return;
    
    set({ isConnecting: true });
    
    // Connect to WebSocket server
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        console.log('Connected to game server');
        set({ 
          socket, 
          isConnected: true, 
          isConnecting: false 
        });
        
        useGameState.getState().setGamePhase('waiting');
      };
      
      socket.onmessage = (event) => {
        get().handleMessage(event);
      };
      
      socket.onclose = () => {
        console.log('Disconnected from game server');
        set({ 
          socket: null, 
          isConnected: false, 
          isConnecting: false 
        });
        
        useGameState.getState().setGamePhase('waiting');
      };
      
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        set({ 
          socket: null, 
          isConnected: false, 
          isConnecting: false 
        });
      };
      
    } catch (error) {
      console.error('Failed to connect:', error);
      set({ isConnecting: false });
    }
  },
  
  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.close();
    }
    set({ 
      socket: null, 
      isConnected: false, 
      isConnecting: false 
    });
  },
  
  spawnPlayer: () => {
    const { socket } = get();
    if (!socket) return;
    
    socket.send(JSON.stringify({
      type: 'spawn_player',
      data: {
        username: `Player_${Math.random().toString(36).substr(2, 6)}`
      }
    }));
  },
  
  selectTile: (tileId: number) => {
    const { socket } = get();
    if (!socket) return;
    
    socket.send(JSON.stringify({
      type: 'select_tile',
      data: { tileId }
    }));
  },
  
  expandTerritory: (tileId: number) => {
    const { socket } = get();
    if (!socket) return;
    
    socket.send(JSON.stringify({
      type: 'expand_territory',
      data: { tileId }
    }));
  },
  
  adjustWorkerRatio: (ratio: number) => {
    const { socket } = get();
    const currentPlayer = useGameState.getState().currentPlayer;
    if (!socket || !currentPlayer) return;
    
    // Update locally first for responsive UI
    useGameState.getState().updatePlayer(currentPlayer.id, { workerRatio: ratio });
    
    // Send to server
    socket.send(JSON.stringify({
      type: 'adjust_worker_ratio',
      data: { ratio }
    }));
  },
  
  handleMessage: (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      const gameState = useGameState.getState();
      
      switch (message.type) {
        case 'game_state':
          gameState.updateGameState(message.data);
          break;
          
        case 'player_spawned':
          const player: Player = message.data.player;
          gameState.setCurrentPlayer(player);
          gameState.addPlayer(player);
          gameState.setGamePhase('playing');
          break;
          
        case 'player_joined':
          gameState.addPlayer(message.data.player);
          break;
          
        case 'player_left':
          gameState.removePlayer(message.data.playerId);
          break;
          
        case 'tile_updated':
          const tile: GameTile = message.data.tile;
          gameState.updateTile(tile.id, tile);
          break;
          
        case 'player_updated':
          const updatedPlayer: Player = message.data.player;
          gameState.updatePlayer(updatedPlayer.id, updatedPlayer);
          break;
          
        case 'territory_expanded':
          const { tileId, playerId } = message.data;
          gameState.updateTile(tileId, { ownerId: playerId });
          break;
          
        case 'error':
          console.error('Game error:', message.data.message);
          break;
          
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }
}));
