import * as THREE from 'three';
import { ChunkManager } from '../world/ChunkManager';
import { Pathfinder } from './Pathfinder';

export abstract class Mob {
  public position: THREE.Vector3;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public mesh: THREE.Object3D;
  protected path: THREE.Vector3[] = [];
  protected pathIndex: number = 0;
  protected speed: number = 2;
  protected pathfinder: Pathfinder;
  protected chunkManager: ChunkManager;
  protected timeSinceLastPath: number = 0;
  protected recomputeInterval: number = 0.5;

  constructor(position: THREE.Vector3, chunkManager: ChunkManager) {
    this.position = position.clone();
    this.chunkManager = chunkManager;
    this.pathfinder = new Pathfinder(chunkManager);
    this.mesh = this.createMesh();
    this.mesh.position.copy(this.position);
  }

  protected abstract createMesh(): THREE.Object3D;

  public update(delta: number, target: THREE.Vector3) {
    this.timeSinceLastPath += delta;

    if (
      this.path.length === 0 ||
      this.pathIndex >= this.path.length ||
      this.timeSinceLastPath > this.recomputeInterval
    ) {
      this.path = this.pathfinder.findPath(this.position, target);
      this.pathIndex = 0;
      this.timeSinceLastPath = 0;
    }

    if (this.path.length > 0 && this.pathIndex < this.path.length) {
      const next = this.path[this.pathIndex];
      const dir = next.clone().sub(this.position);
      if (dir.lengthSq() < 0.01) {
        this.pathIndex++;
      } else {
        dir.normalize();
        const step = dir.multiplyScalar(this.speed * delta);
        const newPos = this.position.clone().add(step);
        const nx = Math.floor(newPos.x);
        const ny = Math.floor(newPos.y);
        const nz = Math.floor(newPos.z);

        if (this.pathfinder.isWalkable(nx, ny, nz)) {
          this.position.copy(newPos);
          this.mesh.position.copy(this.position);
        } else {
          // force a new path on next frame
          this.pathIndex = this.path.length;
        }
      }
    }
  }
}
