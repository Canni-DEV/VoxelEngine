import * as THREE from 'three';
import { Mob } from './Mob';

export class Zombie extends Mob {
  protected createMesh(): THREE.Object3D {
    const material = new THREE.MeshLambertMaterial({ color: 0x84c37c });

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
}
