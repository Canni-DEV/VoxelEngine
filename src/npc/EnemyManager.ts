import * as THREE from 'three';
import { Zombie } from './Zombie';
import { World } from '../world/World';
import { ChunkManager } from '../world/ChunkManager';

export class EnemyManager {
  private enemies: Zombie[] = [];
  private world: World;
  private chunkManager: ChunkManager;

  constructor(world: World, chunkManager: ChunkManager) {
    this.world = world;
    this.chunkManager = chunkManager;
  }

  public spawnZombie(position: THREE.Vector3) {
    const zombie = new Zombie(position, this.chunkManager);
    this.enemies.push(zombie);
    this.world.scene.add(zombie.mesh);
  }

  public update(delta: number, playerPosition: THREE.Vector3) {
    for (const e of this.enemies) {
      e.update(delta, playerPosition);
    }
  }
}
