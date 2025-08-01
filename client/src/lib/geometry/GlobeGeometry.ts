import * as THREE from "three";

export interface TileData {
  id: number;
  type: 'pentagon' | 'hexagon';
  vertices: THREE.Vector3[];
  center: THREE.Vector3;
  lat: number;
  lon: number;
  startVertex: number;
  startFace: number;
  faceCount: number;
}

export class GlobeGeometry {
  private tiles: TileData[] = [];
  private geometry: THREE.BufferGeometry;
  private borderGeometry: THREE.BufferGeometry;

  constructor() {
    this.generateGlobe();
    this.geometry = this.createMeshGeometry();
    this.borderGeometry = this.createBorderGeometry();
  }

  private generateGlobe() {
    // Step 1: Create base icosahedron
    const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio
    const vertices = [
      [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
      [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
      [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
    ].map(v => new THREE.Vector3(v[0], v[1], v[2]).normalize());

    const faces = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ];

    // Step 2: Subdivide to create geodesic polyhedron (frequency = 20 for 4002 vertices)
    const frequency = 20;
    const subdividedVertices: THREE.Vector3[] = [];
    const subdividedFaces: number[][] = [];
    const vertexMap = new Map<string, number>(); // To avoid duplicate vertices

    // Generate subdivided mesh using barycentric coordinates
    for (const face of faces) {
      const [a, b, c] = face.map(i => vertices[i]);
      
      // Create subdivision points for this face
      const faceVertices: THREE.Vector3[] = [];
      const faceIndices: number[] = [];
      
      for (let i = 0; i <= frequency; i++) {
        for (let j = 0; j <= frequency - i; j++) {
          const u = i / frequency;
          const v = j / frequency;
          const w = 1 - u - v;

          const point = new THREE.Vector3()
            .addScaledVector(a, w)
            .addScaledVector(b, u)
            .addScaledVector(c, v)
            .normalize();

          // Use vertex map to avoid duplicates
          const key = `${point.x.toFixed(8)},${point.y.toFixed(8)},${point.z.toFixed(8)}`;
          if (!vertexMap.has(key)) {
            vertexMap.set(key, subdividedVertices.length);
            subdividedVertices.push(point);
          }
          faceIndices.push(vertexMap.get(key)!);
        }
      }

      // Create triangular faces from the grid
      let idx = 0;
      for (let i = 0; i < frequency; i++) {
        for (let j = 0; j < frequency - i; j++) {
          const rowLength = frequency - i + 1;
          const nextRowLength = frequency - i;
          
          const p1 = faceIndices[idx];
          const p2 = faceIndices[idx + 1];
          const p3 = faceIndices[idx + rowLength];
          
          subdividedFaces.push([p1, p2, p3]);
          
          // Add second triangle if not on edge
          if (j < frequency - i - 1) {
            const p4 = faceIndices[idx + rowLength + 1];
            subdividedFaces.push([p2, p4, p3]);
          }
          
          idx++;
        }
        idx++; // Skip the last vertex of each row
      }
    }

    // Step 3: Create dual polyhedron (hex-pent tiles)
    this.createDualPolyhedron(subdividedVertices, subdividedFaces);
  }

  private createDualPolyhedron(vertices: THREE.Vector3[], faces: number[][]) {
    // Calculate face centroids for dual vertices
    const dualVertices: THREE.Vector3[] = [];
    const vertexToFaces: Map<number, number[]> = new Map();

    // Build vertex-to-faces adjacency
    faces.forEach((face, faceIndex) => {
      const centroid = new THREE.Vector3();
      face.forEach(vertexIndex => {
        centroid.add(vertices[vertexIndex]);
        if (!vertexToFaces.has(vertexIndex)) {
          vertexToFaces.set(vertexIndex, []);
        }
        vertexToFaces.get(vertexIndex)!.push(faceIndex);
      });
      centroid.divideScalar(face.length).normalize();
      dualVertices.push(centroid);
    });

    // Create tiles from vertex adjacencies
    let tileId = 0;
    vertexToFaces.forEach((adjacentFaces, vertexIndex) => {
      if (adjacentFaces.length < 3) return; // Skip invalid vertices
      
      const tileVertices: THREE.Vector3[] = [];
      
      // Sort adjacent faces by angle around the vertex
      const center = vertices[vertexIndex];
      const sortedFaces = this.sortFacesAroundVertex(center, adjacentFaces, dualVertices);
      
      sortedFaces.forEach(faceIndex => {
        tileVertices.push(dualVertices[faceIndex]);
      });

      const tileType = tileVertices.length === 5 ? 'pentagon' : 'hexagon';
      const tileCenter = new THREE.Vector3();
      tileVertices.forEach(v => tileCenter.add(v));
      tileCenter.divideScalar(tileVertices.length).normalize();

      // Convert to lat/lon
      const lat = Math.asin(tileCenter.y) * 180 / Math.PI;
      const lon = Math.atan2(tileCenter.z, tileCenter.x) * 180 / Math.PI;

      this.tiles.push({
        id: tileId++,
        type: tileType,
        vertices: tileVertices,
        center: tileCenter,
        lat,
        lon,
        startVertex: 0, // Will be set during mesh creation
        startFace: 0,   // Will be set during mesh creation
        faceCount: tileVertices.length - 2 // Triangulated count
      });
    });

    console.log(`Generated ${this.tiles.length} tiles (${this.tiles.filter(t => t.type === 'pentagon').length} pentagons, ${this.tiles.filter(t => t.type === 'hexagon').length} hexagons)`);
  }

  private sortFacesAroundVertex(center: THREE.Vector3, faceIndices: number[], dualVertices: THREE.Vector3[]): number[] {
    if (faceIndices.length < 3) return faceIndices;

    // Create tangent plane basis
    const normal = center.clone().normalize();
    const up = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(normal, up).normalize();
    const v = new THREE.Vector3().crossVectors(normal, u);

    // Calculate angles in tangent plane
    const angles = faceIndices.map(faceIndex => {
      const faceCenter = dualVertices[faceIndex];
      const direction = faceCenter.clone().sub(center);
      const x = direction.dot(u);
      const y = direction.dot(v);
      return { faceIndex, angle: Math.atan2(y, x) };
    });

    // Sort by angle
    angles.sort((a, b) => a.angle - b.angle);
    return angles.map(a => a.faceIndex);
  }

  private createMeshGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    const indices: number[] = [];
    let vertexIndex = 0;

    this.tiles.forEach((tile, tileIndex) => {
      tile.startVertex = vertexIndex;
      tile.startFace = indices.length / 3;
      
      // Add tile vertices
      tile.vertices.forEach(vertex => {
        positions.push(vertex.x, vertex.y, vertex.z);
        vertexIndex++;
      });

      // Triangulate tile (fan triangulation from first vertex)
      for (let i = 1; i < tile.vertices.length - 1; i++) {
        indices.push(
          tile.startVertex,
          tile.startVertex + i,
          tile.startVertex + i + 1
        );
      }
      tile.faceCount = tile.vertices.length - 2;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }

  private createBorderGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];

    this.tiles.forEach(tile => {
      const vertices = tile.vertices;
      for (let i = 0; i < vertices.length; i++) {
        const current = vertices[i];
        const next = vertices[(i + 1) % vertices.length];
        
        // Scale slightly outward to prevent z-fighting
        const scaledCurrent = current.clone().multiplyScalar(1.001);
        const scaledNext = next.clone().multiplyScalar(1.001);
        
        positions.push(
          scaledCurrent.x, scaledCurrent.y, scaledCurrent.z,
          scaledNext.x, scaledNext.y, scaledNext.z
        );
      }
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }

  getGeometry(): THREE.BufferGeometry {
    return this.geometry;
  }

  getBorderGeometry(): THREE.BufferGeometry {
    return this.borderGeometry;
  }

  getTileData(): TileData[] {
    return this.tiles;
  }
}
