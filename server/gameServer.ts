import { WebSocket } from 'ws';
import { GameState } from './gameState';
import { Player, GameTile, GameMessage } from '../client/src/lib/types/game';

interface ClientConnection {
  ws: WebSocket;
  playerId?: string;
  lastPing: number;
}

export class GameServer {
  private gameState: GameState;
  private connections: Map<WebSocket, ClientConnection> = new Map();
  private gameLoop: NodeJS.Timeout;
  private pingInterval: NodeJS.Timeout;

  constructor() {
    this.gameState = new GameState();
    
    // Start game loop (60 FPS)
    this.gameLoop = setInterval(() => {
      this.update();
    }, 1000 / 60);
    
    // Start ping interval (every 30 seconds)
    this.pingInterval = setInterval(() => {
      this.pingClients();
    }, 30000);
    
    console.log('Game server initialized');
  }

  handleConnection(ws: WebSocket) {
    const connection: ClientConnection = {
      ws,
      lastPing: Date.now()
    };
    
    this.connections.set(ws, connection);
    
    // Send current game state to new client
    this.sendToClient(ws, {
      type: 'game_state',
      data: {
        players: Array.from(this.gameState.getPlayers().values()),
        tiles: Array.from(this.gameState.getTiles().values()),
        gameTime: this.gameState.getGameTime()
      }
    });
    
    ws.on('message', (data) => {
      try {
        const message: GameMessage = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('Failed to parse message:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });
    
    ws.on('pong', () => {
      const connection = this.connections.get(ws);
      if (connection) {
        connection.lastPing = Date.now();
      }
    });
  }

  handleDisconnection(ws: WebSocket) {
    const connection = this.connections.get(ws);
    if (connection?.playerId) {
      // Remove player from game
      this.gameState.removePlayer(connection.playerId);
      
      // Notify other clients
      this.broadcast({
        type: 'player_left',
        data: { playerId: connection.playerId }
      }, ws);
    }
    
    this.connections.delete(ws);
  }

  private handleMessage(ws: WebSocket, message: GameMessage) {
    const connection = this.connections.get(ws);
    if (!connection) return;

    switch (message.type) {
      case 'spawn_player':
        this.handleSpawnPlayer(ws, message.data);
        break;
        
      case 'select_tile':
        this.handleSelectTile(ws, message.data);
        break;
        
      case 'expand_territory':
        this.handleExpandTerritory(ws, message.data);
        break;
        
      case 'build_structure':
        this.handleBuildStructure(ws, message.data);
        break;
        
      case 'adjust_worker_ratio':
        this.handleAdjustWorkerRatio(ws, message.data);
        break;
        
      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  private handleSpawnPlayer(ws: WebSocket, data: { username: string }) {
    const connection = this.connections.get(ws);
    if (!connection) return;
    
    if (connection.playerId) {
      this.sendError(ws, 'Player already spawned');
      return;
    }
    
    const player = this.gameState.spawnPlayer(data.username);
    connection.playerId = player.id;
    
    // Send spawn confirmation to client
    this.sendToClient(ws, {
      type: 'player_spawned',
      data: { player }
    });
    
    // Notify other clients
    this.broadcast({
      type: 'player_joined',
      data: { player }
    }, ws);
    
    console.log(`Player spawned: ${player.username} (${player.id})`);
  }

  private handleSelectTile(ws: WebSocket, data: { tileId: number }) {
    const connection = this.connections.get(ws);
    if (!connection?.playerId) {
      this.sendError(ws, 'Player not spawned');
      return;
    }
    
    const result = this.gameState.selectTile(connection.playerId, data.tileId);
    
    if (result.success) {
      if (result.data?.type === 'building_options') {
        // Send building options back to client
        this.sendToClient(ws, {
          type: 'building_options',
          data: result.data
        });
      } else {
        // Territory expansion successful
        this.broadcast({
          type: 'territory_expanded',
          data: {
            tileId: data.tileId,
            playerId: connection.playerId
          }
        });
        
        // Update player stats
        this.broadcast({
          type: 'player_updated',
          data: {
            player: this.gameState.getPlayer(connection.playerId)
          }
        });
      }
    } else {
      this.sendError(ws, result.error || 'Cannot select tile');
    }
  }

  private handleBuildStructure(ws: WebSocket, data: { tileId: number, structureType: 'city' | 'port' | 'missile_silo' }) {
    const connection = this.connections.get(ws);
    if (!connection?.playerId) {
      this.sendError(ws, 'Player not spawned');
      return;
    }
    
    const result = this.gameState.buildStructure(connection.playerId, data.tileId, data.structureType);
    
    if (result.success && result.data?.tile) {
      // Broadcast structure built with full tile data
      this.broadcast({
        type: 'structure_built',
        data: {
          tile: result.data.tile
        }
      });
      
      // Update player stats
      this.broadcast({
        type: 'player_updated',
        data: {
          player: this.gameState.getPlayer(connection.playerId)
        }
      });
    } else {
      this.sendError(ws, result.error || 'Cannot build structure');
    }
  }

  private handleExpandTerritory(ws: WebSocket, data: { tileId: number }) {
    // Same as select tile for now
    this.handleSelectTile(ws, data);
  }

  private handleAdjustWorkerRatio(ws: WebSocket, data: { ratio: number }) {
    const connection = this.connections.get(ws);
    if (!connection?.playerId) {
      this.sendError(ws, 'Player not spawned');
      return;
    }
    
    const result = this.gameState.adjustWorkerRatio(connection.playerId, data.ratio);
    
    if (result.success) {
      this.broadcast({
        type: 'player_updated',
        data: {
          player: this.gameState.getPlayer(connection.playerId)
        }
      });
    } else {
      this.sendError(ws, result.error || 'Cannot adjust worker ratio');
    }
  }

  private update() {
    // Update game state
    this.gameState.update();
    
    // Broadcast periodic updates (every 5 seconds)
    if (this.gameState.getGameTime() % 5000 < 16) { // Approximately every 5 seconds
      this.broadcast({
        type: 'game_state',
        data: {
          players: Array.from(this.gameState.getPlayers().values()),
          tiles: Array.from(this.gameState.getTiles().values()),
          gameTime: this.gameState.getGameTime()
        }
      });
    }
  }

  private pingClients() {
    const now = Date.now();
    
    this.connections.forEach((connection, ws) => {
      // Remove stale connections (no pong for 60 seconds)
      if (now - connection.lastPing > 60000) {
        console.log('Removing stale connection');
        ws.terminate();
        this.handleDisconnection(ws);
        return;
      }
      
      // Send ping
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }

  private sendToClient(ws: WebSocket, message: GameMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private broadcast(message: GameMessage, exclude?: WebSocket) {
    this.connections.forEach((connection, ws) => {
      if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  private sendError(ws: WebSocket, message: string) {
    this.sendToClient(ws, {
      type: 'error',
      data: { message }
    });
  }

  // Public methods for API endpoints
  getPlayerCount(): number {
    return this.gameState.getPlayers().size;
  }

  getGameTime(): number {
    return this.gameState.getGameTime();
  }

  getLeaderboard() {
    const players = Array.from(this.gameState.getPlayers().values());
    const tiles = this.gameState.getTiles();
    
    return players
      .map(player => {
        const territoryCount = Array.from(tiles.values())
          .filter(tile => tile.ownerId === player.id).length;
        
        return {
          username: player.username,
          gold: Math.floor(player.gold),
          population: Math.floor(player.population),
          territory: territoryCount,
          score: Math.floor(player.gold + player.population + territoryCount * 10)
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  destroy() {
    clearInterval(this.gameLoop);
    clearInterval(this.pingInterval);
    
    this.connections.forEach((connection, ws) => {
      ws.close();
    });
    
    this.connections.clear();
  }
}
