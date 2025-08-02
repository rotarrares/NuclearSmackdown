import { useRef, useMemo, useState, useCallback } from "react";
import * as React from "react";

import { useFrame, useThree } from "@react-three/fiber";

import * as THREE from "three";

import { GlobeGeometry } from "../lib/geometry/GlobeGeometry";

import { useGameState } from "../lib/stores/useGameState";

import { useMultiplayer } from "../lib/stores/useMultiplayer";

import { useAudio } from "../lib/stores/useAudio";

import { Tile, Player } from "../lib/types/game";
import { Missile } from "../../../shared/schema";

// Separate component for smooth missile animation
const MissileRenderer = ({ missile, curve, validPoints }: {
  missile: Missile;
  curve: THREE.CatmullRomCurve3;
  validPoints: THREE.Vector3[];
}) => {
  const meshRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (!meshRef.current) return;
    
    // Calculate missile progress for smooth animation using frame time
    const elapsedTime = Date.now() - missile.launchTime;
    const progress = Math.min(elapsedTime / missile.travelTime, 1.0);
    
    // Get current position with smooth interpolation
    let currentPosition: THREE.Vector3;
    try {
      currentPosition = curve.getPoint(progress);
      if (!currentPosition || isNaN(currentPosition.x) || isNaN(currentPosition.y) || isNaN(currentPosition.z)) {
        // Fallback to manual interpolation
        const index = Math.floor(progress * (validPoints.length - 1));
        const nextIndex = Math.min(index + 1, validPoints.length - 1);
        const localProgress = (progress * (validPoints.length - 1)) - index;
        
        const current = validPoints[index];
        const next = validPoints[nextIndex];
        currentPosition = current.clone().lerp(next, localProgress);
      }
    } catch (error) {
      // Fallback to direct point access
      const index = Math.min(Math.floor(progress * validPoints.length), validPoints.length - 1);
      currentPosition = validPoints[index];
    }
    
    // Update warhead position smoothly
    const warhead = meshRef.current.children.find(child => child.name === 'warhead') as THREE.Mesh;
    const glow = meshRef.current.children.find(child => child.name === 'glow') as THREE.Mesh;
    
    if (warhead && currentPosition) {
      warhead.position.copy(currentPosition);
    }
    if (glow && currentPosition) {
      glow.position.copy(currentPosition);
    }
  });
  
  const elapsedTime = Date.now() - missile.launchTime;
  const progress = Math.min(elapsedTime / missile.travelTime, 1.0);
  
  return (
    <group ref={meshRef}>
      {/* Main trajectory tube - thinner */}
      <mesh>
        <tubeGeometry args={[curve, 32, 0.001, 6, false]} />
        <meshBasicMaterial
          color={0xffffff}
          transparent={true}
          opacity={0.6}
        />
      </mesh>
      
      {/* Animated missile warhead - 3 times smaller */}
      <mesh name="warhead">
        <sphereGeometry args={[0.005, 8, 8]} />
        <meshBasicMaterial color={0xff2222} />
      </mesh>
      
      {/* Reduced glow halo - 3 times smaller */}
      <mesh name="glow">
        <sphereGeometry args={[0.008, 6, 6]} />
        <meshBasicMaterial 
          color={0xff4444}
          transparent={true}
          opacity={0.2}
        />
      </mesh>
      
      {/* Launch flash effect */}
      {elapsedTime < 200 && (
        <mesh position={validPoints[0]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial 
            color={0xffffff}
            transparent={true}
            opacity={0.8}
          />
        </mesh>
      )}
      
      {/* Impact flash effect */}
      {progress >= 1.0 && elapsedTime - missile.travelTime < 500 && (
        <mesh position={validPoints[validPoints.length - 1]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial 
            color={0xff4400}
            transparent={true}
            opacity={Math.max(0, 1 - (elapsedTime - missile.travelTime) / 500)}
          />
        </mesh>
      )}
    </group>
  );
};

const Globe = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  const borderRef = useRef<THREE.LineSegments>(null);

  const { camera, raycaster, pointer } = useThree();

  const {
    tiles,
    players,
    currentPlayer,
    missiles,
    hoveredTile,
    setHoveredTile,
  } = useGameState();

  const { selectTile, buildStructure, launchMissile, startConquest } = useMultiplayer();
  const { playMissile } = useAudio();

  const [isHovering, setIsHovering] = useState(false);
  const [missilesSoundTracked, setMissilesSoundTracked] = useState(new Set<string>());
  const [lastMissileLaunch, setLastMissileLaunch] = useState(0);
  const [mouseDownPos, setMouseDownPos] = useState<{x: number, y: number} | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Generate globe geometry once

  const { geometry, borderGeometry, tileData } = useMemo(() => {
    const globeGeom = new GlobeGeometry();

    return {
      geometry: globeGeom.getGeometry(),

      borderGeometry: globeGeom.getBorderGeometry(),

      tileData: globeGeom.getTileData(),
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
          case "water":
            color = new THREE.Color(0x1e40af); // Blue

            break;

          case "grass":
            color = new THREE.Color(0x22c55e); // Green

            break;

          case "desert":
            color = new THREE.Color(0xfbbf24); // Sand yellow

            break;

          case "mountain":
            color = new THREE.Color(0x6b7280); // Gray

            break;

          default:
            color = new THREE.Color(0x2a4a3a); // Fallback
        }
      }

      if (gameStateTile?.isIrradiated) {
        color.lerp(new THREE.Color(0x00ff00), 0.5); // Blend with green for irradiated
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

  // Update colors and handle missile sounds when game state changes

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.geometry.setAttribute("color", colorAttribute);

      meshRef.current.geometry.attributes.color.needsUpdate = true;
    }
    
    // Handle missile sound effects
    const currentTime = Date.now();
    const newTrackedSounds = new Set(missilesSoundTracked);
    
    missiles.forEach((missile) => {
      const elapsedTime = currentTime - missile.launchTime;
      const progress = elapsedTime / missile.travelTime;
      
      // Play launch sound once
      if (elapsedTime < 100 && !missilesSoundTracked.has(`launch-${missile.id}`)) {
        playMissile('launch');
        newTrackedSounds.add(`launch-${missile.id}`);
      }
      
      // Play impact sound once when missile completes
      if (progress >= 1.0 && !missilesSoundTracked.has(`impact-${missile.id}`)) {
        playMissile('impact');
        newTrackedSounds.add(`impact-${missile.id}`);
      }
    });
    
    if (newTrackedSounds.size !== missilesSoundTracked.size) {
      setMissilesSoundTracked(newTrackedSounds);
    }
    
    // Clean up old missile sound tracking
    if (missiles.size === 0 && missilesSoundTracked.size > 0) {
      setMissilesSoundTracked(new Set());
    }
  });

  // Handle mouse interactions

  const handlePointerMove = useCallback(
    (event: any) => {
      if (!meshRef.current) return;

      raycaster.setFromCamera(pointer, camera);

      const intersects = raycaster.intersectObject(meshRef.current);

      if (intersects.length > 0) {
        const intersect = intersects[0];

        const faceIndex = intersect.faceIndex;

        if (faceIndex !== undefined && faceIndex !== null) {
          // Find which tile this face belongs to

          const tile = tileData.find(
            (t) =>
              faceIndex >= t.startFace && faceIndex < t.startFace + t.faceCount,
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
    },
    [camera, raycaster, pointer, tileData, hoveredTile, setHoveredTile],
  );

  const handleMouseDown = useCallback((event: any) => {
    // Only handle left mouse button
    if (event.button === 0) {
      setMouseDownPos({ x: event.clientX, y: event.clientY });
      setIsDragging(false);
    }
  }, []);

  const handleMouseMove = useCallback((event: any) => {
    if (mouseDownPos) {
      const deltaX = Math.abs(event.clientX - mouseDownPos.x);
      const deltaY = Math.abs(event.clientY - mouseDownPos.y);
      
      // If mouse moved more than 5 pixels, consider it dragging
      if (deltaX > 5 || deltaY > 5) {
        setIsDragging(true);
      }
    }
  }, [mouseDownPos]);

  const handleMouseUp = useCallback((event: any) => {
    // Only handle left mouse button
    if (event.button === 0 && mouseDownPos && !isDragging && hoveredTile && currentPlayer) {
      const gameStateTile = tiles.get(hoveredTile.id);



      // Handle different click actions based on key modifiers
      const isShiftClick = event.shiftKey;

      // SHIFT + Click = Launch Missile (if missile silos exist)
      if (isShiftClick) {
        const missileSilos = Array.from(tiles.values()).filter(
          (tile) =>
            tile.ownerId === currentPlayer.id &&
            tile.structureType === "missile_silo",
        );

        console.log(`Missile launch attempt - Found ${missileSilos.length} missile silos`);
        console.log(`Target tile: ${hoveredTile.id}, owned by: ${gameStateTile?.ownerId}, current player: ${currentPlayer.id}`);

        if (missileSilos.length > 0) {
          if (!gameStateTile?.ownerId || gameStateTile.ownerId !== currentPlayer.id) {
            // Check gold requirement (200 gold)
            if (currentPlayer.gold < 200) {
              console.log(`Insufficient gold for missile launch: ${currentPlayer.gold}/200`);
              useGameState.getState().addAlert("Need 200 gold to launch missile", "error");
              setMouseDownPos(null);
              setIsDragging(false);
              return;
            }

            // Prevent rapid-fire missile launches (1 second cooldown)
            const now = Date.now();
            if (now - lastMissileLaunch < 1000) {
              console.log("Missile launch on cooldown");
              setMouseDownPos(null);
              setIsDragging(false);
              return;
            }

            // Use the first available missile silo
            const silo = missileSilos[0];
            console.log(`Launching missile from silo at tile ${silo.id} to target ${hoveredTile.id}, player has ${currentPlayer.gold} gold`);
            launchMissile(silo.id, hoveredTile.id);
            setLastMissileLaunch(now);
          } else {
            console.log("Cannot target own territory with missiles");
            useGameState.getState().addAlert("Cannot target your own territory", "error");
          }
        } else {
          console.log("No missile silos available - build one first");
          useGameState.getState().addAlert("Build a missile silo first", "error");
        }
      } else {
        // Regular Click = Territory actions
        if (!gameStateTile?.ownerId) {
          // Unowned tile - start conquest
          startConquest(hoveredTile.id);
        } else if (gameStateTile.ownerId === currentPlayer.id) {
          // Owned tile - show building options at center of screen
          useGameState.getState().setBuildingOptions({
            tileId: hoveredTile.id,
            canBuildPort: true, // Will be determined by server
            position: { x: window.innerWidth / 2, y: window.innerHeight / 2 }
          });
        }
      }
    }
    
    setMouseDownPos(null);
    setIsDragging(false);
  }, [mouseDownPos, isDragging, hoveredTile, currentPlayer, tiles, launchMissile, lastMissileLaunch, startConquest]);

  return (
    <group>
      {/* Main globe mesh with all tiles */}

      <mesh
        ref={meshRef}
        geometry={geometry}
        onPointerMove={(e) => {
          handlePointerMove(e);
          handleMouseMove(e);
        }}
        onPointerDown={handleMouseDown}
        onPointerUp={handleMouseUp}
        onPointerLeave={() => {
          setHoveredTile(null);
          setIsHovering(false);
          setMouseDownPos(null);
          setIsDragging(false);
        }}
      >
        <meshBasicMaterial vertexColors={true} side={THREE.DoubleSide} />
      </mesh>

      {/* Tile borders */}

      <lineSegments ref={borderRef} geometry={borderGeometry}>
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

      {/* Building indicators */}

      {tileData.map((tile) => {
        const gameStateTile = tiles.get(tile.id);

        if (!gameStateTile?.structureType) return null;

        let buildingColor = 0xffffff;

        let buildingSize = 0.008;

        switch (gameStateTile.structureType) {
          case "city":
            buildingColor = 0xffd700; // Gold

            buildingSize = 0.012;

            break;

          case "port":
            buildingColor = 0x0088ff; // Blue

            buildingSize = 0.01;

            break;

          case "missile_silo":
            buildingColor = 0xff4444; // Red

            buildingSize = 0.008;

            break;

          case "base_hq":
            buildingColor = 0x00ff00; // Green

            buildingSize = 0.015;

            break;
        }

        return (
          <mesh key={`building-${tile.id}`} position={tile.center}>
            <boxGeometry
              args={[buildingSize, buildingSize * 2, buildingSize]}
            />

            <meshBasicMaterial color={buildingColor} transparent={false} />
          </mesh>
        );
      })}

      {/* Missile trajectories - optimized for smooth animation */}
      {Array.from(missiles.values()).map((missile) => {
        if (!missile || !missile.trajectory || missile.trajectory.length === 0) {
          return null;
        }
       
        const points = missile.trajectory.map((point: [number, number, number]) => {
          if (!point || point.length !== 3) return null;
          return new THREE.Vector3(point[0], point[1], point[2]);
        }).filter((p: THREE.Vector3 | null): p is THREE.Vector3 => p !== null);
        
        // Validate points
        const validPoints = points.filter(p => p && !isNaN(p.x) && !isNaN(p.y) && !isNaN(p.z));
        if (validPoints.length < 2) {
          return null;
        }
        
        let curve: THREE.CatmullRomCurve3;
        try {
          curve = new THREE.CatmullRomCurve3(validPoints);
        } catch (error) {
          console.error(`Error creating curve for missile ${missile.id}:`, error);
          return null;
        }
        
        return (
          <MissileRenderer
            key={`missile-${missile.id}`}
            missile={missile}
            curve={curve}
            validPoints={validPoints}
          />
        );
      }).filter(Boolean)}
    </group>
  );
};

export default Globe;
