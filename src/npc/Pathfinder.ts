import * as THREE from 'three';
import { ChunkManager } from '../world/ChunkManager';
import { VoxelType } from '../world/TerrainGenerator';

interface Node {
  pos: THREE.Vector3;
  parent: Node | null;
}

export class Pathfinder {
  constructor(private chunkManager: ChunkManager) {}

  private key(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  private isWalkable(x: number, y: number, z: number): boolean {
    const ground = this.chunkManager.getVoxelType(x, y - 1, z);
    if (ground === null || ground === VoxelType.AIR) return false;
    const head = this.chunkManager.getVoxelType(x, y, z);
    const above = this.chunkManager.getVoxelType(x, y + 1, z);
    return (head === null || head === VoxelType.AIR) && (above === null || above === VoxelType.AIR);
  }

  public findPath(start: THREE.Vector3, goal: THREE.Vector3, maxSteps = 512): THREE.Vector3[] {
    const sx = Math.floor(start.x);
    const sy = Math.floor(start.y);
    const sz = Math.floor(start.z);
    const gx = Math.floor(goal.x);
    const gy = Math.floor(goal.y);
    const gz = Math.floor(goal.z);

    const open: Node[] = [{ pos: new THREE.Vector3(sx, sy, sz), parent: null }];
    const visited = new Set<string>();
    visited.add(this.key(sx, sy, sz));
    let targetNode: Node | null = null;

    while (open.length > 0 && maxSteps-- > 0) {
      const current = open.shift()!;
      if (current.pos.x === gx && current.pos.y === gy && current.pos.z === gz) {
        targetNode = current;
        break;
      }
      const dirs = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -1)
      ];
      for (const d of dirs) {
        for (let dy = -1; dy <= 1; dy++) {
          const nx = current.pos.x + d.x;
          const ny = current.pos.y + dy;
          const nz = current.pos.z + d.z;
          if (Math.abs(ny - current.pos.y) > 1) continue;
          const k = this.key(nx, ny, nz);
          if (visited.has(k)) continue;
          if (this.isWalkable(nx, ny, nz)) {
            visited.add(k);
            open.push({ pos: new THREE.Vector3(nx, ny, nz), parent: current });
          }
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
