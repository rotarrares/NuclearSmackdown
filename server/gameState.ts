import { Player, GameTile } from '../client/src/lib/types/game';
import { GlobeGeometry, TileData } from '../client/src/lib/geometry/GlobeGeometry';

interface ActionResult {
  success: boolean;
  error?: string;
}

export class GameState {
  private players: Map<string, Player> = new Map();
  private tiles: Map<number, GameTile> = new Map();
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
    this.tileData.forEach(tileData => {
      const tile: GameTile = {
        id: tileData.id,
        hasCity: false,
        hasPort: false,
        population: 0,
        terrainType: tileData.terrainType
      };
      this.tiles.set(tileData.id, tile);
    });
    
    console.log(`Initialized ${this.tiles.size} tiles`);
  }

  private buildAdjacencyMap() {
    // Build true geometric adjacency using 3D positions
    const neighborThreshold = 0.08; // Smaller threshold for immediate neighbors only
    
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
    
    console.log(`Built adjacency map with average ${Array.from(this.adjacencyMap.values()).reduce((sum, adj) => sum + adj.length, 0) / this.adjacencyMap.size} neighbors per tile`);
  }

  private getRandomTerrain(): 'water' | 'grass' | 'desert' | 'mountain' {
    // Generate terrain: water 65%, grass 20%, desert 10%, mountain 5%
    const rand = Math.random();
    if (rand < 0.65) return 'water';
    if (rand < 0.85) return 'grass';
    if (rand < 0.95) return 'desert';
    return 'mountain';
  }

  spawnPlayer(username: string): Player {
    const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Find a safe spawn tile
    const spawnTileId = this.findSafeSpawnTile();
    
    // Generate random color
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    const player: Player = {
      id: playerId,
      username,
      color,
      gold: 1000,
      population: 100,
      workerRatio: 0.5,
      spawnTileId,
      joinedAt: Date.now(),
      lastActive: Date.now()
    };
    
    this.players.set(playerId, player);
    
    // Claim spawn tile
    const spawnTile = this.tiles.get(spawnTileId);
    if (spawnTile) {
      spawnTile.ownerId = playerId;
      spawnTile.population = 50; // Initial population on spawn tile
    }
    
    return player;
  }

  private findSafeSpawnTile(): number {
    // Find an unclaimed tile that's not water
    const availableTiles = Array.from(this.tiles.entries())
      .filter(([id, tile]) => !tile.ownerId && tile.terrainType !== 'water')
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
    this.tiles.forEach(tile => {
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
      return { success: false, error: 'Player not found' };
    }
    
    if (!tile) {
      return { success: false, error: 'Tile not found' };
    }
    
    // Check if tile is already owned
    if (tile.ownerId) {
      if (tile.ownerId === playerId) {
        return { success: false, error: 'Already own this tile' };
      } else {
        return { success: false, error: 'Tile owned by another player' };
      }
    }
    
    // Cannot claim water tiles
    if (tile.terrainType === 'water') {
      return { success: false, error: 'Cannot claim water tiles' };
    }
    
    // Check if player can afford expansion
    const expansionCost = this.getExpansionCost(playerId, tileId);
    if (player.gold < expansionCost) {
      return { success: false, error: `Need ${expansionCost} gold` };
    }
    
    // Check adjacency (player must own an adjacent tile)
    if (!this.isAdjacentToPlayerTerritory(playerId, tileId)) {
      return { success: false, error: 'Must expand from owned territory' };
    }
    
    // Perform expansion
    player.gold -= expansionCost;
    player.lastActive = Date.now();
    
    tile.ownerId = playerId;
    tile.population = 10; // Base population when claiming
    
    return { success: true };
  }

  adjustWorkerRatio(playerId: string, ratio: number): ActionResult {
    const player = this.players.get(playerId);
    
    if (!player) {
      return { success: false, error: 'Player not found' };
    }
    
    if (ratio < 0 || ratio > 1) {
      return { success: false, error: 'Ratio must be between 0 and 1' };
    }
    
    player.workerRatio = ratio;
    player.lastActive = Date.now();
    
    return { success: true };
  }

  private getExpansionCost(playerId: string, tileId: number): number {
    // Base cost
    let cost = 100;
    
    // Increase cost based on how much territory player already owns
    const ownedTiles = Array.from(this.tiles.values())
      .filter(tile => tile.ownerId === playerId).length;
    
    cost += ownedTiles * 10; // Each additional tile costs 10 more gold
    
    return cost;
  }

  private isAdjacentToPlayerTerritory(playerId: string, tileId: number): boolean {
    // For the first tile (spawn), always allow
    const playerTiles = Array.from(this.tiles.values())
      .filter(tile => tile.ownerId === playerId);
    
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
    this.players.forEach(player => {
      const ownedTiles = Array.from(this.tiles.values())
        .filter(tile => tile.ownerId === player.id);
      
      // Population growth (per second, scaled by deltaTime)
      const baseGrowth = ownedTiles.length * 0.01;
      const cityBonus = ownedTiles.filter(tile => tile.hasCity).length * 0.05;
      const populationGrowth = (baseGrowth + cityBonus) * (deltaTime / 1000);
      
      // Gold generation from workers
      const workers = player.population * (1 - player.workerRatio);
      const goldPerSecond = workers * 0.1;
      const goldGrowth = goldPerSecond * (deltaTime / 1000);
      
      // Update player
      player.population += populationGrowth;
      player.gold += goldGrowth;
      
      // Distribute population to tiles
      if (ownedTiles.length > 0) {
        const populationPerTile = player.population / ownedTiles.length;
        ownedTiles.forEach(tile => {
          tile.population = populationPerTile;
        });
      }
    });
    
    // Automatic territory expansion every second
    if (now - this.lastExpansionTime >= 1000) {
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
    this.players.forEach(player => {
      const ownedTiles = Array.from(this.tiles.values())
        .filter(tile => tile.ownerId === player.id);
      
      // Find all adjacent land tiles that can be expanded to
      const expansionCandidates: number[] = [];
      
      ownedTiles.forEach(ownedTile => {
        const adjacentTileIds = this.adjacencyMap.get(ownedTile.id) || [];
        
        adjacentTileIds.forEach(tileId => {
          const tile = this.tiles.get(tileId);
          if (tile && 
              !tile.ownerId && 
              tile.terrainType !== 'water' && 
              !expansionCandidates.includes(tileId)) {
            expansionCandidates.push(tileId);
          }
        });
      });
      
      // Automatically expand to one random candidate if any exist
      if (expansionCandidates.length > 0) {
        const randomTileId = expansionCandidates[Math.floor(Math.random() * expansionCandidates.length)];
        const tile = this.tiles.get(randomTileId);
        
        if (tile) {
          tile.ownerId = player.id;
          tile.population = 5; // Small population for automatic expansion
          console.log(`Player ${player.username} automatically expanded to tile ${randomTileId} (${tile.terrainType})`);
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

  getGameTime(): number {
    return Date.now() - this.gameStartTime;
  }
}
