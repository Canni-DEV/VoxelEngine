import * as THREE from 'three';
import { Chunk } from './Chunk';
import { TerrainGenerator } from './TerrainGenerator';

export class ChunkManager {
  private scene: THREE.Scene;
  private chunks: Map<string, Chunk>;
  private modifiedChunks: Map<string, Chunk>;
  public chunkSize: number = 16;
  private renderDistance: number = 10;
  private renderDistanceDelete: number = 12;
  private terrainGenerator: TerrainGenerator;
  private loadingChunks: boolean = false;
  private loadingChunksKeys: THREE.Vector2[] = [];

  private lastChunkX: number = Infinity;
  private lastChunkZ: number = Infinity;

  private deleteCounter: number = 10;
  private loadCounter: number = 5;

  private firstChunksLoaded: boolean = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.chunks = new Map();
    this.modifiedChunks = new Map();
    this.terrainGenerator = new TerrainGenerator("CanniWorld");
  }

  public update(playerPosition: THREE.Vector3) {
    this.updateShaders();

    const currentChunkX = Math.floor(playerPosition.x / this.chunkSize);
    const currentChunkZ = Math.floor(playerPosition.z / this.chunkSize);

    if (currentChunkX !== this.lastChunkX || currentChunkZ !== this.lastChunkZ) {
      this.getChunksToLoad(currentChunkX, currentChunkZ);
      if (--this.deleteCounter <= 0) {
        this.deleteChunks(currentChunkX, currentChunkZ);
        this.deleteCounter = 5;
      }
      this.lastChunkX = currentChunkX;
      this.lastChunkZ = currentChunkZ;
    }
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

  public worldLoaded(): boolean {
    return this.firstChunksLoaded;
  }

  private updateShaders() {
    //TODO: OPCION PASAR TIEMPO AL SHADER
    // const time = performance.now() / 1000;
    // this.chunks.forEach(chunk => {
    //   const material: any = chunk.mesh.material;
    //   if (material.userData.shader) {
    //     material.userData.shader.uniforms.uTime.value = time;
    //   }
    // });
  }

  private getChunksToLoad(currentChunkX: number, currentChunkZ: number) {
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
}
