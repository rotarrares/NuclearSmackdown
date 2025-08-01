export type GamePhase = 'waiting' | 'playing' | 'ended';

export interface Player {
  id: string;
  username: string;
  color: string;
  
  // Economy
  gold: number;
  population: number;
  workerRatio: number; // 0 = all soldiers, 1 = all workers
  
  // Territory
  spawnTileId: number;
  
  // Stats
  joinedAt: number;
  lastActive: number;
}

export interface GameTile {
  id: number;
  ownerId?: string;
  
  // Structures
  structureType?: 'city' | 'port' | 'missile_silo';
  
  // Population on this tile
  population: number;
  
  // Terrain type
  terrainType: 'water' | 'grass' | 'desert' | 'mountain';
}

export interface Tile extends GameTile {
  // Geometry data
  type: 'pentagon' | 'hexagon';
  lat: number;
  lon: number;
  center: [number, number, number];
  vertices: [number, number, number][];
}

// WebSocket message types
export interface GameMessage {
  type: string;
  data: any;
}

export interface SpawnPlayerMessage extends GameMessage {
  type: 'spawn_player';
  data: {
    username: string;
  };
}

export interface SelectTileMessage extends GameMessage {
  type: 'select_tile';
  data: {
    tileId: number;
  };
}

export interface ExpandTerritoryMessage extends GameMessage {
  type: 'expand_territory';
  data: {
    tileId: number;
  };
}

export interface AdjustWorkerRatioMessage extends GameMessage {
  type: 'adjust_worker_ratio';
  data: {
    ratio: number;
  };
}

// Server response types
export interface GameStateMessage extends GameMessage {
  type: 'game_state';
  data: {
    players: Player[];
    tiles: GameTile[];
    gameTime: number;
  };
}

export interface PlayerSpawnedMessage extends GameMessage {
  type: 'player_spawned';
  data: {
    player: Player;
  };
}

export interface TileUpdatedMessage extends GameMessage {
  type: 'tile_updated';
  data: {
    tile: GameTile;
  };
}

export interface ErrorMessage extends GameMessage {
  type: 'error';
  data: {
    message: string;
  };
}
