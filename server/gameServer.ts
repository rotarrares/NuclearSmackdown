import { WebSocket } from "ws";

import { GameState } from "./gameState";

import { Player, GameTile, GameMessage } from "../client/src/lib/types/game";

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
    // Start game loop (10 FPS for better network sync)
    this.gameLoop = setInterval(() => {
      this.update();
    }, 100);
    // Start ping interval (every 30 seconds)
    this.pingInterval = setInterval(() => {
      this.pingClients();
    }, 30000);
    console.log("Game server initialized");
  }

  handleConnection(ws: WebSocket) {
    const connection: ClientConnection = {
      ws,
      lastPing: Date.now(),
    };
    this.connections.set(ws, connection);
    // Send current game state to new client
    this.sendToClient(ws, {
      type: "game_state",
      data: {
        players: Array.from(this.gameState.getPlayers().values()),
        tiles: Array.from(this.gameState.getTiles().values()),
        gameTime: this.gameState.getGameTime(),
      },
    });

    ws.on("message", (data) => {
      try {
        const message: GameMessage = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        console.error("Failed to parse message:", error);
        this.sendError(ws, "Invalid message format");
      }
    });

    ws.on("pong", () => {
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
      this.broadcast(
        {
          type: "player_left",
          data: { playerId: connection.playerId },
        },
        ws,
      );
    }
    this.connections.delete(ws);
  }

  private handleMessage(ws: WebSocket, message: GameMessage) {
    const connection = this.connections.get(ws);
    if (!connection) return;

    switch (message.type) {
      case "spawn_player":
        this.handleSpawnPlayer(ws, message.data);
        break;
      case "select_tile":
        this.handleSelectTile(ws, message.data);
        break;
      case "expand_territory":
        this.handleExpandTerritory(ws, message.data);
        break;
      case "build_structure":
        this.handleBuildStructure(ws, message.data);
        break;
      case "adjust_worker_ratio":
        this.handleAdjustWorkerRatio(ws, message.data);
        break;
      case "adjust_troop_deployment":
        this.handleAdjustTroopDeployment(ws, message.data);
        break;
      case "start_conquest":
        this.handleStartConquest(ws, message.data);
        break;
      case "cancel_conquest":
        this.handleCancelConquest(ws, message.data);
        break;
      case "launch_missile":
        this.handleLaunchMissile(ws, message.data);
        break;
      case "create_alliance":
        this.handleCreateAlliance(ws, message.data);
        break;
      case "join_alliance":
        this.handleJoinAlliance(ws, message.data);
        break;
      case "leave_alliance":
        this.handleLeaveAlliance(ws, message.data);
        break;
      case "kick_from_alliance":
        this.handleKickFromAlliance(ws, message.data);
        break;
      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  private handleSpawnPlayer(ws: WebSocket, data: { username: string }) {
    const connection = this.connections.get(ws);
    if (!connection) return;

    if (connection.playerId) {
      this.sendError(ws, "Player already spawned");
      return;
    }

    const player = this.gameState.spawnPlayer(data.username);
    connection.playerId = player.id;
    // Send spawn confirmation to client
    this.sendToClient(ws, {
      type: "player_spawned",
      data: { player },
    });
    // Notify other clients
    this.broadcast(
      {
        type: "player_joined",
        data: { player },
      },
      ws,
    );
    console.log(`Player spawned: ${player.username} (${player.id})`);
  }

  private handleSelectTile(ws: WebSocket, data: { tileId: number }) {
    const connection = this.connections.get(ws);
    if (!connection?.playerId) {
      this.sendError(ws, "Player not spawned");
      return;
    }

    const result = this.gameState.selectTile(connection.playerId, data.tileId);
    if (result.success) {
      if (result.data?.type === "building_options") {
        // Send building options back to client
        this.sendToClient(ws, {
          type: "building_options",
          data: result.data,
        });
      } else {
        // Territory expansion successful - immediate broadcast
        const claimedTiles = result.data?.claimedTiles || [];
        for (const tileId of claimedTiles) {
          this.broadcast({
            type: "territory_expanded",
            data: {
              tileId,
              playerId: connection.playerId,
            },
          });
        }
        // Update player stats immediately
        this.broadcast({
          type: "player_updated",
          data: {
            player: this.gameState.getPlayer(connection.playerId),
          },
        });
        // Send immediate game state update for better sync
        this.broadcast({
          type: "game_state",
          data: {
            players: Array.from(this.gameState.getPlayers().values()),
            tiles: Array.from(this.gameState.getTiles().values()),
            missiles: Array.from(this.gameState.getMissiles().values()),
            gameTime: this.gameState.getGameTime(),
          },
        });
      }
    } else {
      this.sendError(ws, result.error || "Cannot select tile");
    }
  }

  private handleBuildStructure(
    ws: WebSocket,
    data: { tileId: number; structureType: "city" | "port" | "missile_silo" },
  ) {
    const connection = this.connections.get(ws);
    if (!connection?.playerId) {
      this.sendError(ws, "Player not spawned");
      return;
    }

    const result = this.gameState.buildStructure(
      connection.playerId,
      data.tileId,
      data.structureType,
    );
    if (result.success && result.data?.tile) {
      // Broadcast structure built with full tile data - immediate sync
      this.broadcast({
        type: "structure_built",
        data: {
          tile: result.data.tile,
        },
      });
      // Update player stats immediately
      this.broadcast({
        type: "player_updated",
        data: {
          player: this.gameState.getPlayer(connection.playerId),
        },
      });
      // Send immediate game state update
      this.broadcast({
        type: "game_state",
        data: {
          players: Array.from(this.gameState.getPlayers().values()),
          tiles: Array.from(this.gameState.getTiles().values()),
          missiles: Array.from(this.gameState.getMissiles().values()),
          gameTime: this.gameState.getGameTime(),
        },
      });
    } else {
      this.sendError(ws, result.error || "Cannot build structure");
    }
  }

  private handleExpandTerritory(ws: WebSocket, data: { tileId: number }) {
    // Same as select tile for now
    this.handleSelectTile(ws, data);
  }

  private handleAdjustWorkerRatio(ws: WebSocket, data: { ratio: number }) {
    const connection = this.connections.get(ws);
    if (!connection?.playerId) {
      this.sendError(ws, "Player not spawned");
      return;
    }

    const result = this.gameState.adjustWorkerRatio(
      connection.playerId,
      data.ratio,
    );
    if (result.success) {
      this.broadcast({
        type: "player_updated",
        data: {
          player: this.gameState.getPlayer(connection.playerId),
        },
      });
    } else {
      this.sendError(ws, result.error || "Cannot adjust worker ratio");
    }
  }

  private handleAdjustTroopDeployment(ws: WebSocket, data: { deployment: number }) {
    const connection = this.connections.get(ws);
    if (!connection?.playerId) {
      this.sendError(ws, "Player not spawned");
      return;
    }

    const result = this.gameState.adjustTroopDeployment(
      connection.playerId,
      data.deployment,
    );
    if (result.success) {
      this.broadcast({
        type: "player_updated",
        data: {
          player: this.gameState.getPlayer(connection.playerId),
        },
      });
    } else {
      this.sendError(ws, result.error || "Cannot adjust troop deployment");
    }
  }

  private handleStartConquest(ws: WebSocket, data: { tileId: number }) {
    const connection = this.connections.get(ws);
    if (!connection?.playerId) {
      this.sendError(ws, "Player not spawned");
      return;
    }

    const result = this.gameState.startConquest(connection.playerId, data.tileId);
    if (result.success) {
      this.broadcast({
        type: "conquest_started",
        data: {
          playerId: connection.playerId,
          conquestTroops: result.data?.conquestTroops,
        },
      });
      this.broadcast({
        type: "player_updated",
        data: {
          player: this.gameState.getPlayer(connection.playerId),
        },
      });
    } else {
      this.sendError(ws, result.error || "Cannot start conquest");
    }
  }

  private handleCancelConquest(ws: WebSocket, data: {}) {
    const connection = this.connections.get(ws);
    if (!connection?.playerId) {
      this.sendError(ws, "Player not spawned");
      return;
    }

    const result = this.gameState.cancelConquest(connection.playerId);
    if (result.success) {
      this.broadcast({
        type: "conquest_cancelled",
        data: {
          playerId: connection.playerId,
        },
      });
      this.broadcast({
        type: "player_updated",
        data: {
          player: this.gameState.getPlayer(connection.playerId),
        },
      });
    } else {
      this.sendError(ws, result.error || "Cannot cancel conquest");
    }
  }

  private handleLaunchMissile(
    ws: WebSocket,
    data: { fromTileId: number; toTileId: number },
  ) {
    const connection = this.connections.get(ws);
    if (!connection?.playerId) {
      this.sendError(ws, "Player not spawned");
      return;
    }

    const result = this.gameState.launchMissile(
      connection.playerId,
      data.fromTileId,
      data.toTileId,
    );
    if (result.success && result.data?.missile) {
      // Broadcast missile launch to all clients
      this.broadcast({
        type: "missile_launched",
        data: {
          missile: result.data.missile,
        },
      });
      // Update player stats immediately after missile launch
      this.broadcast({
        type: "player_updated",
        data: {
          player: this.gameState.getPlayer(connection.playerId),
        },
      });
      // Send immediate game state update
      this.broadcast({
        type: "game_state",
        data: {
          players: Array.from(this.gameState.getPlayers().values()),
          tiles: Array.from(this.gameState.getTiles().values()),
          missiles: Array.from(this.gameState.getMissiles().values()),
          gameTime: this.gameState.getGameTime(),
        },
      });
      // Schedule missile impact
      setTimeout(() => {
        const impactResult = this.gameState.impactMissile(
          result.data.missile.id,
        );
        if (impactResult.success) {
          this.broadcast({
            type: "missile_impact",
            data: {
              missileId: result.data.missile.id,
              tileId: data.toTileId,
              tile: impactResult.data?.tile,
            },
          });
        }
      }, result.data.missile.travelTime);
      console.log(
        `Missile launched from ${data.fromTileId} to ${data.toTileId} by player ${connection.playerId}`,
      );
    } else {
      console.log(`Missile launch failed: ${result.error}`);
      this.sendError(ws, result.error || "Cannot launch missile");
    }
  }

  private update() {
    // Update game state
    this.gameState.update();
    
    // Broadcast any conquest events that occurred for immediate feedback
    const conquestEvents = this.gameState.getConquestEvents();
    conquestEvents.forEach(event => {
      if (event.type === 'territory_claimed') {
        this.broadcast({
          type: "territory_expanded",
          data: {
            tileId: event.tileId,
            playerId: event.playerId,
            population: event.population
          }
        });
      }
      // Send conquest progress updates for real-time troop depletion feedback
      const player = this.gameState.getPlayer(event.playerId);
      if (player) {
        this.broadcast({
          type: "conquest_progress",
          data: {
            playerId: event.playerId,
            conquestTroops: Math.max(0, player.conquestTroops),
            isConquering: player.isConquering,
            troopsRemaining: Math.max(0, player.conquestTroops)
          }
        });
        console.log(`Broadcasting conquest progress: Player ${event.playerId} has ${player.conquestTroops} troops remaining`);
      }
    });
    
    // Broadcast frequent updates for better synchronization
    if (this.gameState.getGameTime() % 10 == 0) {
      // Every 1 second (10 ticks at 100ms intervals)
      this.broadcast({
        type: "game_state",
        data: {
          players: Array.from(this.gameState.getPlayers().values()),
          tiles: Array.from(this.gameState.getTiles().values()),
          missiles: Array.from(this.gameState.getMissiles().values()),
          gameTime: this.gameState.getGameTime(),
        },
      });
    }
  }

  private pingClients() {
    const now = Date.now();
    this.connections.forEach((connection, ws) => {
      // Remove stale connections (no pong for 60 seconds)
      if (now - connection.lastPing > 60000) {
        console.log("Removing stale connection");
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
      type: "error",
      data: { message },
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
      .map((player) => {
        const territoryCount = Array.from(tiles.values()).filter(
          (tile) => tile.ownerId === player.id,
        ).length;
        return {
          username: player.username,
          gold: Math.floor(player.gold),
          population: Math.floor(player.population),
          territory: territoryCount,
          score: Math.floor(
            player.gold + player.population + territoryCount * 10,
          ),
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

  private handleCreateAlliance(
    ws: WebSocket,
    data: { name: string; isPublic: boolean },
  ) {
    const connection = this.connections.get(ws);
    if (!connection?.playerId) {
      this.sendError(ws, "Player not spawned");
      return;
    }

    const result = this.gameState.createAlliance(
      connection.playerId,
      data.name,
      data.isPublic,
    );
    if (result.success) {
      this.sendToClient(ws, { type: "alliance_created", data: result.data });
      this.broadcast({ type: "alliance_updated", data: result.data });
    } else {
      this.sendError(ws, result.error || "Failed to create alliance");
    }
  }

  private handleJoinAlliance(ws: WebSocket, data: { allianceId: string }) {
    const connection = this.connections.get(ws);
    if (!connection?.playerId) {
      this.sendError(ws, "Player not spawned");
      return;
    }

    const result = this.gameState.joinAlliance(
      connection.playerId,
      data.allianceId,
    );
    if (result.success) {
      this.sendToClient(ws, { type: "alliance_joined", data: result.data });
      this.broadcast({ type: "alliance_updated", data: result.data });
    } else {
      this.sendError(ws, result.error || "Failed to join alliance");
    }
  }

  private handleLeaveAlliance(ws: WebSocket, data: {}) {
    const connection = this.connections.get(ws);
    if (!connection?.playerId) {
      this.sendError(ws, "Player not spawned");
      return;
    }

    const result = this.gameState.leaveAlliance(connection.playerId);
    if (result.success) {
      this.sendToClient(ws, { type: "alliance_left", data: result.data });
      this.broadcast({ type: "alliance_updated", data: result.data });
    } else {
      this.sendError(ws, result.error || "Failed to leave alliance");
    }
  }

  private handleKickFromAlliance(ws: WebSocket, data: { memberId: string }) {
    const connection = this.connections.get(ws);
    if (!connection?.playerId) {
      this.sendError(ws, "Player not spawned");
      return;
    }

    const result = this.gameState.kickFromAlliance(
      connection.playerId,
      data.memberId,
    );
    if (result.success) {
      this.sendToClient(ws, {
        type: "alliance_member_kicked",
        data: result.data,
      });
      this.broadcast({ type: "alliance_updated", data: result.data });
    } else {
      this.sendError(ws, result.error || "Failed to kick member");
    }
  }
}