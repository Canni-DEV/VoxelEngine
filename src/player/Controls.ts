import * as THREE from 'three';
import { Player } from './Player';
import { InputManager } from './InputManager';

export class Controls {
  private player: Player;
  private domElement: HTMLElement;
  private inputManager: InputManager;

  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;

  private moveUp = false;
  private moveDown = false;

  private jump = false;

  private pointerLocked = false;

  private yaw = 0;
  private pitch = 0;

  private speed = 6;
  private readonly jumpSpeed = 0.14;
  private readonly sensitivity = 0.002;

  private isTouching = false;
  private lastTouchX = 0;
  private lastTouchY = 0;

  constructor(player: Player, domElement: HTMLElement, inputManager: InputManager) {
    this.player = player;
    this.domElement = domElement;
    this.inputManager = inputManager;

    this.init();

    if ('DeviceOrientationEvent' in window) {
      this.enableDeviceOrientation();
    } else {
      if ('ontouchstart' in window) {
        this.addTouchControls();
      }
    }
    if ('ontouchstart' in window) {
      this.createMobileUI();
    }
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
          this.moveUp = true;
        } else {
          this.jump = true;
        }
        break;

      case 'ShiftLeft':
        if (this.player.flying) {
          this.moveDown = true;
        }
        break;

      case 'KeyF':
        this.player.flying = !this.player.flying;
        if (this.player.flying) {
          this.speed = 30;
        } else {
          this.speed = 5;
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
    this.yaw -= event.movementX * this.sensitivity;
    this.pitch -= event.movementY * this.sensitivity;
    this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
    this.player.camera.rotation.order = 'YXZ';
    this.player.camera.rotation.x = this.pitch;
    this.player.camera.rotation.y = this.yaw;
    this.player.camera.rotation.z = 0;
  }

  private addTouchControls() {
    this.domElement.addEventListener('touchstart', (e) => this.onTouchStart(e), false);
    this.domElement.addEventListener('touchmove', (e) => this.onTouchMove(e), false);
    this.domElement.addEventListener('touchend', (e) => this.onTouchEnd(e), false);
  }

  private onTouchStart(event: TouchEvent) {
    if (event.touches.length === 1) {
      this.isTouching = true;
      this.lastTouchX = event.touches[0].clientX;
      this.lastTouchY = event.touches[0].clientY;
    }
  }

  private onTouchMove(event: TouchEvent) {
    if (!this.isTouching || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - this.lastTouchX;
    const deltaY = touch.clientY - this.lastTouchY;
    this.lastTouchX = touch.clientX;
    this.lastTouchY = touch.clientY;
    this.yaw -= deltaX * this.sensitivity;
    this.pitch -= deltaY * this.sensitivity;
    this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
    this.player.camera.rotation.order = 'YXZ';
    this.player.camera.rotation.x = this.pitch;
    this.player.camera.rotation.y = this.yaw;
    this.player.camera.rotation.z = 0;
    event.preventDefault();
  }

  private onTouchEnd(event: TouchEvent) {
    this.isTouching = false;
  }

  private createMobileUI() {
    const dirContainer = document.createElement('div');
    dirContainer.id = 'mobile-dir-controls';
    Object.assign(dirContainer.style, {
      position: 'absolute',
      bottom: '20px',
      left: '20px',
      display: 'grid',
      gridTemplateColumns: '60px 60px 60px',
      gridTemplateRows: '60px 60px 60px',
      gap: '5px',
      zIndex: '1000'
    });
    const btnUp = this.createMobileButton('↑');
    btnUp.addEventListener('touchstart', (e) => { this.moveForward = true; e.preventDefault(); });
    btnUp.addEventListener('touchend', (e) => { this.moveForward = false; e.preventDefault(); });
    const btnDown = this.createMobileButton('↓');
    btnDown.addEventListener('touchstart', (e) => { this.moveBackward = true; e.preventDefault(); });
    btnDown.addEventListener('touchend', (e) => { this.moveBackward = false; e.preventDefault(); });
    const btnLeft = this.createMobileButton('←');
    btnLeft.addEventListener('touchstart', (e) => { this.moveLeft = true; e.preventDefault(); });
    btnLeft.addEventListener('touchend', (e) => { this.moveLeft = false; e.preventDefault(); });
    const btnRight = this.createMobileButton('→');
    btnRight.addEventListener('touchstart', (e) => { this.moveRight = true; e.preventDefault(); });
    btnRight.addEventListener('touchend', (e) => { this.moveRight = false; e.preventDefault(); });
    const empty = this.createMobileButton('');
    empty.style.visibility = 'hidden';
    dirContainer.appendChild(empty);
    dirContainer.appendChild(btnUp);
    dirContainer.appendChild(empty.cloneNode());
    dirContainer.appendChild(btnLeft);
    dirContainer.appendChild(empty.cloneNode());
    dirContainer.appendChild(btnRight);
    dirContainer.appendChild(empty.cloneNode());
    dirContainer.appendChild(btnDown);
    dirContainer.appendChild(empty.cloneNode());
    document.body.appendChild(dirContainer);

    const actionContainer = document.createElement('div');
    actionContainer.id = 'mobile-action-controls';
    Object.assign(actionContainer.style, {
      position: 'absolute',
      bottom: '20px',
      right: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      zIndex: '1000'
    });
    const btnActionLeft = this.createMobileButton('S');
    btnActionLeft.addEventListener('touchstart', (e) => { this.handleActionLeft(); e.preventDefault(); });
    const btnActionRight = this.createMobileButton('D');
    btnActionRight.addEventListener('touchstart', (e) => { this.handleActionRight(); e.preventDefault(); });
    const btnActionJump = this.createMobileButton('J');
    btnActionJump.addEventListener('touchstart', (e) => { this.jump = true; e.preventDefault(); });
    actionContainer.appendChild(btnActionLeft);
    actionContainer.appendChild(btnActionRight);
    actionContainer.appendChild(btnActionJump);
    document.body.appendChild(actionContainer);
  }

  private createMobileButton(text: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.innerText = text;
    Object.assign(btn.style, {
      width: '60px',
      height: '60px',
      fontSize: '24px',
      borderRadius: '10px',
      border: 'none',
      background: 'rgba(0, 0, 0, 0.5)',
      color: 'white',
      textAlign: 'center',
      userSelect: 'none'
    });
    return btn;
  }

  private handleActionLeft() {
    this.inputManager.SetVoxel();
  }

  private handleActionRight() {
    this.inputManager.DeleteVoxel();
  }

  private enableDeviceOrientation() {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      // @ts-ignore
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      // @ts-ignore
      DeviceOrientationEvent.requestPermission()
        // @ts-ignore
        .then((response) => {
          if (response === "granted") {
            // Una vez concedido el permiso, ya puedes agregar el listener
            window.addEventListener(
              "deviceorientation",
              this.onDeviceOrientation.bind(this),
              false
            );
          } else {
            console.warn("Permiso de orientación denegado.");
          }
        })
        .catch(console.error);
    } else {
      window.addEventListener(
        "deviceorientation",
        this.onDeviceOrientation.bind(this),
        false
      );
    }
  }

  private onDeviceOrientation(event: DeviceOrientationEvent) {
    if (event.alpha === null || event.beta === null || event.gamma === null) return;

    const alpha = THREE.MathUtils.degToRad(event.alpha);
    const beta = THREE.MathUtils.degToRad(event.beta);
    const gamma = THREE.MathUtils.degToRad(event.gamma);
    const orient = window.orientation ? THREE.MathUtils.degToRad(window.orientation) : 0;

    const zee = new THREE.Vector3(0, 0, 1);
    const euler = new THREE.Euler();
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
    euler.set(beta, alpha, -gamma, 'YXZ');
    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    quaternion.multiply(q1);
    const q2 = new THREE.Quaternion().setFromAxisAngle(zee, -orient);
    quaternion.multiply(q2);

    this.player.camera.quaternion.copy(quaternion);

    const euler2 = new THREE.Euler(0, 0, 0, 'YXZ');
    euler2.setFromQuaternion(quaternion, 'YXZ');
    this.yaw = euler2.y;
    this.pitch = euler2.x;
  }

  public update(delta: number) {
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    if (this.moveForward) this.player.position.addScaledVector(forward, -this.speed * delta);
    if (this.moveBackward) this.player.position.addScaledVector(forward, this.speed * delta);
    if (this.moveLeft) this.player.position.addScaledVector(right, this.speed * delta);
    if (this.moveRight) this.player.position.addScaledVector(right, -this.speed * delta);
    if (this.player.flying) {
      if (this.moveUp) this.player.position.y += this.speed * delta;
      if (this.moveDown) this.player.position.y -= this.speed * delta;
    } else {
      if (this.jump && (this.player.onFloor || this.player.onWater)) {
        this.player.velocity.y = this.jumpSpeed;
        this.jump = false;
      }
    }
  }
}
