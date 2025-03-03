import * as THREE from 'three';
import { ChunkManager } from './ChunkManager';
import { Chunk } from './Chunk';

export class World {
  public scene: THREE.Scene;
  private chunkManager: ChunkManager;

  constructor(scene: THREE.Scene, chunkManager: ChunkManager) {
    this.scene = scene;
    this.chunkManager = chunkManager;
  }

  update(playerPosition: THREE.Vector3) {
    this.chunkManager.update(playerPosition);
  }

  public getLoadedChunks(): Chunk[] {
    return this.chunkManager.getLoadedChunks();
  }

  public WorldLoaded():boolean{
    return this.chunkManager.worldLoaded();
  }
}
