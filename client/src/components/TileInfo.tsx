import { useGameState } from "../lib/stores/useGameState";
import { TileData } from "../lib/geometry/GlobeGeometry";

interface TileInfoProps {
  tile: TileData;
}

const TileInfo = ({ tile }: TileInfoProps) => {
  const { tiles, players, currentPlayer } = useGameState();
  
  const gameStateTile = tiles.get(tile.id);
  const owner = gameStateTile?.ownerId ? players.get(gameStateTile.ownerId) : null;
  
  const canExpand = currentPlayer && 
    (!gameStateTile?.ownerId || gameStateTile.ownerId === currentPlayer.id) &&
    currentPlayer.gold >= 100; // Base expansion cost

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      right: '10px',
      transform: 'translateY(-50%)',
      background: 'rgba(0, 0, 0, 0.9)',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      minWidth: '200px',
      border: '1px solid rgba(255, 255, 255, 0.2)'
    }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
        Tile #{tile.id}
      </h3>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>Type:</strong> {tile.type}
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>Position:</strong> ({tile.lat.toFixed(2)}°, {tile.lon.toFixed(2)}°)
      </div>
      
      {owner ? (
        <div style={{ marginBottom: '8px' }}>
          <strong>Owner:</strong> 
          <span style={{ color: owner.color, marginLeft: '5px' }}>
            {owner.username}
          </span>
        </div>
      ) : (
        <div style={{ marginBottom: '8px', color: '#888' }}>
          <strong>Status:</strong> Unclaimed
        </div>
      )}
      
      {gameStateTile?.hasCity && (
        <div style={{ marginBottom: '8px', color: '#FFD700' }}>
          🏙️ <strong>City</strong> - +Population Growth
        </div>
      )}
      
      {gameStateTile?.hasPort && (
        <div style={{ marginBottom: '8px', color: '#87CEEB' }}>
          🚢 <strong>Port</strong> - Naval Operations
        </div>
      )}
      
      {gameStateTile?.population && gameStateTile.population > 0 && (
        <div style={{ marginBottom: '8px' }}>
          👥 <strong>Population:</strong> {gameStateTile.population.toFixed(0)}
        </div>
      )}
      
      {canExpand && !owner && (
        <div style={{ 
          marginTop: '10px', 
          padding: '8px', 
          background: 'rgba(76, 175, 80, 0.2)',
          borderRadius: '4px',
          border: '1px solid #4CAF50'
        }}>
          💰 Cost: 100 Gold
          <br />
          <small>Click to expand territory</small>
        </div>
      )}
      
      {!canExpand && !owner && currentPlayer && currentPlayer.gold < 100 && (
        <div style={{ 
          marginTop: '10px', 
          padding: '8px', 
          background: 'rgba(244, 67, 54, 0.2)',
          borderRadius: '4px',
          border: '1px solid #f44336'
        }}>
          <small>Need 100 gold to expand</small>
        </div>
      )}
    </div>
  );
};

export default TileInfo;
