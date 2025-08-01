import { TileData } from "../geometry/GlobeGeometry";

export function getTerrainType(lat: number, lon: number): string {
  // Simple terrain generation based on latitude and some noise
  const absLat = Math.abs(lat);
  
  // Polar regions
  if (absLat > 70) {
    return 'ice';
  }
  
  // Desert band around equator with some variance
  if (absLat < 30 && Math.sin(lon * Math.PI / 180) > 0.3) {
    return 'desert';
  }
  
  // Mountain ranges (simplified)
  if (Math.sin(lat * Math.PI / 90) * Math.cos(lon * Math.PI / 90) > 0.7) {
    return 'mountain';
  }
  
  // Forest in temperate regions
  if (absLat > 30 && absLat < 60) {
    return 'forest';
  }
  
  // Default grassland
  return 'grassland';
}

export function isWaterTile(lat: number, lon: number): boolean {
  // Simple ocean detection - could be enhanced with actual geography
  // For now, use a simple pattern
  const noise = Math.sin(lat * 0.1) * Math.cos(lon * 0.1);
  return noise < -0.3;
}

export function canBuildPort(tile: TileData): boolean {
  // Port can be built on coastal tiles
  // This would need to check adjacent tiles for water in a real implementation
  return Math.abs(tile.lat) < 80; // Not in polar regions
}

export function canBuildCity(tile: TileData): boolean {
  // Cities can be built on most land tiles
  const terrain = getTerrainType(tile.lat, tile.lon);
  return !isWaterTile(tile.lat, tile.lon) && terrain !== 'ice';
}

export function getExpansionCost(fromTileId: number, toTileId: number): number {
  // Base cost is 100 gold
  // Could add distance-based costs or terrain modifiers
  return 100;
}

export function isAdjacent(tile1: TileData, tile2: TileData): boolean {
  // Check if two tiles share any vertices (simplified adjacency check)
  const threshold = 0.1; // Tolerance for floating point comparison
  
  for (const v1 of tile1.vertices) {
    for (const v2 of tile2.vertices) {
      if (v1.distanceTo(v2) < threshold) {
        return true;
      }
    }
  }
  
  return false;
}

export function findSafeSpawnZone(tiles: TileData[]): TileData | null {
  // Find a tile in polar regions or low-density areas for spawning
  const safeTiles = tiles.filter(tile => {
    const absLat = Math.abs(tile.lat);
    const terrain = getTerrainType(tile.lat, tile.lon);
    
    // Prefer polar regions or remote areas
    return (absLat > 60 || (absLat < 30 && Math.abs(tile.lon) > 120)) &&
           !isWaterTile(tile.lat, tile.lon) &&
           terrain !== 'ice';
  });
  
  if (safeTiles.length === 0) {
    // Fallback to any land tile
    return tiles.find(tile => !isWaterTile(tile.lat, tile.lon)) || tiles[0];
  }
  
  return safeTiles[Math.floor(Math.random() * safeTiles.length)];
}
