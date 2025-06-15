import * as THREE from 'three';
import { ChunkManager } from '../world/ChunkManager';
import { VoxelType } from '../world/TerrainGenerator';

interface Node {
  pos: THREE.Vector3;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
}

export class Pathfinder {
  constructor(private chunkManager: ChunkManager) {}

  private key(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  public isWalkable(x: number, y: number, z: number): boolean {
    const ground = this.chunkManager.getVoxelType(x, y - 1, z);
    if (ground === null || ground === VoxelType.AIR) return false;
    const head = this.chunkManager.getVoxelType(x, y, z);
    const above = this.chunkManager.getVoxelType(x, y + 1, z);
    return (head === null || head === VoxelType.AIR) && (above === null || above === VoxelType.AIR);
  }

  public findPath(start: THREE.Vector3, goal: THREE.Vector3, maxSteps = 2048): THREE.Vector3[] {
    const sx = Math.floor(start.x);
    const sy = Math.floor(start.y);
    const sz = Math.floor(start.z);
    const gx = Math.floor(goal.x);
    const gy = Math.floor(goal.y);
    const gz = Math.floor(goal.z);

    const startNode: Node = {
      pos: new THREE.Vector3(sx, sy, sz),
      g: 0,
      h: 0,
      f: 0,
      parent: null
    };

    startNode.h = Math.abs(gx - sx) + Math.abs(gy - sy) + Math.abs(gz - sz);
    startNode.f = startNode.h;

    const open: Node[] = [startNode];
    const cost = new Map<string, number>();
    cost.set(this.key(sx, sy, sz), 0);
    let targetNode: Node | null = null;

    const dirs = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1)
    ];

    while (open.length > 0 && maxSteps-- > 0) {
      // Find node with lowest f without sorting entire array
      let currentIndex = 0;
      for (let i = 1; i < open.length; i++) {
        if (open[i].f < open[currentIndex].f) currentIndex = i;
      }
      const current = open.splice(currentIndex, 1)[0];

      if (current.pos.x === gx && current.pos.y === gy && current.pos.z === gz) {
        targetNode = current;
        break;
      }

      for (const d of dirs) {
        for (let dy = -1; dy <= 1; dy++) {
          const nx = current.pos.x + d.x;
          const ny = current.pos.y + dy;
          const nz = current.pos.z + d.z;
          if (Math.abs(ny - current.pos.y) > 1) continue;
          if (!this.isWalkable(nx, ny, nz)) continue;

          const k = this.key(nx, ny, nz);
          const newG = current.g + 1;
          const existing = cost.get(k);
          if (existing !== undefined && existing <= newG) continue;

          const h = Math.abs(gx - nx) + Math.abs(gy - ny) + Math.abs(gz - nz);
          const node: Node = {
            pos: new THREE.Vector3(nx, ny, nz),
            g: newG,
            h,
            f: newG + h,
            parent: current
          };
          cost.set(k, newG);
          open.push(node);
        }
      }
    }

    const path: THREE.Vector3[] = [];
    if (targetNode) {
      let n: Node | null = targetNode;
      while (n) {
        path.push(n.pos.clone());
        n = n.parent;
      }
      path.reverse();
    }
    return path;
  }
}
