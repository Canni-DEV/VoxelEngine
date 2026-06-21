import * as THREE from 'three';
import { Zombie } from './Zombie';
import { World } from '../world/World';
import { ChunkManager } from '../world/ChunkManager';
import { PathfindingManager } from './PathfindingManager';

const NIGHT_MOB_TARGET_COUNT = 5;
const MAX_ACTIVE_MOBS = 12;
const SPAWN_MIN_DIST = 12;
const SPAWN_MAX_DIST = 24;
const SPAWN_ATTEMPTS = 48;

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
    if (this.mobs.length >= MAX_ACTIVE_MOBS) return;
    const zombie = new Zombie(position, this.chunkManager, this.pathManager);
    this.mobs.push(zombie);
    this.world.scene.add(zombie.mesh);
  }

  private spawnNightMobs(playerPos: THREE.Vector3) {
    for (let i = 0; i < NIGHT_MOB_TARGET_COUNT && this.mobs.length < MAX_ACTIVE_MOBS; i++) {
      const pos = this.findSpawnPositionNearPlayer(playerPos);
      if (pos) this.spawnZombie(pos);
    }
  }

  private findSpawnPositionNearPlayer(playerPos: THREE.Vector3): THREE.Vector3 | null {
    for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = SPAWN_MIN_DIST + Math.random() * (SPAWN_MAX_DIST - SPAWN_MIN_DIST);
      const x = Math.floor(playerPos.x + Math.cos(angle) * distance);
      const z = Math.floor(playerPos.z + Math.sin(angle) * distance);
      if (!this.chunkManager.isChunkLoadedAtWorldXZ(x, z)) continue;
      const feet = this.chunkManager.getSurfaceWalkableFeet(x, z);
      if (feet) return feet;
    }
    return null;
  }

  private clearMobs() {
    this.pathManager.clearQueue();
    for (const m of this.mobs) {
      m.dispose();
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
