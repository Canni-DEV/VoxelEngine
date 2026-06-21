import * as THREE from 'three';
import { Pathfinder, PathFindOptions } from './Pathfinder';
import { ChunkManager } from '../world/ChunkManager';

export type PathRequestMode = 'chase' | 'wander';

const PRIORITY: Record<PathRequestMode, number> = {
  chase: 100,
  wander: 10
};

const PATHS_PER_FRAME = 5;
const MAX_QUEUE_SIZE = 32;

interface QueuedPathRequest {
  start: THREE.Vector3;
  goal: THREE.Vector3;
  clientId: number;
  priority: number;
  order: number;
  findOptions: PathFindOptions;
  resolve: (path: THREE.Vector3[]) => void;
  reject: (err?: unknown) => void;
}

export class PathfindingManager {
  private queue: QueuedPathRequest[] = [];
  private pathfinder: Pathfinder;
  private orderCounter = 0;

  constructor(chunkManager: ChunkManager) {
    this.pathfinder = new Pathfinder(chunkManager);
  }

  public isWalkable(x: number, y: number, z: number): boolean {
    return this.pathfinder.isWalkable(x, y, z);
  }

  /**
   * clientId: por mob; reemplaza cualquier petición pendiente del mismo cliente.
   */
  public requestPath(
    start: THREE.Vector3,
    goal: THREE.Vector3,
    clientId: number,
    mode: PathRequestMode,
    findOptions?: PathFindOptions
  ): Promise<THREE.Vector3[]> {
    return new Promise((resolve, reject) => {
      this.queue = this.queue.filter(r => r.clientId !== clientId);
      const priority = PRIORITY[mode];
      const order = this.orderCounter++;
      const opts: PathFindOptions =
        mode === 'chase'
          ? { maxExpandSteps: 3200, maxTravelDistance: 44, ...findOptions }
          : { maxExpandSteps: 1600, maxTravelDistance: 28, ...findOptions };

      this.queue.push({
        start: start.clone(),
        goal: goal.clone(),
        clientId,
        priority,
        order,
        findOptions: opts,
        resolve,
        reject
      });

      if (this.queue.length > MAX_QUEUE_SIZE) {
        this.queue.sort((a, b) => a.priority - b.priority || a.order - b.order);
        while (this.queue.length > MAX_QUEUE_SIZE) {
          const dropped = this.queue.shift()!;
          dropped.reject(new Error('path_queue_overflow'));
        }
      }
    });
  }

  public update(): void {
    if (this.queue.length === 0) return;

    this.queue.sort((a, b) => b.priority - a.priority || a.order - b.order);

    let processed = 0;
    while (this.queue.length > 0 && processed < PATHS_PER_FRAME) {
      const job = this.queue.shift()!;
      try {
        const path = this.pathfinder.findPath(job.start, job.goal, job.findOptions);
        job.resolve(path);
      } catch (err) {
        job.reject(err);
      }
      processed++;
    }
  }

  public clearQueue(): void {
    for (const r of this.queue) {
      r.reject(new Error('cancelled'));
    }
    this.queue = [];
  }

  public cancelRequestsForClient(clientId: number): void {
    const kept: QueuedPathRequest[] = [];
    for (const r of this.queue) {
      if (r.clientId === clientId) {
        r.reject(new Error('cancelled'));
      } else {
        kept.push(r);
      }
    }
    this.queue = kept;
  }
}
