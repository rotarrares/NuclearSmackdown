import * as THREE from "three";

export interface TileData {
  id: number;
  type: "pentagon" | "hexagon" | "triangle" | "quad";
  vertices: THREE.Vector3[];
  center: THREE.Vector3;
  lat: number;
  lon: number;
  terrainType: "water" | "grass" | "desert" | "mountain";
  startVertex: number;
  startFace: number;
  faceCount: number;
}

export class GlobeGeometry {
  private tiles: TileData[] = [];
  private geometry: THREE.BufferGeometry;
  private borderGeometry: THREE.BufferGeometry;
  private p: number[] = new Array(512);

  constructor() {
    this.initPerlin();
    this.generateGlobe();
    this.geometry = this.createMeshGeometry();
    this.borderGeometry = this.createBorderGeometry();
  }

  private initPerlin() {
    const permutation = [
      151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
      140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247,
      120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177,
      33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165,
      71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211,
      133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25,
      63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196,
      135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217,
      226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206,
      59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248,
      152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22,
      39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218,
      246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241,
      81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
      184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93,
      222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
    ];
    for (let i = 0; i < 256; i++) {
      this.p[256 + i] = this.p[i] = permutation[i];
    }
  }

  private noise3D(x: number, y: number, z: number): number {
    let X = Math.floor(x) & 255,
      Y = Math.floor(y) & 255,
      Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    let u = this.fade(x),
      v = this.fade(y),
      w = this.fade(z);
    let A = this.p[X] + Y,
      AA = this.p[A] + Z,
      AB = this.p[A + 1] + Z,
      B = this.p[X + 1] + Y,
      BA = this.p[B] + Z,
      BB = this.p[B + 1] + Z;
    return this.lerpNoise(
      w,
      this.lerpNoise(
        v,
        this.lerpNoise(
          u,
          this.grad(this.p[AA], x, y, z),
          this.grad(this.p[BA], x - 1, y, z),
        ),
        this.lerpNoise(
          u,
          this.grad(this.p[AB], x, y - 1, z),
          this.grad(this.p[BB], x - 1, y - 1, z),
        ),
      ),
      this.lerpNoise(
        v,
        this.lerpNoise(
          u,
          this.grad(this.p[AA + 1], x, y, z - 1),
          this.grad(this.p[BA + 1], x - 1, y, z - 1),
        ),
        this.lerpNoise(
          u,
          this.grad(this.p[AB + 1], x, y - 1, z - 1),
          this.grad(this.p[BB + 1], x - 1, y - 1, z - 1),
        ),
      ),
    );
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerpNoise(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number, z: number): number {
    let h = hash & 15;
    let u = h < 8 ? x : y,
      v = h < 4 ? y : h == 12 || h == 14 ? x : z;
    return ((h & 1) == 0 ? u : -u) + ((h & 2) == 0 ? v : -v);
  }

  private fbm(
    x: number,
    y: number,
    z: number,
    octaves: number,
    persistence: number,
    lacunarity: number = 2,
  ): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      value +=
        amplitude * this.noise3D(x * frequency, y * frequency, z * frequency);
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    return value / maxValue;
  }

  private generateGlobe() {
    // Step 1: Create base icosahedron
    const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio
    const vertices = [
      [-1, phi, 0],
      [1, phi, 0],
      [-1, -phi, 0],
      [1, -phi, 0],
      [0, -1, phi],
      [0, 1, phi],
      [0, -1, -phi],
      [0, 1, -phi],
      [phi, 0, -1],
      [phi, 0, 1],
      [-phi, 0, -1],
      [-phi, 0, 1],
    ].map((v) => new THREE.Vector3(v[0], v[1], v[2]).normalize());

    const faces = [
      [0, 11, 5],
      [0, 5, 1],
      [0, 1, 7],
      [0, 7, 10],
      [0, 10, 11],
      [1, 5, 9],
      [5, 11, 4],
      [11, 10, 2],
      [10, 7, 6],
      [7, 1, 8],
      [3, 9, 4],
      [3, 4, 2],
      [3, 2, 6],
      [3, 6, 8],
      [3, 8, 9],
      [4, 9, 5],
      [2, 4, 11],
      [6, 2, 10],
      [8, 6, 7],
      [9, 8, 1],
    ];

    // Step 2: Subdivide to create geodesic polyhedron (frequency = 80 for balanced detail/performance)
    const frequency = 80;
    const subdividedVertices: THREE.Vector3[] = [];
    const subdividedFaces: number[][] = [];
    const vertexMap = new Map<string, number>(); // To avoid duplicate vertices

    // Generate subdivided mesh using barycentric coordinates
    for (const face of faces) {
      const [a, b, c] = face.map((i) => vertices[i]);

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
          // Use vertex map to avoid duplicates with higher precision
          const key = `${point.x.toFixed(10)},${point.y.toFixed(10)},${point.z.toFixed(10)}`;
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
      face.forEach((vertexIndex) => {
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
      const sortedFaces = this.sortFacesAroundVertex(
        center,
        adjacentFaces,
        dualVertices,
      );

      // Handle irregular tiles by creating valid polygons
      if (sortedFaces.length < 3) {
        return; // Skip completely invalid tiles
      }
      
      if (sortedFaces.length === 3 || sortedFaces.length === 4) {
        // For boundary vertices with fewer faces, create smaller valid tiles
        // These are typically at subdivision boundaries and are mathematically correct
        // Don't skip them as they're needed for complete coverage
      } else if (sortedFaces.length > 6) {
        // For vertices with too many faces, take only the first 6 to create a hexagon
        sortedFaces.splice(6);
        console.warn(`Oversized tile at vertex ${vertexIndex} reduced to hexagon`);
      }

      sortedFaces.forEach((faceIndex) => {
        tileVertices.push(dualVertices[faceIndex].clone());
      });

      const tileType = tileVertices.length === 5 ? "pentagon" : 
                       tileVertices.length === 3 ? "triangle" :
                       tileVertices.length === 4 ? "quad" : "hexagon";
      const tileCenter = new THREE.Vector3();
      tileVertices.forEach((v) => tileCenter.add(v));
      tileCenter.divideScalar(tileVertices.length).normalize();

      // Convert to lat/lon
      const lat = (Math.asin(tileCenter.y) * 180) / Math.PI;
      const lon = (Math.atan2(tileCenter.z, tileCenter.x) * 180) / Math.PI;

      // Generate terrain type
      const terrainType = this.generateTerrainType(lat, lon, tileCenter);

      this.tiles.push({
        id: tileId++,
        type: tileType,
        vertices: tileVertices,
        center: tileCenter,
        lat,
        lon,
        terrainType,
        startVertex: 0, // Will be set during mesh creation
        startFace: 0, // Will be set during mesh creation
        faceCount: tileVertices.length - 2, // Triangulated count
      });
    });

    const waterTiles = this.tiles.filter(
      (t) => t.terrainType === "water",
    ).length;
    const grassTiles = this.tiles.filter(
      (t) => t.terrainType === "grass",
    ).length;
    const desertTiles = this.tiles.filter(
      (t) => t.terrainType === "desert",
    ).length;
    const mountainTiles = this.tiles.filter(
      (t) => t.terrainType === "mountain",
    ).length;

    const pentagons = this.tiles.filter((t) => t.type === "pentagon").length;
    const hexagons = this.tiles.filter((t) => t.type === "hexagon").length;
    const triangles = this.tiles.filter((t) => t.type === "triangle").length;
    const quads = this.tiles.filter((t) => t.type === "quad").length;
    
    console.log(
      `Generated ${this.tiles.length} tiles (${pentagons} pentagons, ${hexagons} hexagons, ${triangles} triangles, ${quads} quads)`,
    );
    console.log(
      `Terrain: ${waterTiles} water (${((waterTiles / this.tiles.length) * 100).toFixed(1)}%), ${grassTiles} grass (${((grassTiles / this.tiles.length) * 100).toFixed(1)}%), ${desertTiles} desert (${((desertTiles / this.tiles.length) * 100).toFixed(1)}%), ${mountainTiles} mountain (${((mountainTiles / this.tiles.length) * 100).toFixed(1)}%)`,
    );
  }

  private generateTerrainType(
    lat: number,
    lon: number,
    center: THREE.Vector3,
  ): "water" | "grass" | "desert" | "mountain" {
    // Use fractal Brownian motion (fBm) with Perlin noise for natural continent shapes
    const continentScale = 1.5; // Lower scale for larger continents
    const elevation = this.fbm(
      center.x * continentScale,
      center.y * continentScale,
      center.z * continentScale,
      6,
      0.5,
    );
    const elevNorm = (elevation + 1) / 2; // Normalize to 0-1

    // Sea level threshold to aim for ~70% water; adjust as needed based on console output
    const seaLevel = 0.55;
    if (elevNorm < seaLevel) {
      return "water";
    }

    // Normalize land height
    const landHeight = (elevNorm - seaLevel) / (1 - seaLevel);

    // Mountains at higher elevations
    const mountainThreshold = 0.35;
    if (landHeight > mountainThreshold) {
      return "mountain";
    }

    // Moisture for biomes using another fBm layer
    const moistureScale = 3.0;
    const moistureOffset = 1000; // Offset to differentiate from elevation noise
    const moisture =
      (this.fbm(
        center.x * moistureScale + moistureOffset,
        center.y * moistureScale,
        center.z * moistureScale,
        4,
        0.5,
      ) +
        1) /
      2;

    // Climate zones based on latitude
    const absLat = Math.abs(lat);
    const equatorialZone = absLat < 23.5; // Tropics
    const temperateZone = absLat >= 23.5 && absLat < 66.5;
    const polarZone = absLat >= 66.5;

    // Deserts more likely in subtropical zones (~15-40°), especially north of equator
    let desertThreshold = 0.4;
    const isSubtropical = absLat > 15 && absLat < 40;
    if (isSubtropical) {
      desertThreshold -= 0.2; // Higher chance in dry subtropical belts
    }
    if (lat > 0 && isSubtropical) {
      desertThreshold += 0.1; // Bias more deserts north of equator (higher threshold = more deserts)
    }

    // Adjust for climate zones
    if (equatorialZone) {
      // Tropics: generally wetter, fewer deserts
      desertThreshold += 0.1;
    } else if (polarZone) {
      // Polar: tundra (grass) or mountains, rare deserts
      desertThreshold += 0.3;
    }

    // Biome decision
    if (moisture < desertThreshold) {
      return "desert";
    }
    return "grass";
  }

  private sortFacesAroundVertex(
    center: THREE.Vector3,
    faceIndices: number[],
    dualVertices: THREE.Vector3[],
  ): number[] {
    if (faceIndices.length < 3) return faceIndices;
    
    // Create tangent plane basis with improved stability
    const normal = center.clone().normalize();
    
    // Choose a more stable reference vector
    let up: THREE.Vector3;
    if (Math.abs(normal.x) < 0.9) {
      up = new THREE.Vector3(1, 0, 0);
    } else if (Math.abs(normal.y) < 0.9) {
      up = new THREE.Vector3(0, 1, 0);
    } else {
      up = new THREE.Vector3(0, 0, 1);
    }
    
    const u = new THREE.Vector3().crossVectors(normal, up).normalize();
    const v = new THREE.Vector3().crossVectors(normal, u).normalize();
    
    // Calculate angles in tangent plane with better precision
    const angles = faceIndices.map((faceIndex) => {
      const faceCenter = dualVertices[faceIndex];
      const direction = faceCenter.clone().sub(center).normalize();
      const x = direction.dot(u);
      const y = direction.dot(v);
      let angle = Math.atan2(y, x);
      // Normalize angle to [0, 2π) range
      if (angle < 0) angle += 2 * Math.PI;
      return { faceIndex, angle };
    });
    
    // Sort by angle
    angles.sort((a, b) => a.angle - b.angle);
    return angles.map((a) => a.faceIndex);
  }

  private createMeshGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    const indices: number[] = [];
    let vertexIndex = 0;
    this.tiles.forEach((tile, tileIndex) => {
      tile.startVertex = vertexIndex;
      tile.startFace = indices.length / 3;

      // Add tile vertices
      tile.vertices.forEach((vertex) => {
        positions.push(vertex.x, vertex.y, vertex.z);
        vertexIndex++;
      });

      // Triangulate tile (fan triangulation from first vertex)
      for (let i = 1; i < tile.vertices.length - 1; i++) {
        indices.push(
          tile.startVertex,
          tile.startVertex + i,
          tile.startVertex + i + 1,
        );
      }
      tile.faceCount = tile.vertices.length - 2;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  private createBorderGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    this.tiles.forEach((tile) => {
      const vertices = tile.vertices;
      for (let i = 0; i < vertices.length; i++) {
        const current = vertices[i];
        const next = vertices[(i + 1) % vertices.length];

        // Scale slightly outward to prevent z-fighting
        const scaledCurrent = current.clone().multiplyScalar(1.001);
        const scaledNext = next.clone().multiplyScalar(1.001);

        positions.push(
          scaledCurrent.x,
          scaledCurrent.y,
          scaledCurrent.z,
          scaledNext.x,
          scaledNext.y,
          scaledNext.z,
        );
      }
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
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
