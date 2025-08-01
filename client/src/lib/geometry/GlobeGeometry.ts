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
    // Create a simplified geodesic sphere with manageable tile count
    // Start with icosahedron and subdivide once to get ~1000 tiles
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

    // Simple subdivision to create more tiles
    const subdividedVertices: THREE.Vector3[] = [...vertices];
    const subdividedFaces: number[][] = [];
    const edgeMap = new Map<string, number>();

    // Helper function to get or create midpoint
    const getMidpoint = (i1: number, i2: number): number => {
      const key = i1 < i2 ? `${i1}-${i2}` : `${i2}-${i1}`;
      if (edgeMap.has(key)) {
        return edgeMap.get(key)!;
      }
      
      const v1 = subdividedVertices[i1];
      const v2 = subdividedVertices[i2];
      const midpoint = new THREE.Vector3()
        .addVectors(v1, v2)
        .normalize();
      
      const index = subdividedVertices.length;
      subdividedVertices.push(midpoint);
      edgeMap.set(key, index);
      return index;
    };

    // Subdivide each face into 4 triangles
    for (const face of faces) {
      const [a, b, c] = face;
      
      // Get midpoints
      const ab = getMidpoint(a, b);
      const bc = getMidpoint(b, c);
      const ca = getMidpoint(c, a);
      
      // Create 4 new faces
      subdividedFaces.push([a, ab, ca]);
      subdividedFaces.push([b, bc, ab]);
      subdividedFaces.push([c, ca, bc]);
      subdividedFaces.push([ab, bc, ca]);
    }

    // Create tiles directly from the subdivided mesh
    this.createTilesFromMesh(subdividedVertices, subdividedFaces);
  }

  private createTilesFromMesh(vertices: THREE.Vector3[], faces: number[][]) {
    // Create tiles directly from triangular faces - each face becomes a tile
    let tileId = 0;
    
    faces.forEach(face => {
      const [a, b, c] = face.map(i => vertices[i]);
      const tileVertices = [a, b, c];
      
      // Calculate tile center
      const center = new THREE.Vector3();
      tileVertices.forEach(v => center.add(v));
      center.divideScalar(tileVertices.length).normalize();
      
      // Convert to lat/lon
      const lat = Math.asin(center.y) * 180 / Math.PI;
      const lon = Math.atan2(center.z, center.x) * 180 / Math.PI;
      
      this.tiles.push({
        id: tileId++,
        type: 'hexagon', // Simplified - all triangular tiles
        vertices: tileVertices,
        center,
        lat,
        lon,
        startVertex: 0, // Will be set during mesh creation
        startFace: 0,   // Will be set during mesh creation
        faceCount: 1    // Each tile is one triangle
      });
    });
    
    console.log(`Generated ${this.tiles.length} tiles`);
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
    const colors: number[] = [];
    let vertexIndex = 0;

    this.tiles.forEach((tile, tileIndex) => {
      tile.startVertex = vertexIndex;
      tile.startFace = tileIndex;
      
      // Add tile vertices (each tile is a triangle)
      tile.vertices.forEach(vertex => {
        positions.push(vertex.x, vertex.y, vertex.z);
        // Default color - will be updated by component
        colors.push(0.2, 0.6, 0.3); // Green
      });

      vertexIndex += 3;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    // Create indices for all triangles
    const indices = [];
    for (let i = 0; i < this.tiles.length; i++) {
      const baseIndex = i * 3;
      indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
    }
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
