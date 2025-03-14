import * as THREE from 'three';
import { World } from '../world/World';
import { VoxelType } from '../world/TerrainGenerator';

export class Player {
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public camera: THREE.PerspectiveCamera;
  public flying: boolean = false;
  private world: World;
  private readonly gravity: number = 0.72;

  private readonly colliderHalfWidth: number = 0.3;
  private readonly colliderHeight: number = 1.6;
  private readonly maxVerticalVelocity: number = 0.4;

  private readonly epsilon: number = 0.001;

  private flashlight: THREE.SpotLight | null = null;

  private playing: boolean = false;

  constructor(camera: THREE.PerspectiveCamera, world: World) {
    this.createFlashLight(camera);
    this.camera = camera;
    this.world = world;
    this.world.onNight = this.enableFlashlight.bind(this);
    this.world.onDay = this.disableFlashlight.bind(this);
    this.position = new THREE.Vector3(0, 200, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.camera.position.copy(this.position);
  }

  private createFlashLight(camera: THREE.PerspectiveCamera) {
    if (!this.flashlight) {
      this.flashlight = new THREE.SpotLight(0xffffff, 0.2, 20, Math.PI / 5, 0.5, 2);
      this.flashlight.position.set(0, 0, 0);
      const targetObject = new THREE.Object3D();
      targetObject.position.set(0, 0, -1);
      camera.add(targetObject);
      this.flashlight.target = targetObject;
      camera.add(this.flashlight);
    }
  }

  private enableFlashlight(): void {
    if (this.flashlight) {
      this.flashlight.intensity = 1;
    }
  }

  private disableFlashlight(): void {
    if (this.flashlight) {
      this.flashlight.intensity = 0.2;
    }
  }

  public spawnStart() {
    this.position = this.world.getClosestFreePosition(new THREE.Vector3(0, 0, 0));
  }

  public update(delta: number) {
    if (!this.world.isWorldLoaded()) {
      return;
    }

    if (!this.playing) {
      this.spawnStart();
      this.playing = true;
    }

    if (!this.flying) {
      this.velocity.y -= this.gravity * delta; 
      this.velocity.y = Math.max(Math.min(this.velocity.y, this.maxVerticalVelocity), -this.maxVerticalVelocity);
    } else {
      this.velocity.y = 0;
    }

    this.position.add(this.velocity);

    if (!this.flying) {
      this.resolveCollisions();
    }

    this.camera.position.copy(new THREE.Vector3(
      this.position.x,
      this.position.y + 1.5,
      this.position.z
    ));
  }

  private getCollider(): { min: THREE.Vector3, max: THREE.Vector3 } {
    return {
      min: new THREE.Vector3(
        this.position.x - this.colliderHalfWidth,
        this.position.y,
        this.position.z - this.colliderHalfWidth
      ),
      max: new THREE.Vector3(
        this.position.x + this.colliderHalfWidth,
        this.position.y + this.colliderHeight,
        this.position.z + this.colliderHalfWidth
      )
    };
  }

  private aabbIntersect(a: { min: THREE.Vector3, max: THREE.Vector3 },
    b: { min: THREE.Vector3, max: THREE.Vector3 }): boolean {
    return (a.min.x < b.max.x && a.max.x > b.min.x) &&
      (a.min.y < b.max.y && a.max.y > b.min.y) &&
      (a.min.z < b.max.z && a.max.z > b.min.z);
  }

  private resolveCollisions() {
    const loadedChunks = this.world.getLoadedChunks();
    let collisionResolved = true;
    const maxIterations = 10;
    let iterations = 0;

    // Iterar hasta que no se detecten más colisiones o se alcance el límite de iteraciones.
    while (collisionResolved && iterations < maxIterations) {
      collisionResolved = false;
      const collider = this.getCollider();

      for (const chunk of loadedChunks) {
        const chunkSize = chunk.size;
        const maxHeight = chunk.terrainData[0].length;
        const chunkMin = new THREE.Vector3(chunk.x * chunkSize, 0, chunk.z * chunkSize);
        const chunkMax = new THREE.Vector3(chunk.x * chunkSize + chunkSize, maxHeight, chunk.z * chunkSize + chunkSize);

        // Si el AABB del chunk no intersecta con el collider del jugador, se salta.
        if (!this.aabbIntersect(collider, { min: chunkMin, max: chunkMax })) continue;

        // Calcular el rango de índices en el chunk que puedan colisionar.
        const startI = Math.max(0, Math.floor(collider.min.x) - chunk.x * chunkSize);
        const endI = Math.min(chunkSize, Math.ceil(collider.max.x) - chunk.x * chunkSize);
        const startJ = Math.max(0, Math.floor(collider.min.y));
        const endJ = Math.min(maxHeight, Math.ceil(collider.max.y));
        const startK = Math.max(0, Math.floor(collider.min.z) - chunk.z * chunkSize);
        const endK = Math.min(chunkSize, Math.ceil(collider.max.z) - chunk.z * chunkSize);

        for (let i = startI; i < endI; i++) {
          for (let j = startJ; j < endJ; j++) {
            for (let k = startK; k < endK; k++) {
              if (chunk.terrainData[i][j][k] === 0 || chunk.terrainData[i][j][k] === VoxelType.WATER) continue; // Salta si es aire.

              // Calcular el AABB del bloque (cada voxel es de 1x1x1).
              const blockMin = new THREE.Vector3(
                chunk.x * chunkSize + i,
                j,
                chunk.z * chunkSize + k
              );
              const blockMax = new THREE.Vector3(
                chunk.x * chunkSize + i + 1,
                j + 1,
                chunk.z * chunkSize + k + 1
              );
              const blockAABB = { min: blockMin, max: blockMax };

              if (!this.aabbIntersect(collider, blockAABB)) continue;

              // Calcular la penetración (overlap) en cada eje.
              const overlapX = Math.min(collider.max.x - blockMin.x, blockMax.x - collider.min.x);
              const overlapY = Math.min(collider.max.y - blockMin.y, blockMax.y - collider.min.y);
              const overlapZ = Math.min(collider.max.z - blockMin.z, blockMax.z - collider.min.z);

              // Seleccionar el eje de menor penetración.
              const minOverlap = Math.min(overlapX, overlapY, overlapZ);

              // Resolver solo si la penetración supera un pequeño umbral.
              if (minOverlap < this.epsilon) continue;

              // Resolver en el eje de menor solapamiento.
              if (minOverlap === overlapX) {
                // Resolución en X.
                if (this.position.x < (blockMin.x + blockMax.x) / 2) {
                  this.position.x = blockMin.x - this.colliderHalfWidth;
                } else {
                  this.position.x = blockMax.x + this.colliderHalfWidth;
                }
                collisionResolved = true;
                break;
              } else if (minOverlap === overlapY) {
                if (this.position.y < (blockMin.y + blockMax.y) / 2) {
                  this.position.y = blockMin.y - this.colliderHeight;

                } else {
                  this.position.y = blockMax.y;

                }
                this.velocity.y = 0;
                collisionResolved = true;
                break;
              } else {
                // Resolución en Z.
                if (this.position.z < (blockMin.z + blockMax.z) / 2) {
                  this.position.z = blockMin.z - this.colliderHalfWidth;
                } else {
                  this.position.z = blockMax.z + this.colliderHalfWidth;
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
      iterations++;
    }
  }
}
