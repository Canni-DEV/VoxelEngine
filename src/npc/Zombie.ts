import * as THREE from 'three';
import { Enemy } from './Enemy';
import { ChunkManager } from '../world/ChunkManager';

export class Zombie extends Enemy {
  protected createMesh(): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
    const material = new THREE.MeshLambertMaterial({ color: 0x84c37c });
    return new THREE.Mesh(geometry, material);
  }
}
