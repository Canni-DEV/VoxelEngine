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

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.chunks = new Map();
    this.modifiedChunks = new Map();
    this.terrainGenerator = new TerrainGenerator();
  }

  update(playerPosition: THREE.Vector3) {
    this.chunks.forEach(chunk => {
      if ( (chunk.mesh.material as any).userData.shader ) {
        (chunk.mesh.material as any).userData.shader.uniforms.uTime.value = performance.now() / 1000;
      }
    });
   
    const currentChunkX = Math.floor(playerPosition.x / this.chunkSize);
    const currentChunkZ = Math.floor(playerPosition.z / this.chunkSize);

    // Cargar los chunks dentro de la distancia de renderizado
    for (let x = currentChunkX - this.renderDistance; x <= currentChunkX + this.renderDistance; x++) {
      for (let z = currentChunkZ - this.renderDistance; z <= currentChunkZ + this.renderDistance; z++) {
        const key = `${x},${z}`;

        if (!this.chunks.has(key)) {
          let chunk: Chunk;
          if (this.modifiedChunks.has(key)) {
            chunk = this.modifiedChunks.get(key)!;
          } else {
            chunk = new Chunk(x, z, this.chunkSize, this.terrainGenerator);
          }
          this.scene.add(chunk.mesh);
          this.chunks.set(key, chunk);
        }
      }
    }

    for (const key of Array.from(this.chunks.keys())) {
      const [chunkX, chunkZ] = key.split(',').map(Number);
      if (Math.abs(chunkX - currentChunkX) > this.renderDistanceDelete || Math.abs(chunkZ - currentChunkZ) > this.renderDistanceDelete) {
        const chunk = this.chunks.get(key);
        if (chunk) {
          this.scene.remove(chunk.mesh);
          if (chunk.modified) {
            this.modifiedChunks.set(key, chunk);
          }
          chunk.Delete();
          this.chunks.delete(key);
        }
      }
    }
  }

  public getChunkAt(chunkX: number, chunkZ: number): Chunk | undefined {
    const key = `${chunkX},${chunkZ}`;
    if (this.chunks.has(key)) return this.chunks.get(key);
    if (this.modifiedChunks.has(key)) return this.modifiedChunks.get(key);
    return undefined;
  }

  public getLoadedChunks(): Chunk[] {
    return Array.from(this.chunks.values());
  }
}
