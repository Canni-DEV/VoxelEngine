import * as THREE from 'three';
import { Chunk } from './Chunk';
import { TerrainGenerator, VoxelType } from './TerrainGenerator';
import { TerrainConfig } from './TerrainConfig';

const VOXEL_FONT: Record<string, string[]> = {
  'A': [
    " XXX ",
    "X   X",
    "XXXXX",
    "X   X",
    "X   X"
  ],
  'B': [
    "XXXX ",
    "X   X",
    "XXXX ",
    "X   X",
    "XXXX "
  ],
  'C': [
    " XXXX",
    "X    ",
    "X    ",
    "X    ",
    " XXXX"
  ],
  'D': [
    "XXXX ",
    "X   X",
    "X   X",
    "X   X",
    "XXXX "
  ],
  'E': [
    "XXXXX",
    "X    ",
    "XXX  ",
    "X    ",
    "XXXXX"
  ],
  'F': [
    "XXXXX",
    "X    ",
    "XXX  ",
    "X    ",
    "X    "
  ],
  'G': [
    " XXXX",
    "X    ",
    "X XXX",
    "X   X",
    " XXXX"
  ],
  'H': [
    "X   X",
    "X   X",
    "XXXXX",
    "X   X",
    "X   X"
  ],
  'I': [
    "XXXXX",
    "  X  ",
    "  X  ",
    "  X  ",
    "XXXXX"
  ],
  'J': [
    "XXXXX",
    "   X ",
    "   X ",
    "X  X ",
    " XX  "
  ],
  'K': [
    "X   X",
    "X  X ",
    "XXX  ",
    "X  X ",
    "X   X"
  ],
  'L': [
    "X    ",
    "X    ",
    "X    ",
    "X    ",
    "XXXXX"
  ],
  'M': [
    "X   X",
    "XX XX",
    "X X X",
    "X   X",
    "X   X"
  ],
  'N': [
    "X   X",
    "XX  X",
    "X X X",
    "X  XX",
    "X   X"
  ],
  'O': [
    " XXX ",
    "X   X",
    "X   X",
    "X   X",
    " XXX "
  ],
  'P': [
    "XXXX ",
    "X   X",
    "XXXX ",
    "X    ",
    "X    "
  ],
  'Q': [
    " XXX ",
    "X   X",
    "X   X",
    "X  XX",
    " XXXX"
  ],
  'R': [
    "XXXX ",
    "X   X",
    "XXXX ",
    "X  X ",
    "X   X"
  ],
  'S': [
    " XXXX",
    "X    ",
    " XXX ",
    "    X",
    "XXXX "
  ],
  'T': [
    "XXXXX",
    "  X  ",
    "  X  ",
    "  X  ",
    "  X  "
  ],
  'U': [
    "X   X",
    "X   X",
    "X   X",
    "X   X",
    " XXX "
  ],
  'V': [
    "X   X",
    "X   X",
    "X   X",
    " X X ",
    "  X  "
  ],
  'W': [
    "X   X",
    "X   X",
    "X X X",
    "XX XX",
    "X   X"
  ],
  'X': [
    "X   X",
    " X X ",
    "  X  ",
    " X X ",
    "X   X"
  ],
  'Y': [
    "X   X",
    " X X ",
    "  X  ",
    "  X  ",
    "  X  "
  ],
  'Z': [
    "XXXXX",
    "   X ",
    "  X  ",
    " X   ",
    "XXXXX"
  ],
  ' ': [
    "     ",
    "     ",
    "     ",
    "     ",
    "     "
  ]
};

export class ChunkManager {
  private scene: THREE.Scene;
  private chunks: Map<string, Chunk>;
  private modifiedChunks: Map<string, Chunk>;
  public chunkSize: number = 16;
  private renderDistance: number = 12;
  private renderDistanceDelete: number = 15;
  private terrainGenerator: TerrainGenerator;
  private loadingChunks: boolean = false;
  private loadingChunksKeys: THREE.Vector2[] = [];

  private loadCounter: number = 2;
  private firstChunksLoaded: boolean = false;
  private currentChunkX: number = 0;
  private currentChunkZ: number = 0;

  private worldText: string | null = null;
  private textPosition: THREE.Vector3 = new THREE.Vector3();
  private textScale: number = 1;
  private textGenerated: boolean = false;

  constructor(scene: THREE.Scene, config: TerrainConfig = {}) {
    this.scene = scene;
    this.chunks = new Map();
    this.modifiedChunks = new Map();
    const url = new URL(location.href);
    this.terrainGenerator = new TerrainGenerator(url.searchParams.get("seed"), config);
  }

  public update(playerPosition: THREE.Vector3) {
    //this.updateShaders();
    this.currentChunkX = Math.floor(playerPosition.x / this.chunkSize);
    this.currentChunkZ = Math.floor(playerPosition.z / this.chunkSize);
    this.deleteChunks(this.currentChunkX, this.currentChunkZ);
    this.setChunksToLoad(this.currentChunkX, this.currentChunkZ);

    if (--this.loadCounter <= 0) {
      this.loadNextChunk();
      this.loadCounter = 2;
    }
  }

  public getChunkAt(chunkX: number, chunkZ: number): Chunk | undefined {
    const key = this.getChunkKey(chunkX, chunkZ);
    return this.chunks.get(key) || this.modifiedChunks.get(key);
  }

  public getLoadedChunks(): Chunk[] {
    return Array.from(this.chunks.values());
  }

  public isWorldLoaded(): boolean {
    return this.firstChunksLoaded;
  }

  public getRenderDistance(): number {
    return this.renderDistance;
  }

  public getPlayerChunk(): THREE.Vector2 {
    return new THREE.Vector2(this.currentChunkX, this.currentChunkZ);
  }

  public requestChunkLoad(chunkX: number, chunkZ: number): void {
    const key = this.getChunkKey(chunkX, chunkZ);
    if (this.chunks.has(key) || this.loadingChunksKeys.find(c => c.x === chunkX && c.y === chunkZ)) return;
    this.loadingChunksKeys.push(new THREE.Vector2(chunkX, chunkZ));
    this.loadingChunks = true;
  }

  public setWorldText(text: string, position: THREE.Vector3, scale: number): void {
    this.worldText = text;
    this.textPosition = position.clone();
    this.textScale = Math.max(1, Math.floor(scale));
  }

  private updateShaders(): void {
    const time = performance.now() / 1000;
    this.chunks.forEach(chunk => {
      const meshMaterial = chunk.mesh.material;
      if (Array.isArray(meshMaterial)) {
        // Iteramos por cada material del mesh
        meshMaterial.forEach(mat => {
          if (mat.userData && mat.userData.shader) {
            mat.userData.shader.uniforms.uTime.value = time;
          }
        });
      } else if (meshMaterial.userData && meshMaterial.userData.shader) {
        // Si es un único material, lo actualizamos directamente
        meshMaterial.userData.shader.uniforms.uTime.value = time;
      }
    });
  }

  private setChunksToLoad(currentChunkX: number, currentChunkZ: number) {
    if (this.loadingChunks) return;

    this.loadingChunksKeys.length = 0;
    const startX = currentChunkX - this.renderDistance;
    const endX = currentChunkX + this.renderDistance;
    const startZ = currentChunkZ - this.renderDistance;
    const endZ = currentChunkZ + this.renderDistance;

    for (let x = startX; x <= endX; x++) {
      for (let z = startZ; z <= endZ; z++) {
        const key = this.getChunkKey(x, z);
        if (!this.chunks.has(key)) {
          this.loadingChunksKeys.push(new THREE.Vector2(x, z));
        }
      }
    }

    this.loadingChunksKeys.sort((a, b) => {
      const da = (a.x - currentChunkX) ** 2 + (a.y - currentChunkZ) ** 2;
      const db = (b.x - currentChunkX) ** 2 + (b.y - currentChunkZ) ** 2;
      return da - db;
    });

    this.loadingChunks = this.loadingChunksKeys.length > 0;
  }

  private loadNextChunk() {
    if (!this.loadingChunks) return;

    const chunkKey = this.loadingChunksKeys.shift();
    if (!chunkKey) {
      this.loadingChunks = false;
      this.firstChunksLoaded = true;
      if (!this.textGenerated) {
        this.generateWorldText();
        this.textGenerated = true;
      }
      return;
    }
    const key = this.getChunkKey(chunkKey.x, chunkKey.y);
    let chunk: Chunk;
    if (this.modifiedChunks.has(key)) {
      chunk = this.modifiedChunks.get(key)!;
    } else {
      chunk = new Chunk(chunkKey.x, chunkKey.y, this.chunkSize, this.terrainGenerator);
    }
    this.scene.add(chunk.mesh);
    this.chunks.set(key, chunk);
  }

  private deleteChunks(currentChunkX: number, currentChunkZ: number) {
    if (this.loadingChunks) return;
    for (const [key, chunk] of this.chunks.entries()) {
      if (Math.abs(chunk.x - currentChunkX) > this.renderDistanceDelete ||
        Math.abs(chunk.z - currentChunkZ) > this.renderDistanceDelete) {
        this.scene.remove(chunk.mesh);
        if (chunk.modified) {
          this.modifiedChunks.set(key, chunk);
        }
        chunk.Delete();
        this.chunks.delete(key);
      }
    }
  }

  private getChunkKey(x: number, z: number): string {
    return `${x},${z}`;
  }

  public closestFreeSpace(position: THREE.Vector3): THREE.Vector3 {
    // Convertir la posición a coordenadas voxel enteras.
    const startX = Math.floor(position.x);
    const startY = Math.floor(position.y);
    const startZ = Math.floor(position.z);

    const maxRadius = 100; // Radio máximo de búsqueda en voxeles.
    let bestCandidate: THREE.Vector3 | null = null;
    let bestDistSq = Infinity;
    let count = 0;
    // Búsqueda en forma de "capa" (expansión concéntrica) hasta maxRadius.
    for (let r = 0; r <= maxRadius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dz = -r; dz <= r; dz++) {
            const x = startX + dx;
            const y = startY + dy;
            const z = startZ + dz;
            // Descarta candidatos por debajo del nivel del mar.
            if (y < this.terrainGenerator.getSeaLevel()) continue;
            const distSq = dx * dx + dy * dy + dz * dz;
            // Si ya se encontró un candidato más cercano, no evaluar este.
            if (distSq >= bestDistSq) continue;
            // Comprueba las condiciones para que el candidato sea adecuado.
            if (this.isValidCandidate(x, y, z)) {
              bestDistSq = distSq;
              // Se retorna la posición un voxel por encima del candidato (por ejemplo, para spawnear al jugador).
              bestCandidate = new THREE.Vector3(x, y + 1, z);
            }
          }
        }
      }
      // Si se encontró un candidato en esta capa, se retorna inmediatamente.
      if (bestCandidate !== null) {
        return bestCandidate;
      }
    }
    // Si no se encontró candidato, se retorna la posición de inicio.
    return new THREE.Vector3(startX, startY, startZ);
  }

  private isValidCandidate(x: number, y: number, z: number): boolean {
    // Verifica que los voxeles adyacentes estén libres. Esto incluye las
    // cuatro diagonales, asegurando suficiente espacio alrededor del punto de
    // spawn potencial.
    return this.isVoxelFree(x, y, z, VoxelType.AIR) &&
      this.isVoxelFree(x, y + 1, z, VoxelType.AIR) &&
      this.isVoxelFree(x + 1, y, z, VoxelType.AIR) &&
      this.isVoxelFree(x - 1, y, z, VoxelType.AIR) &&
      this.isVoxelFree(x, y, z + 1, VoxelType.AIR) &&
      this.isVoxelFree(x, y, z - 1, VoxelType.AIR) &&
      this.isVoxelFree(x + 1, y, z + 1, VoxelType.AIR) &&
      this.isVoxelFree(x + 1, y, z - 1, VoxelType.AIR) &&
      this.isVoxelFree(x - 1, y, z + 1, VoxelType.AIR) &&
      this.isVoxelFree(x - 1, y, z - 1, VoxelType.AIR) &&
      this.isVoxelFree(x, y - 1, z, VoxelType.GRASS);
  }

  private isVoxelFree(globalX: number, globalY: number, globalZ: number, voxelType: VoxelType): boolean {
    const chunkX = Math.floor(globalX / this.chunkSize);
    const chunkZ = Math.floor(globalZ / this.chunkSize);
    const chunk = this.getChunkAt(chunkX, chunkZ);
    if (!chunk) return false;
    const localX = globalX - chunk.x * this.chunkSize;
    const localZ = globalZ - chunk.z * this.chunkSize;
    if (localX < 0 || localX >= chunk.size || localZ < 0 || localZ >= chunk.size) return false;
    if (globalY < 0 || globalY >= chunk.maxHeight) return false;
    return chunk.getVoxel(localX, globalY, localZ) === voxelType;
  }

  private setVoxel(globalX: number, globalY: number, globalZ: number, type: VoxelType): void {
    const chunkX = Math.floor(globalX / this.chunkSize);
    const chunkZ = Math.floor(globalZ / this.chunkSize);
    const chunk = this.getChunkAt(chunkX, chunkZ);
    if (!chunk) return;
    const localX = globalX - chunk.x * this.chunkSize;
    const localZ = globalZ - chunk.z * this.chunkSize;
    if (localX < 0 || localX >= chunk.size || localZ < 0 || localZ >= chunk.size) return;
    if (globalY < 0 || globalY >= chunk.maxHeight) return;
    chunk.updateVoxel(localX, globalY, localZ, type);
  }

  private generateWorldText(): void {
    if (!this.worldText) return;
    let cursorX = this.textPosition.x;
    const baseY = this.textPosition.y;
    const baseZ = this.textPosition.z;
    const depth = this.textScale;
    const text = this.worldText.toUpperCase();
    for (const ch of text) {
      const pattern = VOXEL_FONT[ch] || VOXEL_FONT[' '];
      const height = pattern.length;
      const width = pattern[0].length;
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          if (pattern[row][col] !== ' ') {
            for (let sx = 0; sx < this.textScale; sx++) {
              for (let sy = 0; sy < this.textScale; sy++) {
                for (let sz = 0; sz < depth; sz++) {
                  const x = Math.floor(cursorX + col * this.textScale + sx);
                  const y = Math.floor(baseY + (height - 1 - row) * this.textScale + sy);
                  const z = Math.floor(baseZ + sz);
                  this.setVoxel(x, y, z, VoxelType.STONE);
                }
              }
            }
          }
        }
      }
      cursorX += (width + 1) * this.textScale;
    }
  }

  public getVoxelType(globalX: number, globalY: number, globalZ: number): VoxelType | null {
    const chunkX = Math.floor(globalX / this.chunkSize);
    const chunkZ = Math.floor(globalZ / this.chunkSize);
    const chunk = this.getChunkAt(chunkX, chunkZ);
    if (!chunk) return null;
    const localX = globalX - chunk.x * this.chunkSize;
    const localZ = globalZ - chunk.z * this.chunkSize;
    if (localX < 0 || localX >= chunk.size || localZ < 0 || localZ >= chunk.size) return null;
    if (globalY < 0 || globalY >= chunk.maxHeight) return null;
    return chunk.getVoxel(localX, globalY, localZ);
  }
}
