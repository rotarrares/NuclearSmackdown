import { useRef, useMemo, useState, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GlobeGeometry } from "../lib/geometry/GlobeGeometry";
import { useGameState } from "../lib/stores/useGameState";
import { useMultiplayer } from "../lib/stores/useMultiplayer";
import { Tile, Player } from "../lib/types/game";

const Globe = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const borderRef = useRef<THREE.LineSegments>(null);
  const { camera, raycaster, pointer } = useThree();
  
  const { tiles, players, currentPlayer, hoveredTile, setHoveredTile } = useGameState();
  const { selectTile, buildStructure } = useMultiplayer();
  
  const [isHovering, setIsHovering] = useState(false);


  // Generate globe geometry once
  const { geometry, borderGeometry, tileData } = useMemo(() => {
    const globeGeom = new GlobeGeometry();
    return {
      geometry: globeGeom.getGeometry(),
      borderGeometry: globeGeom.getBorderGeometry(),
      tileData: globeGeom.getTileData()
    };
  }, []);

  // Create color attribute for tiles based on ownership
  const colorAttribute = useMemo(() => {
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    
    tileData.forEach((tile, index) => {
      const gameStateTile = tiles.get(tile.id);
      let color = new THREE.Color(0x2a4a3a); // Default
      
      if (gameStateTile?.ownerId) {
        // Owned territory - use player color
        const owner = players.get(gameStateTile.ownerId);
        if (owner) {
          color = new THREE.Color(owner.color);
        }
      } else {
        // Unowned territory - use terrain color
        switch (tile.terrainType) {
          case 'water':
            color = new THREE.Color(0x1e40af); // Blue
            break;
          case 'grass':
            color = new THREE.Color(0x22c55e); // Green
            break;
          case 'desert':
            color = new THREE.Color(0xfbbf24); // Sand yellow
            break;
          case 'mountain':
            color = new THREE.Color(0x6b7280); // Gray
            break;
          default:
            color = new THREE.Color(0x2a4a3a); // Fallback
        }
      }
      
      // Color all vertices of this tile
      for (let i = 0; i < tile.vertices.length; i++) {
        const vertexIndex = tile.startVertex + i;
        colors[vertexIndex * 3] = color.r;
        colors[vertexIndex * 3 + 1] = color.g;
        colors[vertexIndex * 3 + 2] = color.b;
      }
    });
    
    return new THREE.BufferAttribute(colors, 3);
  }, [tiles, players, tileData, geometry]);

  // Update colors when game state changes
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.geometry.setAttribute('color', colorAttribute);
      meshRef.current.geometry.attributes.color.needsUpdate = true;
    }
  });

  // Handle mouse interactions
  const handlePointerMove = useCallback((event: any) => {
    if (!meshRef.current) return;
    
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(meshRef.current);
    
    if (intersects.length > 0) {
      const intersect = intersects[0];
      const faceIndex = intersect.faceIndex;
      
      if (faceIndex !== undefined && faceIndex !== null) {
        // Find which tile this face belongs to
        const tile = tileData.find(t => 
          faceIndex >= t.startFace && faceIndex < t.startFace + t.faceCount
        );
        
        if (tile && tile.id !== hoveredTile?.id) {
          setHoveredTile(tile);
          setIsHovering(true);
        }
      }
    } else {
      setHoveredTile(null);
      setIsHovering(false);
    }
  }, [camera, raycaster, pointer, tileData, hoveredTile, setHoveredTile]);

  const handleClick = useCallback(() => {
    if (hoveredTile && currentPlayer) {
      const gameStateTile = tiles.get(hoveredTile.id);
      
      // If tile is unowned or we want to expand, try to claim it
      if (!gameStateTile?.ownerId) {
        selectTile(hoveredTile.id);
      } else if (gameStateTile.ownerId === currentPlayer.id) {
        // Show building options for owned tiles - use game state store
        useGameState.getState().setBuildingOptions({
          tileId: hoveredTile.id,
          canBuildPort: true, // Will be determined by server
          position: { x: window.innerWidth / 2, y: window.innerHeight / 2 }
        });
      } else {
        console.log("Clicked enemy tile:", hoveredTile.id);
      }
    }
  }, [hoveredTile, currentPlayer, tiles, selectTile]);

  return (
    <group>
      {/* Main globe mesh with all tiles */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        onPointerMove={handlePointerMove}
        onClick={handleClick}
        onPointerLeave={() => {
          setHoveredTile(null);
          setIsHovering(false);
        }}
      >
        <meshBasicMaterial 
          vertexColors={true}
          side={THREE.DoubleSide}
        />
      </mesh>

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
          <sphereGeometry args={[0.01, 8, 8]} />
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
