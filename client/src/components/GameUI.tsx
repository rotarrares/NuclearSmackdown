import { useGameState } from "../lib/stores/useGameState";
import { useMultiplayer } from "../lib/stores/useMultiplayer";
import TileInfo from "./TileInfo";
import Leaderboard from "./Leaderboard";

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
    adjustWorkerRatio,
    adjustTroopDeployment,
    cancelConquest
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
        
        <div style={{ marginBottom: '15px' }}>
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

        <div style={{ marginBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span>🎯 Troop Deployment</span>
            <span>{Math.floor((currentPlayer.troopDeployment || 0) * 100)}%</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '14px' }}>
            <span>🔒 Reserved: {Math.floor(currentPlayer.population * currentPlayer.workerRatio * (1 - (currentPlayer.troopDeployment || 0)))}</span>
            <span>⚔️ Deployed: {Math.floor(currentPlayer.population * currentPlayer.workerRatio * (currentPlayer.troopDeployment || 0))}</span>
          </div>
          
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={currentPlayer.troopDeployment || 0}
            onChange={(e) => adjustTroopDeployment(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '5px' }}>
            <span>Keep All</span>
            <span>Deploy All</span>
          </div>
        </div>

        {/* Conquest Status */}
        {currentPlayer.isConquering && (
          <div style={{ 
            marginBottom: '15px',
            padding: '10px',
            backgroundColor: 'rgba(255, 165, 0, 0.2)',
            border: '1px solid #ffa500',
            borderRadius: '5px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>⚔️ Conquering Territory</span>
              <button
                onClick={() => cancelConquest()}
                style={{
                  background: '#ff4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: '14px', marginTop: '5px' }}>
              Troops: {currentPlayer.conquestTroops || 0}
            </div>
          </div>
        )}

        <div style={{ fontSize: '12px', opacity: 0.8 }}>
          <div>💰 Gold/sec: +{(currentPlayer.population * (1 - currentPlayer.workerRatio) * 0.1).toFixed(1)}</div>
          <div>👥 Pop Growth: +{(ownedTiles * 0.01).toFixed(2)}/sec</div>
          <div>🎯 Available for combat: {Math.floor(currentPlayer.population * currentPlayer.workerRatio * (currentPlayer.troopDeployment || 0))}</div>
        </div>
      </div>

      {/* Tile Information Panel */}
      {hoveredTile && <TileInfo tile={hoveredTile} />}

      {/* Leaderboard */}
      <Leaderboard />

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
        <div>🎯 Click unclaimed tiles to conquer</div>
        <div>⚖️ Balance workers vs soldiers</div>
        <div>🎯 Set troop deployment level</div>
        <div>⚔️ Conquest uses deployed troops</div>
      </div>
    </>
  );
};

export default GameUI;
