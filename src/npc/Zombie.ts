import * as THREE from 'three';
import { Mob } from './Mob';
import { ChunkManager } from '../world/ChunkManager';
import { PathfindingManager } from './PathfindingManager';

export class Zombie extends Mob {
  private state: 'wandering' | 'chasing' = 'wandering';
  private spawnPoint: THREE.Vector3;
  private wanderTarget: THREE.Vector3 | null = null;
  private readonly detectRange = 10;
  private readonly loseRange = 16;
  private readonly wanderRadius = 5;
  private readonly speedWander = 1.8;
  private readonly speedChase = 2.8;

  constructor(position: THREE.Vector3, chunkManager: ChunkManager, pathManager: PathfindingManager) {
    super(position, chunkManager, pathManager);
    this.spawnPoint = position.clone();
  }

  protected createMesh(): THREE.Object3D {
    const material = new THREE.MeshLambertMaterial({
      color: 0xa4e38c,
      emissive: 0x335533,
      emissiveIntensity: 0.5
    });

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6), material);
    head.position.y = 1.6;

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), material);
    body.position.y = 1.0;

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.25), material);
    leftLeg.position.set(-0.15, 0.3, 0);

    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.25), material);
    rightLeg.position.set(0.15, 0.3, 0);

    const group = new THREE.Group();
    group.add(head, body, leftLeg, rightLeg);
    return group;
  }

  private pickWanderTarget(): void {
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * this.wanderRadius;
      const wx = Math.floor(this.spawnPoint.x + Math.cos(angle) * dist);
      const wz = Math.floor(this.spawnPoint.z + Math.sin(angle) * dist);
      if (!this.chunkManager.isChunkLoadedAtWorldXZ(wx, wz)) continue;
      const feet = this.chunkManager.getSurfaceWalkableFeet(wx, wz);
      if (feet) {
        this.wanderTarget = feet;
        this.path = [];
        this.pathIndex = 0;
        return;
      }
    }
    this.wanderTarget = this.spawnPoint.clone();
  }

  public update(delta: number, playerPos: THREE.Vector3) {
    const distToPlayer = this.position.distanceTo(playerPos);

    if (this.state === 'chasing') {
      if (distToPlayer > this.loseRange) {
        this.state = 'wandering';
        this.wanderTarget = null;
        this.path = [];
        this.pathIndex = 0;
      }
    } else if (distToPlayer <= this.detectRange) {
      this.state = 'chasing';
      this.path = [];
      this.pathIndex = 0;
    }

    if (this.state === 'chasing') {
      this.speed = this.speedChase;
      super.update(delta, playerPos, 'chase');
      return;
    }

    this.speed = this.speedWander;

    if (!this.wanderTarget || this.position.distanceTo(this.wanderTarget) < 1.1) {
      this.pickWanderTarget();
    }

    super.update(delta, this.wanderTarget!, 'wander');
  }
}
