import { Player, GameTile } from '../client/src/lib/types/game';

interface ActionResult {
  success: boolean;
  error?: string;
}

export class GameState {
  private players: Map<string, Player> = new Map();
  private tiles: Map<number, GameTile> = new Map();
  private gameStartTime: number;
  private lastUpdate: number;

  constructor() {
    this.gameStartTime = Date.now();
    this.lastUpdate = Date.now();
    this.initializeTiles();
  }

  private initializeTiles() {
    // Initialize tiles (4002 tiles as per the design)
    // For now, create a simplified set - in a real implementation,
    // this would match the client-side globe generation
    for (let i = 0; i < 4002; i++) {
      const tile: GameTile = {
        id: i,
        hasCity: false,
        hasPort: false,
        population: 0,
        terrainType: this.getRandomTerrain()
      };
      this.tiles.set(i, tile);
    }
    
    console.log(`Initialized ${this.tiles.size} tiles`);
  }

  private getRandomTerrain(): 'grassland' | 'forest' | 'desert' | 'mountain' | 'water' {
    const terrains: ('grassland' | 'forest' | 'desert' | 'mountain' | 'water')[] = 
      ['grassland', 'forest', 'desert', 'mountain', 'water'];
    return terrains[Math.floor(Math.random() * terrains.length)];
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
    
    // Simplified adjacency check - in a real implementation,
    // this would use the actual geodesic tile adjacency
    // For now, just check if the tile ID is within a reasonable range
    const playerTileIds = playerTiles.map(tile => tile.id);
    const adjacentRange = 50; // Simplified adjacency
    
    return playerTileIds.some(ownedId => 
      Math.abs(ownedId - tileId) <= adjacentRange
    );
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
    
    // Remove inactive players (30 minutes of inactivity)
    const inactivityThreshold = 30 * 60 * 1000;
    this.players.forEach((player, playerId) => {
      if (now - player.lastActive > inactivityThreshold) {
        console.log(`Removing inactive player: ${player.username}`);
        this.removePlayer(playerId);
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
