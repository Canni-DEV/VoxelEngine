import * as THREE from 'three';
import { World } from '../world/World';
import { processCollisionsAndEnvironment } from '../world/Physics';
import { Renderer } from '../graphics/Renderer';

export class Player {
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public camera: THREE.PerspectiveCamera;
  public renderer: Renderer;
  public flying: boolean = false;
  public onFloor: boolean = false;
  public onWater: boolean = false;

  private world: World;
  private readonly gravity: number = 25;
  private readonly gravityWaterFactor: number = 0.1;

  private readonly colliderHalfWidth: number = 0.3;
  private readonly colliderHeight: number = 1.6;
  private readonly maxVerticalVelocity: number = 50;
  private readonly epsilon: number = 0.001;

  private flashlight: THREE.SpotLight | null = null;
  private playing: boolean = false;

  // Vector temporal para reutilizar en cálculos
  private tempVec: THREE.Vector3 = new THREE.Vector3();

  constructor(renderer: Renderer, world: World) {
    this.createFlashLight(renderer.camera);
    this.camera = renderer.camera;
    this.renderer = renderer;
    this.world = world;
    this.world.onNight = this.enableFlashlight.bind(this);
    this.world.onDay = this.disableFlashlight.bind(this);
    this.position = new THREE.Vector3(0, 250, 0);
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
    this.position.copy(this.world.getClosestFreePosition(new THREE.Vector3(0, 0, 0)));
  }

  public update(delta: number) {
    if (!this.world.isWorldLoaded()) return;

    if (!this.playing) {
      this.spawnStart();
      this.playing = true;
    }

    if (!this.flying) {
      const gravityFactor = this.onWater ? this.gravityWaterFactor : 1;
      // Aplicar gravedad con integración delta
      this.velocity.y -= this.gravity * gravityFactor * delta;
      this.velocity.y = Math.max(
        Math.min(this.velocity.y, this.maxVerticalVelocity * gravityFactor),
        -this.maxVerticalVelocity * gravityFactor
      );
    } else {
      this.velocity.y = 0;
    }

    // Actualizar la posición utilizando delta time (movimiento uniforme)
    this.position.addScaledVector(this.velocity, delta);

    // Combinar resolución de colisiones y actualización ambiental en un solo proceso.
    if (!this.flying) {
      const maxIterations = 10;
      let iterations = 0;
      while (iterations < maxIterations) {
        const res = processCollisionsAndEnvironment(
          this.position,
          this.velocity,
          this.world.getLoadedChunks(),
          this.renderer,
          this.colliderHalfWidth,
          this.colliderHeight,
          this.epsilon,
          this.tempVec
        );
        this.onFloor = res.onFloor;
        this.onWater = res.onWater;
        if (!res.collided) break;
        iterations++;
      }
    }

    // Actualizar la posición de la cámara sin crear nuevos objetos
    this.camera.position.set(
      this.position.x,
      this.position.y + 1.5,
      this.position.z
    );
  }

}
