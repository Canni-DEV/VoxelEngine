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

  // Se actualiza el mundo en función de la posición del jugador
  update(playerPosition: THREE.Vector3) {
    this.chunkManager.update(playerPosition);
  }

  public getLoadedChunks(): Chunk[] {
    return this.chunkManager.getLoadedChunks();
  }
}
