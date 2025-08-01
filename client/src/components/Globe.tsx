import { useRef, useMemo, useState, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GlobeGeometry } from "../lib/geometry/GlobeGeometry";
import { useGameState } from "../lib/stores/useGameState";
import { useMultiplayer } from "../lib/stores/useMultiplayer";
import { Tile, Player } from "../lib/types/game";

// Individual tile component for better interaction
const TileComponent = ({ tile, gameStateTile, players, onHover, onClick }: any) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Create triangle geometry for this tile
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(9); // 3 vertices * 3 components
    
    tile.vertices.forEach((vertex: THREE.Vector3, index: number) => {
      positions[index * 3] = vertex.x;
      positions[index * 3 + 1] = vertex.y;
      positions[index * 3 + 2] = vertex.z;
    });
    
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setIndex([0, 1, 2]);
    geom.computeVertexNormals();
    return geom;
  }, [tile]);
  
  // Determine tile color
  const color = useMemo(() => {
    if (gameStateTile?.ownerId) {
      const owner = players.get(gameStateTile.ownerId);
      return owner ? owner.color : '#2a4a3a';
    }
    return '#2a4a3a'; // Default green
  }, [gameStateTile, players]);
  
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(tile);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(tile);
      }}
    >
      <meshBasicMaterial color={color} side={THREE.DoubleSide} />
    </mesh>
  );
};

const Globe = () => {
  const borderRef = useRef<THREE.LineSegments>(null);
  
  const { tiles, players, currentPlayer, hoveredTile, setHoveredTile } = useGameState();
  const { selectTile } = useMultiplayer();
  
  const [isHovering, setIsHovering] = useState(false);

  // Generate globe geometry once
  const { borderGeometry, tileData } = useMemo(() => {
    const globeGeom = new GlobeGeometry();
    return {
      borderGeometry: globeGeom.getBorderGeometry(),
      tileData: globeGeom.getTileData()
    };
  }, []);

  const handleTileHover = useCallback((tile: any) => {
    setHoveredTile(tile);
    setIsHovering(true);
  }, [setHoveredTile]);

  const handleTileClick = useCallback((tile: any) => {
    if (currentPlayer) {
      const gameStateTile = tiles.get(tile.id);
      
      // If tile is unowned or we want to expand, try to claim it
      if (!gameStateTile?.ownerId) {
        selectTile(tile.id);
      } else if (gameStateTile.ownerId === currentPlayer.id) {
        console.log("Clicked owned tile:", tile.id);
      } else {
        console.log("Clicked enemy tile:", tile.id);
      }
    }
  }, [currentPlayer, tiles, selectTile]);

  return (
    <group
      onPointerLeave={() => {
        setHoveredTile(null);
        setIsHovering(false);
      }}
    >
      {/* Render each tile as a separate mesh for better interaction */}
      {tileData.map((tile) => {
        const gameStateTile = tiles.get(tile.id);
        return (
          <TileComponent
            key={tile.id}
            tile={tile}
            gameStateTile={gameStateTile}
            players={players}
            onHover={handleTileHover}
            onClick={handleTileClick}
          />
        );
      })}

      {/* Tile borders */}
      <lineSegments
        ref={borderRef}
        geometry={borderGeometry}
      >
        <lineBasicMaterial 
          color={0xffffff} 
          transparent={true}
          opacity={0.1}
          linewidth={1}
        />
      </lineSegments>

      {/* Hover highlight */}
      {hoveredTile && (
        <mesh position={hoveredTile.center}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshBasicMaterial 
            color={0xffff00}
            transparent={true}
            opacity={0.8}
          />
        </mesh>
      )}
    </group>
  );
};

export default Globe;
