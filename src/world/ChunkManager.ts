import * as THREE from 'three';
import { Chunk } from './Chunk';
import { TerrainGenerator, VoxelType } from './TerrainGenerator';
import { TerrainConfig } from './TerrainConfig';

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
