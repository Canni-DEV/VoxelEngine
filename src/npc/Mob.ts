import * as THREE from 'three';
import { ChunkManager } from '../world/ChunkManager';
import { processCollisionsAndEnvironment } from '../world/Physics';
import { PathfindingManager, PathRequestMode } from './PathfindingManager';
import { VoxelType } from '../world/TerrainGenerator';

export abstract class Mob {
  private static nextPathClientId = 1;

  public readonly pathClientId: number;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public onFloor: boolean = false;
  public onWater: boolean = false;
  public mesh: THREE.Object3D;
  protected path: THREE.Vector3[] = [];
  protected pathIndex: number = 0;
  protected speed: number = 2;
  protected pathManager: PathfindingManager;
  protected pendingPath: Promise<void> | null = null;
  protected chunkManager: ChunkManager;
  protected timeSinceLastPath: number = 0;
  protected alive = true;
  protected pathRequestGeneration = 0;
  protected stepFailStreak = 0;

  private readonly maxStepFailStreak = 5;

  // Basic physics parameters
  protected readonly gravity: number = 25;
  protected readonly maxVerticalVelocity: number = 50;
  protected readonly floorSnapEpsilon: number = 0.2;

  // Collider aproximado del NPC. El sistema de colisiones del engine asume
  // que `position` es la coordenada del "pies" (abajo del collider).
  protected readonly colliderHalfWidth: number = 0.3;
  protected readonly colliderHeight: number = 1.8;
  protected readonly collisionEpsilon: number = 0.001;

  private tempVec: THREE.Vector3 = new THREE.Vector3();

  constructor(position: THREE.Vector3, chunkManager: ChunkManager, pathManager: PathfindingManager) {
    this.pathClientId = Mob.nextPathClientId++;
    this.position = position.clone();
    this.chunkManager = chunkManager;
    this.pathManager = pathManager;
    this.mesh = this.createMesh();
    this.mesh.position.copy(this.position);
  }

  protected abstract createMesh(): THREE.Object3D;

  private applyGravity(delta: number): void {
    const below = this.chunkManager.getVoxelType(
      Math.floor(this.position.x),
      Math.floor(this.position.y) - 1,
      Math.floor(this.position.z)
    );

    // Si el chunk aún no está cargado y no sabemos el voxel debajo, evitamos que el mob
    // "caiga a través" y termine solapado. Se congela verticalmente hasta que haya datos.
    if (below === null) {
      this.onFloor = true;
      this.velocity.y = 0;
      return;
    }

    if (below === VoxelType.AIR) {
      this.onFloor = false;
      this.velocity.y -= this.gravity * delta;
      this.velocity.y = Math.max(
        Math.min(this.velocity.y, this.maxVerticalVelocity),
        -this.maxVerticalVelocity
      );
      this.position.y += this.velocity.y * delta;
    } else {
      this.onFloor = true;
      this.velocity.y = 0;
    }
  }

  private resolveCollisions(): void {
    // Usamos solo chunks cargados. Si un mob entra en zona sin chunks cargados, el camino
    // debería degradarse (y con `applyGravity` congelamos verticalmente para evitar solapes).
    const chunks = this.chunkManager.getLoadedChunks();
    const result = processCollisionsAndEnvironment(
      this.position,
      this.velocity,
      chunks,
      null,
      this.colliderHalfWidth,
      this.colliderHeight,
      this.collisionEpsilon,
      this.tempVec
    );

    this.onFloor = result.onFloor;
    this.onWater = result.onWater;

    // Si quedó apoyado, garantizamos que el pie del collider no quede por debajo de la
    // superficie caminable calculada en esa columna. Esto reduce penetración vertical residual.
    if (result.onFloor) {
      const feet = this.chunkManager.getSurfaceWalkableFeet(this.position.x, this.position.z);
      if (feet && this.position.y < feet.y) {
        this.position.y = feet.y;
        this.velocity.y = 0;
      }
    }
  }

  public dispose(): void {
    this.alive = false;
    this.pathManager.cancelRequestsForClient(this.pathClientId);
    this.path = [];
    this.pathIndex = 0;
    this.pendingPath = null;
  }

  public update(delta: number, target: THREE.Vector3, pathMode: PathRequestMode) {
    if (!this.alive) return;

    const recomputeInterval = pathMode === 'chase' ? 0.35 : 0.85;
    this.timeSinceLastPath += delta;

    if (
      (this.path.length === 0 ||
        this.pathIndex >= this.path.length ||
        this.timeSinceLastPath > recomputeInterval) &&
      !this.pendingPath
    ) {
      this.pathRequestGeneration++;
      const gen = this.pathRequestGeneration;
      this.pendingPath = this.pathManager
        .requestPath(this.position, target, this.pathClientId, pathMode)
        .then(path => {
          if (!this.alive || gen !== this.pathRequestGeneration) {
            this.pendingPath = null;
            return;
          }
          this.path = path;
          this.pathIndex = 0;
          this.stepFailStreak = 0;
          this.pendingPath = null;
        })
        .catch(() => {
          if (!this.alive || gen !== this.pathRequestGeneration) {
            this.pendingPath = null;
            return;
          }
          this.pendingPath = null;
        });
      this.timeSinceLastPath = 0;
    }

    if (this.path.length > 0 && this.pathIndex < this.path.length) {
      const next = this.path[this.pathIndex];
      const horizontalDist = Math.hypot(next.x - this.position.x, next.z - this.position.z);

      // Avanzamos el waypoint principalmente por proximidad en XZ.
      // La altura se corrige por gravedad + colisiones, así evitamos bucles por diferencias pequeñas de Y.
      if (horizontalDist < 0.4) {
        this.position.x = next.x;
        this.position.z = next.z;
        this.pathIndex++;
        this.stepFailStreak = 0;
      } else {
        const move2D = new THREE.Vector3(next.x - this.position.x, 0, next.z - this.position.z);
        const dist2D = move2D.length();
        if (dist2D < 0.001) {
          this.pathIndex++;
          this.stepFailStreak = 0;
        } else {
          move2D.normalize();
          const stepLength = Math.min(this.speed * delta, dist2D);
          const step = move2D.multiplyScalar(stepLength);
          const newPos = this.position.clone().add(step);

          const feet = this.chunkManager.getSurfaceWalkableFeet(newPos.x, newPos.z);
          if (feet) {
            newPos.y = feet.y;
            this.stepFailStreak = 0;
          } else {
            // No frenamos horizontalmente: dejamos que gravedad + colisiones AABB resuelvan la Y.
            this.stepFailStreak++;
          }

          this.position.copy(newPos);
          if (this.stepFailStreak >= this.maxStepFailStreak) {
            this.path = [];
            this.pathIndex = 0;
            this.stepFailStreak = 0;
          }
        }
      }
    }

    // Movimiento vertical + corrección final mediante colisiones AABB.
    this.applyGravity(delta);
    this.resolveCollisions();

    this.mesh.position.copy(this.position);
  }
}
