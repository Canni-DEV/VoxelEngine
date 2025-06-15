import * as THREE from 'three';
import { Chunk } from './Chunk';
import { VoxelType } from './TerrainGenerator';
import { Renderer } from '../graphics/Renderer';

export interface Collider {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export function getCollider(
  position: THREE.Vector3,
  colliderHalfWidth: number,
  colliderHeight: number
): Collider {
  return {
    min: new THREE.Vector3(
      position.x - colliderHalfWidth,
      position.y,
      position.z - colliderHalfWidth
    ),
    max: new THREE.Vector3(
      position.x + colliderHalfWidth,
      position.y + colliderHeight,
      position.z + colliderHalfWidth
    )
  };
}

export function aabbIntersect(a: Collider, b: Collider): boolean {
  return (
    a.min.x < b.max.x &&
    a.max.x > b.min.x &&
    a.min.y < b.max.y &&
    a.max.y > b.min.y &&
    a.min.z < b.max.z &&
    a.max.z > b.min.z
  );
}

export interface CollisionResult {
  collided: boolean;
  onFloor: boolean;
  onWater: boolean;
}

export function processCollisionsAndEnvironment(
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  chunks: Chunk[],
  renderer: Renderer | null,
  colliderHalfWidth: number,
  colliderHeight: number,
  epsilon: number,
  tempVec: THREE.Vector3
): CollisionResult {
  let collisionResolved = false;
  let onFloor = false;
  let onWater = false;
  let waterShader = false;

  const collider = getCollider(position, colliderHalfWidth, colliderHeight);

  tempVec.set(position.x, position.y - 0.1, position.z);
  const footPos = tempVec;

  const chunkMin = new THREE.Vector3();
  const chunkMax = new THREE.Vector3();
  const blockMin = new THREE.Vector3();
  const blockMax = new THREE.Vector3();
  const blockAABB = { min: blockMin, max: blockMax };

  for (const chunk of chunks) {
    const chunkSize = chunk.size;
    const maxHeight = chunk.terrainData[0].length;
    chunkMin.set(chunk.x * chunkSize, 0, chunk.z * chunkSize);
    chunkMax.set(
      chunk.x * chunkSize + chunkSize,
      maxHeight,
      chunk.z * chunkSize + chunkSize
    );

    if (
      footPos.x >= chunkMin.x &&
      footPos.x < chunkMax.x &&
      footPos.y >= chunkMin.y &&
      footPos.y < chunkMax.y &&
      footPos.z >= chunkMin.z &&
      footPos.z < chunkMax.z
    ) {
      const localX = Math.floor(footPos.x - chunk.x * chunkSize);
      const localY = Math.floor(footPos.y);
      const localZ = Math.floor(footPos.z - chunk.z * chunkSize);
      if (
        localX >= 0 &&
        localX < chunkSize &&
        localY >= 0 &&
        localY < maxHeight &&
        localZ >= 0 &&
        localZ < chunkSize
      ) {
        const voxel = chunk.terrainData[localX][localY][localZ];
        if (voxel === VoxelType.WATER) {
          onWater = true;
          if (chunk.terrainData[localX][Math.floor(footPos.y + 1.5)][localZ]) {
            waterShader = true;
          }
        } else if (voxel !== 0) {
          const voxelUp = chunk.terrainData[localX][localY + 1][localZ];
          if (voxelUp === VoxelType.WATER) {
            onWater = true;
            if (chunk.terrainData[localX][Math.floor(footPos.y + 1.5)][localZ]) {
              waterShader = true;
            }
          }
          onFloor = true;
        }
      }
    }

    if (!aabbIntersect(collider, { min: chunkMin, max: chunkMax })) continue;

    const startI = Math.max(0, Math.floor(collider.min.x) - chunk.x * chunkSize);
    const endI = Math.min(chunkSize, Math.ceil(collider.max.x) - chunk.x * chunkSize);
    const startJ = Math.max(0, Math.floor(collider.min.y));
    const endJ = Math.min(maxHeight, Math.ceil(collider.max.y));
    const startK = Math.max(0, Math.floor(collider.min.z) - chunk.z * chunkSize);
    const endK = Math.min(chunkSize, Math.ceil(collider.max.z) - chunk.z * chunkSize);

    for (let i = startI; i < endI; i++) {
      for (let j = startJ; j < endJ; j++) {
        for (let k = startK; k < endK; k++) {
          if (chunk.terrainData[i][j][k] === 0 || chunk.terrainData[i][j][k] === VoxelType.WATER) continue;

          blockMin.set(
            chunk.x * chunkSize + i,
            j,
            chunk.z * chunkSize + k
          );
          blockMax.set(
            chunk.x * chunkSize + i + 1,
            j + 1,
            chunk.z * chunkSize + k + 1
          );

          if (!aabbIntersect(collider, blockAABB)) continue;

          const overlapX = Math.min(collider.max.x - blockMin.x, blockMax.x - collider.min.x);
          const overlapY = Math.min(collider.max.y - blockMin.y, blockMax.y - collider.min.y);
          const overlapZ = Math.min(collider.max.z - blockMin.z, blockMax.z - collider.min.z);
          const minOverlap = Math.min(overlapX, overlapY, overlapZ);
          if (minOverlap < epsilon) continue;

          if (minOverlap === overlapX) {
            if (position.x < (blockMin.x + blockMax.x) / 2) {
              position.x = blockMin.x - colliderHalfWidth;
            } else {
              position.x = blockMax.x + colliderHalfWidth;
            }
            collisionResolved = true;
            break;
          } else if (minOverlap === overlapY) {
            if (position.y < (blockMin.y + blockMax.y) / 2) {
              position.y = blockMin.y - colliderHeight;
            } else {
              position.y = blockMax.y;
            }
            velocity.y = 0;
            collisionResolved = true;
            break;
          } else {
            if (position.z < (blockMin.z + blockMax.z) / 2) {
              position.z = blockMin.z - colliderHalfWidth;
            } else {
              position.z = blockMax.z + colliderHalfWidth;
            }
            collisionResolved = true;
            break;
          }
        }
        if (collisionResolved) break;
      }
      if (collisionResolved) break;
    }
    if (collisionResolved) break;
  }

  if (renderer) {
    renderer.waterShader.enabled = waterShader;
  }

  return { collided: collisionResolved, onFloor, onWater };
}
