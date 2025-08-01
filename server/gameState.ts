import { Player, GameTile, Missile } from "../shared/schema";
import {
  GlobeGeometry,
  TileData,
} from "../client/src/lib/geometry/GlobeGeometry";

interface ActionResult {
  success: boolean;
  error?: string;
  data?: any;
}

export class GameState {
  private players: Map<string, Player> = new Map();
  private tiles: Map<number, GameTile> = new Map();
  private missiles: Map<string, Missile> = new Map();
  private alliances: Map<string, Alliance> = new Map();
  private gameStartTime: number;
  private lastUpdate: number;
  private lastExpansionTime: number;
  private adjacencyMap: Map<number, number[]> = new Map();
  private globeGeometry: GlobeGeometry;
  private tileData: TileData[];

  constructor() {
    this.gameStartTime = Date.now();
    this.lastUpdate = Date.now();
    this.lastExpansionTime = Date.now();

    // Generate globe geometry to get tile positions
    this.globeGeometry = new GlobeGeometry();
    this.tileData = this.globeGeometry.getTileData();

    this.initializeTiles();
    this.buildAdjacencyMap();
  }

  private initializeTiles() {
    // Initialize tiles using the same generation as client
    this.tileData.forEach((tileData) => {
      const tile: GameTile = {
        id: tileData.id,

        population: 0,
        terrainType: tileData.terrainType,
      };
      this.tiles.set(tileData.id, tile);
    });

    console.log(`Initialized ${this.tiles.size} tiles`);
  }

  private buildAdjacencyMap() {
    // Build true geometric adjacency using 3D positions
    // With frequency 64, tiles are much smaller, so we need a smaller threshold
    const neighborThreshold = 0.025; // Much smaller threshold for frequency 64

    this.tileData.forEach((tile, index) => {
      const adjacent: number[] = [];

      // Find all tiles within the neighbor threshold distance
      this.tileData.forEach((otherTile, otherIndex) => {
        if (tile.id !== otherTile.id) {
          // Calculate 3D distance between tile centers
          const distance = tile.center.distanceTo(otherTile.center);

          if (distance < neighborThreshold) {
            adjacent.push(otherTile.id);
          }
        }
      });

      this.adjacencyMap.set(tile.id, adjacent);
    });

    console.log(
      `Built adjacency map with average ${Array.from(this.adjacencyMap.values()).reduce((sum, adj) => sum + adj.length, 0) / this.adjacencyMap.size} neighbors per tile`,
    );
  }

  private getRandomTerrain(): "water" | "grass" | "desert" | "mountain" {
    // Generate terrain: water 65%, grass 20%, desert 10%, mountain 5%
    const rand = Math.random();
    if (rand < 0.65) return "water";
    if (rand < 0.85) return "grass";
    if (rand < 0.95) return "desert";
    return "mountain";
  }

  spawnPlayer(username: string): Player {
    const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Find a safe spawn tile
    const spawnTileId = this.findSafeSpawnTile();

    // Generate random color
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#96CEB4",
      "#FFEAA7",
      "#DDA0DD",
      "#98D8C8",
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const player: Player = {
      id: playerId,
      username,
      color,
      gold: 1000,
      population: 100,
      workerRatio: 0.5,
      lastActive: Date.now(),
    };

    this.players.set(playerId, player);

    // Claim spawn tile and a few surrounding tiles as starter territory
    const spawnTile = this.tiles.get(spawnTileId);
    if (spawnTile) {
      spawnTile.ownerId = playerId;
      spawnTile.structureType = "base_hq"; // Assign Base HQ
      spawnTile.population = 50; // Initial population on spawn tile

      // Claim a few adjacent tiles
      const adjacentTiles = this.adjacencyMap.get(spawnTileId) || [];
      let claimedStarterTiles = 0;
      for (const adjTileId of adjacentTiles) {
        if (claimedStarterTiles >= 3) break; // Claim 3 starter tiles
        const adjTile = this.tiles.get(adjTileId);
        if (adjTile && !adjTile.ownerId && adjTile.terrainType !== "water") {
          adjTile.ownerId = playerId;
          adjTile.population = 10; // Small population for starter tiles
          claimedStarterTiles++;
        }
      }
    }

    return player;
  }

  private findSafeSpawnTile(): number {
    // Find an unclaimed tile that's not water
    const availableTiles = Array.from(this.tiles.entries())
      .filter(([id, tile]) => !tile.ownerId && tile.terrainType !== "water")
      .map(([id]) => id);

    if (availableTiles.length === 0) {
      // Fallback to any tile
      return 0;
    }

    return availableTiles[Math.floor(Math.random() * availableTiles.length)];
  }

  removePlayer(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;

    // Remove ownership from all tiles
    this.tiles.forEach((tile) => {
      if (tile.ownerId === playerId) {
        tile.ownerId = undefined;
        tile.population = 0;
      }
    });

    this.players.delete(playerId);
    return true;
  }

  selectTile(playerId: string, tileId: number): ActionResult {
    const player = this.players.get(playerId);
    const tile = this.tiles.get(tileId);

    if (!player) {
      return { success: false, error: "Player not found" };
    }

    if (!tile) {
      return { success: false, error: "Tile not found" };
    }

    // If tile is already owned by this player, return building options
    if (tile.ownerId === playerId) {
      return {
        success: true,
        data: {
          type: "building_options",
          tileId: tileId,
          canBuildPort: this.isAdjacentToWater(tileId),
        },
      };
    }

    // If tile is owned by another player, initiate combat
    if (tile.ownerId && tile.ownerId !== playerId) {
      return this.initiateCombat(playerId, tileId);
    }

    // Cannot claim water tiles
    if (tile.terrainType === "water") {
      return { success: false, error: "Cannot claim water tiles" };
    }

    // Check adjacency (player must own an adjacent tile)
    if (!this.isAdjacentToPlayerTerritory(playerId, tileId)) {
      return { success: false, error: "Must expand from owned territory" };
    }

    // Check if player has enough soldiers for expansion
    const requiredGold = 0; // Gold cost for expansion
    const requiredSoldiers = 10; // Soldiers required for expansion
    if (player.gold < requiredGold) {
      return {
        success: false,
        error: `Need ${requiredGold} gold for expansion`,
      };
    }
    player.gold -= requiredGold;
    player.lastActive = Date.now();

    tile.ownerId = playerId;
    tile.population = requiredSoldiers; // Soldiers become population on new tile

    return { success: true };
  }

  adjustWorkerRatio(playerId: string, ratio: number): ActionResult {
    const player = this.players.get(playerId);

    if (!player) {
      return { success: false, error: "Player not found" };
    }

    if (ratio < 0 || ratio > 1) {
      return { success: false, error: "Ratio must be between 0 and 1" };
    }

    player.workerRatio = ratio;
    player.lastActive = Date.now();

    return { success: true };
  }

  private isAdjacentToWater(tileId: number): boolean {
    const adjacentTileIds = this.adjacencyMap.get(tileId) || [];

    return adjacentTileIds.some((adjTileId) => {
      const adjTile = this.tiles.get(adjTileId);
      return adjTile && adjTile.terrainType === "water";
    });
  }

  buildStructure(
    playerId: string,
    tileId: number,
    structureType: "city" | "port" | "missile_silo",
  ): ActionResult {
    const player = this.players.get(playerId);
    const tile = this.tiles.get(tileId);

    if (!player) {
      return { success: false, error: "Player not found" };
    }

    if (!tile) {
      return { success: false, error: "Tile not found" };
    }

    // Check if player owns this tile
    if (tile.ownerId !== playerId) {
      return { success: false, error: "You do not own this tile" };
    }

    // Check if player has enough gold
    const buildingCost = 100;
    if (player.gold < buildingCost) {
      return { success: false, error: `Need ${buildingCost} gold` };
    }

    // Check structure-specific requirements
    if (structureType === "port" && !this.isAdjacentToWater(tileId)) {
      return { success: false, error: "Port must be adjacent to water" };
    }

    // Check if tile already has a structure
    if (tile.structureType) {
      return { success: false, error: "Tile already has a structure" };
    }

    // Build the structure
    player.gold -= buildingCost;
    player.lastActive = Date.now();
    tile.structureType = structureType;

    return { success: true, data: { tile } };
  }

  private isAdjacentToPlayerTerritory(
    playerId: string,
    tileId: number,
  ): boolean {
    // For the first tile (spawn), always allow
    const playerTiles = Array.from(this.tiles.values()).filter(
      (tile) => tile.ownerId === playerId,
    );

    if (playerTiles.length === 0) {
      return true; // First tile
    }

    // For now, allow expansion to any tile (simplified adjacency)
    // In a real implementation, this would check actual geodesic adjacency
    return true;
  }

  update() {
    const now = Date.now();
    const deltaTime = now - this.lastUpdate;
    this.lastUpdate = now;

    // Update each player's economy
    this.players.forEach((player) => {
      const ownedTiles = Array.from(this.tiles.values()).filter(
        (tile) => tile.ownerId === player.id,
      );

      // Population growth (per second, scaled by deltaTime)
      const baseGrowth = ownedTiles.length * 0.01;
      const cityBonus =
        ownedTiles.filter((tile) => tile.structureType === "city").length *
        0.05;
      const populationCapBonus =
        ownedTiles.filter((tile) => tile.structureType === "city").length * 200; // Each city adds 200 to population cap
      const maxPopulation = ownedTiles.length * 100 + populationCapBonus; // Base cap + city bonus

      const populationGrowth = (baseGrowth + cityBonus) * (deltaTime / 1000);

      // Apply population growth, but cap it
      player.population = Math.min(
        player.population + populationGrowth,
        maxPopulation,
      );

      // Gold generation from workers
      const workers = player.population * (1 - player.workerRatio);
      const goldPerSecond = workers * 0.1;
      const goldGrowth = goldPerSecond * (deltaTime / 1000);

      player.gold += goldGrowth;

      // Distribute population to tiles
      if (ownedTiles.length > 0) {
        const populationPerTile = player.population / ownedTiles.length;
        ownedTiles.forEach((tile) => {
          tile.population = populationPerTile;
        });
      }
    });

    // Automatic territory expansion every 0.4 seconds
    if (now - this.lastExpansionTime >= 400) {
      this.performAutomaticExpansion();
      this.lastExpansionTime = now;
    }

    // Remove inactive players (30 minutes of inactivity)
    const inactivityThreshold = 30 * 60 * 1000;
    this.players.forEach((player, playerId) => {
      if (now - player.lastActive > inactivityThreshold) {
        console.log(`Removing inactive player: ${player.username}`);
        this.removePlayer(playerId);
      }
    });
  }

  private performAutomaticExpansion() {
    this.players.forEach((player) => {
      const ownedTiles = Array.from(this.tiles.values()).filter(
        (tile) => tile.ownerId === player.id,
      );

      // Find all adjacent land tiles that can be expanded to
      const expansionCandidates: number[] = [];

      ownedTiles.forEach((ownedTile) => {
        const adjacentTileIds = this.adjacencyMap.get(ownedTile.id) || [];

        adjacentTileIds.forEach((tileId) => {
          const tile = this.tiles.get(tileId);
          if (
            tile &&
            !tile.ownerId &&
            tile.terrainType !== "water" &&
            !expansionCandidates.includes(tileId)
          ) {
            expansionCandidates.push(tileId);
          }
        });
      });

      // Automatically expand to one random candidate if any exist
      if (expansionCandidates.length > 0) {
        const randomTileId =
          expansionCandidates[
            Math.floor(Math.random() * expansionCandidates.length)
          ];
        const tile = this.tiles.get(randomTileId);

        if (tile) {
          tile.ownerId = player.id;
          tile.population = 5; // Small population for automatic expansion
          console.log(
            `Player ${player.username} automatically expanded to tile ${randomTileId} (${tile.terrainType})`,
          );
        }
      }
    });
  }

  // Getters
  getPlayers(): Map<string, Player> {
    return this.players;
  }

  getTiles(): Map<number, GameTile> {
    return this.tiles;
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  getTile(tileId: number): GameTile | undefined {
    return this.tiles.get(tileId);
  }

  getMissiles(): Map<string, Missile> {
    return this.missiles;
  }

  getGameTime(): number {
    return Date.now() - this.gameStartTime;
  }

  launchMissile(
    playerId: string,
    fromTileId: number,
    toTileId: number,
  ): ActionResult {
    const player = this.players.get(playerId);
    const fromTile = this.tiles.get(fromTileId);
    const toTile = this.tiles.get(toTileId);

    if (!player) {
      return { success: false, error: "Player not found" };
    }

    if (!fromTile || !toTile) {
      return { success: false, error: "Tile not found" };
    }

    const missileCost = 200; // Gold cost for missile
    if (player.gold < missileCost) {
      return {
        success: false,
        error: `Need ${missileCost} gold to launch missile`,
      };
    }
    player.gold -= missileCost;

    // Generate missile trajectory along sphere surface
    const fromTileData = this.tileData.find((t) => t.id === fromTileId);
    const toTileData = this.tileData.find((t) => t.id === toTileId);

    if (!fromTileData || !toTileData) {
      return { success: false, error: "Tile data not found" };
    }

    const trajectory = this.calculateSphericalTrajectory(
      fromTileData.center,
      toTileData.center,
    );
    const travelTime = 3000; // 3 seconds travel time

    const missile: Missile = {
      id: `missile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromTileId,
      toTileId,
      playerId,
      launchTime: Date.now(),
      travelTime,
      trajectory,
    };

    this.missiles.set(missile.id, missile);

    return { success: true, data: { missile } };
  }

  impactMissile(missileId: string): ActionResult {
    const missile = this.missiles.get(missileId);

    if (!missile) {
      return { success: false, error: "Missile not found" };
    }

    const targetTile = this.tiles.get(missile.toTileId);
    if (!targetTile) {
      return { success: false, error: "Target tile not found" };
    }

    // Apply nuclear blast effects
    const blastRadiusTiles = this.getTilesInRadius(missile.toTileId, 2); // 2-tile radius for nuke
    blastRadiusTiles.forEach((tileId) => {
      const affectedTile = this.tiles.get(tileId);
      if (affectedTile) {
        // Damage units
        affectedTile.population = Math.floor(affectedTile.population * 0.2); // 80% population loss
        // Remove structures
        affectedTile.structureType = undefined;
        // Mark as irradiated (for visual effect or future gameplay)
        affectedTile.isIrradiated = true;
      }
    });

    // Global warning countdown (this would be handled by the client receiving the missile_impact event)
    // For now, just log it
    console.log(
      `GLOBAL WARNING: Nuclear missile impact at tile ${missile.toTileId}!`,
    );

    // Remove missile
    this.missiles.delete(missileId);

    return { success: true, data: { tile: targetTile } };
  }

  private calculateSphericalTrajectory(
    from: [number, number, number],
    to: [number, number, number],
  ): [number, number, number][] {
    const trajectory: [number, number, number][] = [];
    const steps = 20; // Number of points along the trajectory

    // Convert to unit vectors
    const fromVec = [from[0], from[1], from[2]];
    const toVec = [to[0], to[1], to[2]];

    // Calculate the great circle path on the sphere
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;

      // Spherical linear interpolation (slerp)
      const dot =
        fromVec[0] * toVec[0] + fromVec[1] * toVec[1] + fromVec[2] * toVec[2];
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

      if (angle < 0.001) {
        // Vectors are very close, use linear interpolation
        trajectory.push([
          fromVec[0] + t * (toVec[0] - fromVec[0]),
          fromVec[1] + t * (toVec[1] - fromVec[1]),
          fromVec[2] + t * (toVec[2] - fromVec[2]),
        ]);
      } else {
        const sinAngle = Math.sin(angle);
        const a = Math.sin((1 - t) * angle) / sinAngle;
        const b = Math.sin(t * angle) / sinAngle;

        // Add height for ballistic trajectory
        const height = Math.sin(t * Math.PI) * 0.3; // Peak at middle of trajectory
        const radius = 1.0 + height; // Base radius plus height

        const x = (a * fromVec[0] + b * toVec[0]) * radius;
        const y = (a * fromVec[1] + b * toVec[1]) * radius;
        const z = (a * fromVec[2] + b * toVec[2]) * radius;

        trajectory.push([x, y, z]);
      }
    }

    return trajectory;
  }

  private initiateCombat(
    attackingPlayerId: string,
    targetTileId: number,
  ): ActionResult {
    const attackingPlayer = this.players.get(attackingPlayerId);
    const targetTile = this.tiles.get(targetTileId);

    if (!attackingPlayer || !targetTile) {
      return {
        success: false,
        error: "Combat error: Player or tile not found",
      };
    }

    const defendingPlayer = this.players.get(targetTile.ownerId!); // Defending player must exist if tile is owned
    if (!defendingPlayer) {
      return {
        success: false,
        error: "Combat error: Defending player not found",
      };
    }

    // Get attacking and defending forces (soldiers)
    const attackingSoldiers = Math.floor(
      attackingPlayer.population * (1 - attackingPlayer.workerRatio),
    );
    const defendingSoldiers = Math.floor(
      targetTile.population * (1 - defendingPlayer.workerRatio),
    );

    // Simple combat resolution: higher soldier count wins, or a percentage of population is lost
    if (attackingSoldiers > defendingSoldiers) {
      // Attacker wins: defender loses tile and some population
      targetTile.ownerId = attackingPlayerId;
      targetTile.population = attackingSoldiers - defendingSoldiers; // Remaining attacking soldiers take over
      defendingPlayer.population = Math.max(
        0,
        defendingPlayer.population - defendingSoldiers,
      ); // Defending player loses soldiers
      attackingPlayer.population = Math.max(
        0,
        attackingPlayer.population - defendingSoldiers,
      ); // Attacking player loses soldiers
      return {
        success: true,
        data: {
          message: `Player ${attackingPlayer.username} captured tile ${targetTileId} from ${defendingPlayer.username}`,
        },
      };
    } else if (defendingSoldiers > attackingSoldiers) {
      // Defender wins: attacker loses some population
      attackingPlayer.population = Math.max(
        0,
        attackingPlayer.population - attackingSoldiers,
      ); // Attacking player loses all attacking soldiers
      targetTile.population = defendingSoldiers - attackingSoldiers; // Remaining defending soldiers
      return {
        success: false,
        error: `Player ${defendingPlayer.username} defended tile ${targetTileId} against ${attackingPlayer.username}`,
      };
    } else {
      // Draw: both lose all attacking/defending soldiers
      attackingPlayer.population = Math.max(
        0,
        attackingPlayer.population - attackingSoldiers,
      );
      targetTile.population = 0; // All defending soldiers lost
      targetTile.ownerId = undefined; // Tile becomes neutral
      return {
        success: true,
        data: {
          message: `Combat on tile ${targetTileId} was a draw. Tile is now neutral.`,
        },
      };
    }
  }

  private getTilesInRadius(centerTileId: number, radius: number): number[] {
    const tilesInRadius: Set<number> = new Set();
    const queue: { tileId: number; distance: number }[] = [
      { tileId: centerTileId, distance: 0 },
    ];
    const visited: Set<number> = new Set();

    while (queue.length > 0) {
      const { tileId, distance } = queue.shift()!;

      if (visited.has(tileId)) continue;
      visited.add(tileId);

      if (distance <= radius) {
        tilesInRadius.add(tileId);
        const adjacent = this.adjacencyMap.get(tileId) || [];
        for (const adjTileId of adjacent) {
          if (!visited.has(adjTileId)) {
            queue.push({ tileId: adjTileId, distance: distance + 1 });
          }
        }
      }
    }
    return Array.from(tilesInRadius);
  }

  createAlliance(
    playerId: string,
    name: string,
    isPublic: boolean,
  ): ActionResult {
    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, error: "Player not found" };
    }
    if (player.allianceId) {
      return { success: false, error: "Player is already in an alliance" };
    }
    const allianceId = `alliance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const alliance: Alliance = {
      id: allianceId,
      name,
      leaderId: playerId,
      memberIds: [playerId],
      isPublic,
    };
    this.alliances.set(allianceId, alliance);
    player.allianceId = allianceId;
    return { success: true, data: { alliance } };
  }

  joinAlliance(playerId: string, allianceId: string): ActionResult {
    const player = this.players.get(playerId);
    const alliance = this.alliances.get(allianceId);
    if (!player) {
      return { success: false, error: "Player not found" };
    }
    if (!alliance) {
      return { success: false, error: "Alliance not found" };
    }
    if (player.allianceId) {
      return { success: false, error: "Player is already in an alliance" };
    }
    if (!alliance.isPublic) {
      return { success: false, error: "Alliance is private" };
    }
    alliance.memberIds.push(playerId);
    player.allianceId = allianceId;
    return { success: true, data: { alliance } };
  }

  leaveAlliance(playerId: string): ActionResult {
    const player = this.players.get(playerId);
    if (!player || !player.allianceId) {
      return { success: false, error: "Player not in an alliance" };
    }
    const alliance = this.alliances.get(player.allianceId);
    if (!alliance) {
      return { success: false, error: "Alliance not found" };
    }

    alliance.memberIds = alliance.memberIds.filter((id) => id !== playerId);
    player.allianceId = undefined;

    // If the leader leaves, assign a new leader or disband the alliance
    if (alliance.leaderId === playerId) {
      if (alliance.memberIds.length > 0) {
        alliance.leaderId = alliance.memberIds[0]; // Assign first member as new leader
      } else {
        this.alliances.delete(alliance.id); // Disband if no members left
      }
    }
    return { success: true, data: { alliance } };
  }

  kickFromAlliance(leaderId: string, memberId: string): ActionResult {
    const leader = this.players.get(leaderId);
    const member = this.players.get(memberId);
    if (!leader || !member) {
      return { success: false, error: "Player not found" };
    }
    if (!leader.allianceId || leader.allianceId !== member.allianceId) {
      return {
        success: false,
        error: "Leader and member are not in the same alliance",
      };
    }
    const alliance = this.alliances.get(leader.allianceId);
    if (!alliance) {
      return { success: false, error: "Alliance not found" };
    }
    if (alliance.leaderId !== leaderId) {
      return {
        success: false,
        error: "Only the alliance leader can kick members",
      };
    }

    alliance.memberIds = alliance.memberIds.filter((id) => id !== memberId);
    member.allianceId = undefined;
    return { success: true, data: { alliance } };
  }
}
