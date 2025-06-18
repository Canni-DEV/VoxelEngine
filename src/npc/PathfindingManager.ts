import * as THREE from 'three';
import { Pathfinder } from './Pathfinder';
import { ChunkManager } from '../world/ChunkManager';

interface PathRequest {
  start: THREE.Vector3;
  goal: THREE.Vector3;
  resolve: (path: THREE.Vector3[]) => void;
  reject: (err?: any) => void;
}

export class PathfindingManager {
  private queue: PathRequest[] = [];
  private processing: boolean = false;
  private pathfinder: Pathfinder;

  constructor(chunkManager: ChunkManager) {
    this.pathfinder = new Pathfinder(chunkManager);
  }

  public isWalkable(x: number, y: number, z: number): boolean {
    return this.pathfinder.isWalkable(x, y, z);
  }

  public requestPath(start: THREE.Vector3, goal: THREE.Vector3): Promise<THREE.Vector3[]> {
    return new Promise((resolve, reject) => {
      this.queue.push({ start: start.clone(), goal: goal.clone(), resolve, reject });
    });
  }

  public update(): void {
    if (this.processing || this.queue.length === 0) return;

    const { start, goal, resolve, reject } = this.queue.shift()!;
    this.processing = true;
    try {
      const path = this.pathfinder.findPath(start, goal);
      if (path === null) {
        // retry later when chunks load
        this.queue.push({ start, goal, resolve, reject });
      } else {
        resolve(path);
      }
    } catch (err) {
      reject(err);
    } finally {
      this.processing = false;
    }
  }
}
