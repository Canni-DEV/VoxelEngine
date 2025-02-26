import * as THREE from 'three';
import { Player } from './Player';

export class Controls {
  private player: Player;
  private domElement: HTMLElement;

  // Movimiento horizontal
  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;
  
  // Movimiento vertical (solo en modo vuelo)
  private moveUp = false;
  private moveDown = false;
  
  private pointerLocked = false;
  
  // Ángulos para la vista (en radianes)
  private yaw = 0;
  private pitch = 0;
  
  // Velocidades (ajustables)
  private speed = 0.07;
  private verticalSpeed = 0.02;
  private readonly jumpSpeed = 0.2;
  private readonly sensitivity = 0.002;

  constructor(player: Player, domElement: HTMLElement) {
    this.player = player;
    this.domElement = domElement;
    this.init();
  }

  private init() {
    document.addEventListener('keydown', (event) => this.onKeyDown(event), false);
    document.addEventListener('keyup', (event) => this.onKeyUp(event), false);
    this.domElement.addEventListener('click', () => this.domElement.requestPointerLock(), false);
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange(), false);
    document.addEventListener('mousemove', (event) => this.onMouseMove(event), false);
  }

  private onKeyDown(event: KeyboardEvent) {
    switch (event.code) {
      case 'KeyW': this.moveForward = true; break;
      case 'KeyS': this.moveBackward = true; break;
      case 'KeyA': this.moveLeft = true; break;
      case 'KeyD': this.moveRight = true; break;
      
      case 'Space':
        if (this.player.flying) {
          // En vuelo, Space eleva
          this.moveUp = true;
        } else {
          // En modo normal, Space salta (solo si está en el suelo)
            this.player.velocity.y = this.jumpSpeed; // velocidad de salto
        }
        break;
      
      case 'ShiftLeft':
        if (this.player.flying) {
          // En vuelo, Shift baja
          this.moveDown = true;
        }
        break;
      
      case 'KeyF':
        // Alterna entre modo vuelo y modo normal
        this.player.flying = !this.player.flying;
        if (this.player.flying)
        {
          this.speed = 1;
          this.verticalSpeed = 1;
        }
        else
        {
          this.speed = 0.06;
          this.verticalSpeed = 0.06;
        }
        this.player.velocity.y = 0;
        break;
    }
  }

  private onKeyUp(event: KeyboardEvent) {
    switch (event.code) {
      case 'KeyW': this.moveForward = false; break;
      case 'KeyS': this.moveBackward = false; break;
      case 'KeyA': this.moveLeft = false; break;
      case 'KeyD': this.moveRight = false; break;
      case 'Space': this.moveUp = false; break;
      case 'ShiftLeft': this.moveDown = false; break;
    }
  }

  private onPointerLockChange() {
    this.pointerLocked = document.pointerLockElement === this.domElement;
  }

  private onMouseMove(event: MouseEvent) {
    if (!this.pointerLocked) return;
  
    // Actualiza los ángulos según el movimiento del mouse
    // Nota: en muchos FPS se suma movementX para yaw y se resta movementY para pitch,
    // pero puedes ajustar según la orientación deseada.
    this.yaw -= event.movementX * this.sensitivity;
    this.pitch -= event.movementY * this.sensitivity;
  
    // Limitar el pitch para evitar mirar más allá de 90° hacia arriba o abajo
    this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
  
    // Establecer el orden de rotación a 'YXZ' para un control FPS adecuado
    this.player.camera.rotation.order = 'YXZ';
  
    // Aplicar la rotación: 
    // - yaw (alrededor del eje Y) para mirar de lado,
    // - pitch (alrededor del eje X) para mirar arriba/abajo.
    // Se deja el roll (eje Z) en 0 para evitar giros laterales inesperados.
    this.player.camera.rotation.x = this.pitch;
    this.player.camera.rotation.y = this.yaw;
    this.player.camera.rotation.z = 0;
  }
  

  public update() {
    // Calcular la dirección horizontal (basada en el yaw)
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    // Movimiento horizontal
    if (this.moveForward) this.player.position.addScaledVector(forward, -this.speed);
    if (this.moveBackward) this.player.position.addScaledVector(forward, this.speed);
    if (this.moveLeft) this.player.position.addScaledVector(right, this.speed);
    if (this.moveRight) this.player.position.addScaledVector(right, -this.speed);

    // Movimiento vertical (solo en modo vuelo)
    if (this.player.flying) {
      if (this.moveUp) {
        this.player.position.y += this.verticalSpeed;
      }
      if (this.moveDown) {
        this.player.position.y -= this.verticalSpeed;
      }
    }
  }
}
