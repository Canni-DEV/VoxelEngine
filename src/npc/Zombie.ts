import * as THREE from 'three';
import { Mob } from './Mob';
import { ChunkManager } from '../world/ChunkManager';

export class Zombie extends Mob {
  private state: 'wandering' | 'chasing' = 'wandering';
  private spawnPoint: THREE.Vector3;
  private wanderTarget: THREE.Vector3 | null = null;
  private readonly detectRange = 10;
  private readonly wanderRadius = 5;

  constructor(position: THREE.Vector3, chunkManager: ChunkManager) {
    super(position, chunkManager);
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

  public update(delta: number, playerPos: THREE.Vector3) {
    const distToPlayer = this.position.distanceTo(playerPos);

    if (distToPlayer <= this.detectRange) {
      if (this.state !== 'chasing') {
        this.state = 'chasing';
        this.path = [];
        this.pathIndex = 0;
      }
      super.update(delta, playerPos);
      return;
    }

    if (this.state !== 'wandering') {
      this.state = 'wandering';
      this.wanderTarget = null;
      this.path = [];
      this.pathIndex = 0;
    }

    if (!this.wanderTarget || this.position.distanceTo(this.wanderTarget) < 1) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * this.wanderRadius;
      this.wanderTarget = this.spawnPoint.clone().add(
        new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist)
      );
      this.wanderTarget.y = this.spawnPoint.y;
      this.path = [];
      this.pathIndex = 0;
    }

    super.update(delta, this.wanderTarget);
  }
}
