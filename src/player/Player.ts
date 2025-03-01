import * as THREE from 'three';
import { World } from '../world/World';

export class Player {
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public camera: THREE.PerspectiveCamera;
  public flying: boolean = false;
  private world: World;
  private readonly gravity: number = 0.006;

  // Parámetros para el collider del jugador (AABB).
  // Se asume que la posición es la base (pies) del jugador.
  private readonly colliderHalfWidth: number = 0.25;
  private readonly colliderHeight: number = 1;

  // Umbral para ignorar solapamientos mínimos
  private readonly epsilon: number = 0.01;


  constructor(camera: THREE.PerspectiveCamera, world: World) {
    //TODO: linterna noche
    // const flashlight = new THREE.SpotLight(0xffffff, 1, 20, Math.PI / 5, 0.5, 2);
    // flashlight.position.set(0, 0, 0);
    // const targetObject = new THREE.Object3D();
    // targetObject.position.set(0, 0, -1);
    // camera.add(targetObject);
    // flashlight.target = targetObject;
    // camera.add(flashlight);

    this.camera = camera;
    this.world = world;
    this.position = new THREE.Vector3(0, 100, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.camera.position.copy(this.position);
  }


  public update() {
    if (!this.flying) {
      this.velocity.y -= this.gravity;
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

  // Calcula el AABB del jugador basado en su posición (se asume que la posición es la base).
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

  // Función auxiliar para detectar la intersección entre dos AABB.
  private aabbIntersect(a: { min: THREE.Vector3, max: THREE.Vector3 },
    b: { min: THREE.Vector3, max: THREE.Vector3 }): boolean {
    return (a.min.x < b.max.x && a.max.x > b.min.x) &&
      (a.min.y < b.max.y && a.max.y > b.min.y) &&
      (a.min.z < b.max.z && a.max.z > b.min.z);
  }

  // Resolver colisiones con bloques sólidos de los chunks cercanos.
  private resolveCollisions() {
    const collider = this.getCollider();
    const loadedChunks = this.world.getLoadedChunks();

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
            if (chunk.terrainData[i][j][k] === 0) continue; // Salta si es aire.
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
            } else if (minOverlap === overlapY) {
              // Resolución en Y.
              // Si el jugador está subiendo, ignoramos colisiones por debajo de la cabeza.
              if (this.velocity.y > 0 && collider.max.y - blockMin.y < this.epsilon * 2) {
                // Es un falso positivo por el ajuste del salto; no se resuelve.
                continue;
              }
              if (this.position.y < (blockMin.y + blockMax.y) / 2) {
                this.position.y = blockMin.y;
                this.velocity.y = 0;

              } else {
                this.position.y = blockMax.y;
                this.velocity.y = 0;
              }
            } else {
              // Resolución en Z.
              if (this.position.z < (blockMin.z + blockMax.z) / 2) {
                this.position.z = blockMin.z - this.colliderHalfWidth;
              } else {
                this.position.z = blockMax.z + this.colliderHalfWidth;
              }
            }
          }
        }
      }
    }
  }
}
