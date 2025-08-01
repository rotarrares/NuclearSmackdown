import { useGameState } from "../lib/stores/useGameState";
import { useMultiplayer } from "../lib/stores/useMultiplayer";
import TileInfo from "./TileInfo";

const GameUI = () => {
  const { 
    currentPlayer, 
    players, 
    hoveredTile, 
    tiles,
    gamePhase 
  } = useGameState();
  
  const { 
    isConnected, 
    spawnPlayer,
    adjustWorkerRatio 
  } = useMultiplayer();

  if (!isConnected) {
    return (
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '20px',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <h2>Connecting to OpenFront.io...</h2>
        <p>Please wait while we establish connection to the server.</p>
      </div>
    );
  }

  if (gamePhase === 'waiting' && !currentPlayer) {
    return (
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        padding: '30px',
        borderRadius: '8px',
        textAlign: 'center',
        maxWidth: '400px'
      }}>
        <h1 style={{ margin: '0 0 20px 0', fontSize: '28px' }}>🌍 OpenFront.io</h1>
        <p style={{ margin: '0 0 20px 0', fontSize: '16px' }}>
          A global strategy game where you manage population, build cities, and dominate the world.
        </p>
        <button
          onClick={spawnPlayer}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Join Game
        </button>
      </div>
    );
  }

  if (!currentPlayer) {
    return null;
  }

  const totalPlayers = players.size;
  const ownedTiles = Array.from(tiles.values()).filter(t => t.ownerId === currentPlayer.id).length;

  return (
    <>
      {/* Top Status Bar */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        right: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '8px',
        fontSize: '14px'
      }}>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div>👑 <strong>{currentPlayer.username}</strong></div>
          <div>💰 Gold: <strong>{currentPlayer.gold.toFixed(0)}</strong></div>
          <div>👥 Population: <strong>{currentPlayer.population.toFixed(0)}</strong></div>
          <div>🏠 Territory: <strong>{ownedTiles}</strong></div>
        </div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div>🌍 Players: <strong>{totalPlayers}</strong></div>
          <div style={{ 
            width: '12px', 
            height: '12px', 
            borderRadius: '50%', 
            backgroundColor: isConnected ? '#4CAF50' : '#f44336',
            display: 'inline-block'
          }} />
        </div>
      </div>

      {/* Population Management Panel */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        minWidth: '250px'
      }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Population Management</h3>
        
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span>⚔️ Soldiers: {Math.floor(currentPlayer.population * currentPlayer.workerRatio)}</span>
            <span>🔨 Workers: {Math.floor(currentPlayer.population * (1 - currentPlayer.workerRatio))}</span>
          </div>
          
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={currentPlayer.workerRatio}
            onChange={(e) => adjustWorkerRatio(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '5px' }}>
            <span>All Soldiers</span>
            <span>All Workers</span>
          </div>
        </div>

        <div style={{ fontSize: '12px', opacity: 0.8 }}>
          <div>💰 Gold/sec: +{(currentPlayer.population * (1 - currentPlayer.workerRatio) * 0.1).toFixed(1)}</div>
          <div>👥 Pop Growth: +{(ownedTiles * 0.01).toFixed(2)}/sec</div>
        </div>
      </div>

      {/* Tile Information Panel */}
      {hoveredTile && <TileInfo tile={hoveredTile} />}

      {/* Instructions */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        fontSize: '12px',
        maxWidth: '200px'
      }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Controls</h4>
        <div>🖱️ Drag to rotate globe</div>
        <div>🔍 Scroll to zoom</div>
        <div>🎯 Click tiles to expand</div>
        <div>⚖️ Balance workers vs soldiers</div>
      </div>
    </>
  );
};

export default GameUI;
