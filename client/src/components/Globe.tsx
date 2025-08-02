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

  const {
    tiles,
    players,
    currentPlayer,
    missiles,
    hoveredTile,
    setHoveredTile,
  } = useGameState();

  const { selectTile, buildStructure, launchMissile } = useMultiplayer();

  const [isHovering, setIsHovering] = useState(false);

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

  // Update colors when game state changes

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.geometry.setAttribute("color", colorAttribute);

      meshRef.current.geometry.attributes.color.needsUpdate = true;
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

  const handleClick = useCallback(() => {
    if (hoveredTile && currentPlayer) {
      const gameStateTile = tiles.get(hoveredTile.id);

      // Find missile silos owned by current player

      const missileSilos = Array.from(tiles.values()).filter(
        (tile) =>
          tile.ownerId === currentPlayer.id &&
          tile.structureType === "missile_silo",
      );

      // If there are missile silos and clicking on enemy/neutral tile, launch missile

      if (
        missileSilos.length > 0 &&
        (!gameStateTile?.ownerId || gameStateTile.ownerId !== currentPlayer.id)
      ) {
        // Use the first available missile silo

        const silo = missileSilos[0];

        launchMissile(silo.id, hoveredTile.id);

        console.log(
          `Launching missile from silo at tile ${silo.id} to target ${hoveredTile.id}`,
        );

        return;
      }

      // If tile is unowned or we want to expand, try to claim it

      if (!gameStateTile?.ownerId) {
        selectTile(hoveredTile.id);
      } else if (gameStateTile.ownerId === currentPlayer.id) {
        // Show building options for owned tiles - use game state store

        useGameState.getState().setBuildingOptions({
          tileId: hoveredTile.id,

          canBuildPort: true, // Will be determined by server

          position: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
        });
      } else {
        console.log("Clicked enemy tile:", hoveredTile.id);
      }
    }
  }, [hoveredTile, currentPlayer, tiles, selectTile, launchMissile]);

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

      {/* Missile trajectories */}
      {(() => {
        console.log(`Globe rendering: ${missiles.size} missiles in state`);
        return Array.from(missiles.values());
      })().map((missile) => {
        if (!missile.trajectory || missile.trajectory.length === 0) {
          console.log(`Missile ${missile.id} has no trajectory data`);
          return null;
        }

        console.log(`Rendering trajectory for missile ${missile.id} with ${missile.trajectory.length} points`);

        const points = missile.trajectory.map(
          (point: [number, number, number]) => new THREE.Vector3(...point),
        );

        return (
          <group key={`missile-group-${missile.id}`}>
            {/* Use a thick white tube for better visibility */}
            <mesh>
              <tubeGeometry args={[new THREE.CatmullRomCurve3(points), 64, 0.005, 8, false]} />
              <meshBasicMaterial
                color={0xffffff}
                transparent={true}
                opacity={0.9}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Add trajectory points as small spheres for debugging */}
            {points.slice(0, 5).map((point, index) => (
              <mesh key={`point-${missile.id}-${index}`} position={point}>
                <sphereGeometry args={[0.003, 8, 8]} />
                <meshBasicMaterial color={0xff0000} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
};

export default Globe;
