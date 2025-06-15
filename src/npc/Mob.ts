import * as THREE from 'three';
import { ChunkManager } from '../world/ChunkManager';
import { PathfindingManager } from './PathfindingManager';
import { VoxelType } from '../world/TerrainGenerator';

export abstract class Mob {
  public position: THREE.Vector3;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public onFloor: boolean = false;
  public onWater: boolean = false;
  public mesh: THREE.Object3D;
  protected path: THREE.Vector3[] = [];
  protected pathIndex: number = 0;
  protected speed: number = 2;
  protected pathManager: PathfindingManager;
  protected pendingPath: Promise<void> | null = null;
  protected chunkManager: ChunkManager;
  protected timeSinceLastPath: number = 0;
  protected recomputeInterval: number = 0.5;

  // Basic physics parameters
  protected readonly gravity: number = 25;
  protected readonly maxVerticalVelocity: number = 50;

  constructor(position: THREE.Vector3, chunkManager: ChunkManager, pathManager: PathfindingManager) {
    this.position = position.clone();
    this.chunkManager = chunkManager;
    this.pathManager = pathManager;
    this.mesh = this.createMesh();
    this.mesh.position.copy(this.position);
  }

  protected abstract createMesh(): THREE.Object3D;

  public update(delta: number, target: THREE.Vector3) {
    this.timeSinceLastPath += delta;

    if (
      (this.path.length === 0 ||
        this.pathIndex >= this.path.length ||
        this.timeSinceLastPath > this.recomputeInterval) &&
      !this.pendingPath
    ) {
      this.pendingPath = this.pathManager
        .requestPath(this.position, target)
        .then(path => {
          this.path = path;
          this.pathIndex = 0;
          this.pendingPath = null;
        })
        .catch(() => {
          this.pendingPath = null;
        });
      this.timeSinceLastPath = 0;
    }

    if (this.path.length > 0 && this.pathIndex < this.path.length) {
      const next = this.path[this.pathIndex];
      const dir = next.clone().sub(this.position);
      const dist = dir.length();
      if (dist < 0.01) {
        this.position.copy(next);
        this.mesh.position.copy(this.position);
        this.pathIndex++;
      } else {
        dir.normalize();
        const stepLength = Math.min(this.speed * delta, dist);
        const step = dir.multiplyScalar(stepLength);
        const newPos = this.position.clone().add(step);

        const fx = Math.floor(newPos.x);
        const fy = Math.floor(newPos.y);
        const fz = Math.floor(newPos.z);
        const ground = this.chunkManager.getVoxelType(fx, fy - 1, fz);
        const head = this.chunkManager.getVoxelType(fx, fy, fz);
        const above = this.chunkManager.getVoxelType(fx, fy + 1, fz);

        const nx = Math.floor(next.x);
        const ny = Math.floor(next.y);
        const nz = Math.floor(next.z);

        const walkableStep =
          ground !== null &&
          ground !== VoxelType.AIR &&
          head === VoxelType.AIR &&
          above === VoxelType.AIR;

        if (walkableStep && this.pathManager.isWalkable(nx, ny, nz)) {
          // Pathfinding already ensures there are no obstacles ahead.
          this.velocity.copy(step);
          this.position.copy(newPos);
          this.mesh.position.copy(this.position);
        } else {
          // force a new path on next frame
          this.path = [];
          this.pathIndex = 0;
        }
      }
    }

    // Simple ground verification to simulate gravity
    const below = this.chunkManager.getVoxelType(
      Math.floor(this.position.x),
      Math.floor(this.position.y) - 1,
      Math.floor(this.position.z)
    );

    if (below === null || below === VoxelType.AIR) {
      this.onFloor = false;
      this.velocity.y -= this.gravity * delta;
      this.velocity.y = Math.max(
        Math.min(this.velocity.y, this.maxVerticalVelocity),
        -this.maxVerticalVelocity
      );
      this.position.y += this.velocity.y * delta;
    } else {
      this.onFloor = true;
      this.velocity.y = 0;
    }

    this.onWater =
      this.chunkManager.getVoxelType(
        Math.floor(this.position.x),
        Math.floor(this.position.y),
        Math.floor(this.position.z)
      ) === VoxelType.WATER;

    this.mesh.position.copy(this.position);
  }
}
