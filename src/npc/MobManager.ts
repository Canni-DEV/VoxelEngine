import * as THREE from 'three';
import { Zombie } from './Zombie';
import { World } from '../world/World';
import { ChunkManager } from '../world/ChunkManager';
import { VoxelType } from '../world/TerrainGenerator';
import { PathfindingManager } from './PathfindingManager';

export class MobManager {
  private mobs: Zombie[] = [];
  private world: World;
  private chunkManager: ChunkManager;
  private pathManager: PathfindingManager;
  private spawned: boolean = false;

  constructor(world: World, chunkManager: ChunkManager) {
    this.world = world;
    this.chunkManager = chunkManager;
    this.pathManager = new PathfindingManager(chunkManager);
  }

  public spawnZombie(position: THREE.Vector3) {
    const zombie = new Zombie(position, this.chunkManager, this.pathManager);
    this.mobs.push(zombie);
    this.world.scene.add(zombie.mesh);
  }

  private spawnNightMobs(playerPos: THREE.Vector3) {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const pos = this.findSpawnPositionNearPlayer(playerPos);
      if (pos) this.spawnZombie(pos);
    }
  }

  private findSpawnPositionNearPlayer(playerPos: THREE.Vector3): THREE.Vector3 | null {
    for (let attempt = 0; attempt < 20; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 15 + Math.random() * 10; // alrededor de 20 bloques
      const x = Math.floor(playerPos.x + Math.cos(angle) * distance);
      const z = Math.floor(playerPos.z + Math.sin(angle) * distance);
      for (let y = 255; y > 0; y--) {
        const type = this.chunkManager.getVoxelType(x, y, z);
        if (type === null || type === VoxelType.AIR) continue;
        if (type === VoxelType.GRASS) {
          const head = this.chunkManager.getVoxelType(x, y + 1, z);
          const above = this.chunkManager.getVoxelType(x, y + 2, z);
          if (head === VoxelType.AIR && above === VoxelType.AIR) {
            return new THREE.Vector3(x + 0.5, y + 1, z + 0.5);
          }
        }
        break;
      }
    }
    return null;
  }

  private clearMobs() {
    for (const m of this.mobs) {
      this.world.scene.remove(m.mesh);
    }
    this.mobs = [];
  }

  public update(delta: number, playerPosition: THREE.Vector3) {
    this.pathManager.update();
    const isNight = this.world.isNight();
    if (isNight) {
      if (!this.spawned) {
        this.spawnNightMobs(playerPosition);
        this.spawned = true;
      }
    } else {
      if (this.mobs.length > 0) this.clearMobs();
      this.spawned = false;
    }

    for (const m of this.mobs) {
      m.update(delta, playerPosition);
    }
  }
}
