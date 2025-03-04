import * as THREE from 'three';
import { VoxelType } from '../world/TerrainGenerator';
import { ChunkManager } from '../world/ChunkManager';

export class InputManager {
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private raycaster: THREE.Raycaster;
  private chunkManager: ChunkManager;

  constructor(camera: THREE.PerspectiveCamera, scene: THREE.Scene, chunkManager: ChunkManager) {
    this.camera = camera;
    this.scene = scene;
    this.chunkManager = chunkManager;
    this.raycaster = new THREE.Raycaster();

    window.addEventListener('mousedown', this.onMouseDown.bind(this), false);
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  public SetVoxel() {
    const center = new THREE.Vector2(0, 0);
    this.raycaster.setFromCamera(center, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    if (intersects.length === 0) return;
    const intersection = intersects[0];

    const epsilon = 0.1;
    const adjustedPoint = intersection.point.clone().sub(
      intersection.face!.normal.clone().multiplyScalar(epsilon)
    );
    const voxelX = Math.floor(adjustedPoint.x);
    const voxelY = Math.floor(adjustedPoint.y);
    const voxelZ = Math.floor(adjustedPoint.z);

    const targetChunkX = Math.floor(voxelX / this.chunkManager.chunkSize);
    const targetChunkZ = Math.floor(voxelZ / this.chunkManager.chunkSize);
    const targetChunk = this.chunkManager.getChunkAt(targetChunkX, targetChunkZ);
    if (!targetChunk) return;

    const faceNormal = intersection.face?.normal.clone();
    if (!faceNormal) return;
    const offsetX = Math.round(faceNormal.x);
    const offsetY = Math.round(faceNormal.y);
    const offsetZ = Math.round(faceNormal.z);
    const addGlobalX = voxelX + offsetX;
    const addGlobalY = voxelY + offsetY;
    const addGlobalZ = voxelZ + offsetZ;


    if (this.checkPlayerPosition(addGlobalX, addGlobalY, addGlobalZ))
      return;

    const addChunkX = Math.floor(addGlobalX / this.chunkManager.chunkSize);
    const addChunkZ = Math.floor(addGlobalZ / this.chunkManager.chunkSize);
    const addChunk = this.chunkManager.getChunkAt(addChunkX, addChunkZ);
    if (!addChunk) return;
    const addLocalX = addGlobalX - addChunk.x * addChunk.size;
    const addLocalZ = addGlobalZ - addChunk.z * addChunk.size;
    if (addLocalX < 0 || addLocalX >= addChunk.size || addLocalZ < 0 || addLocalZ >= addChunk.size) return;
    if (addChunk.terrainData[addLocalX][addGlobalY][addLocalZ] !== VoxelType.AIR) return;
    addChunk.updateVoxel(addLocalX, addGlobalY, addLocalZ, VoxelType.TRUNK);
  }

  public DeleteVoxel() {
    const center = new THREE.Vector2(0, 0);
    this.raycaster.setFromCamera(center, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    if (intersects.length === 0) return;
    const intersection = intersects[0];

    const epsilon = 0.1;
    const adjustedPoint = intersection.point.clone().sub(
      intersection.face!.normal.clone().multiplyScalar(epsilon)
    );
    const voxelX = Math.floor(adjustedPoint.x);
    const voxelY = Math.floor(adjustedPoint.y);
    const voxelZ = Math.floor(adjustedPoint.z);

    // Determinar las coordenadas globales del chunk objetivo.
    const targetChunkX = Math.floor(voxelX / this.chunkManager.chunkSize);
    const targetChunkZ = Math.floor(voxelZ / this.chunkManager.chunkSize);
    const targetChunk = this.chunkManager.getChunkAt(targetChunkX, targetChunkZ);
    if (!targetChunk) return;

    // Convertir a coordenadas locales dentro del chunk.
    const localX = voxelX - targetChunk.x * targetChunk.size;
    const localZ = voxelZ - targetChunk.z * targetChunk.size;

    targetChunk.updateVoxel(localX, voxelY, localZ, VoxelType.AIR);
  }

  private onMouseDown(event: MouseEvent) {
    event.preventDefault();
    const center = new THREE.Vector2(0, 0);
    this.raycaster.setFromCamera(center, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    if (intersects.length === 0) return;
    const intersection = intersects[0];

    const epsilon = 0.1;
    const adjustedPoint = intersection.point.clone().sub(
      intersection.face!.normal.clone().multiplyScalar(epsilon)
    );
    const voxelX = Math.floor(adjustedPoint.x);
    const voxelY = Math.floor(adjustedPoint.y);
    const voxelZ = Math.floor(adjustedPoint.z);

    // Determinar las coordenadas globales del chunk objetivo.
    const targetChunkX = Math.floor(voxelX / this.chunkManager.chunkSize);
    const targetChunkZ = Math.floor(voxelZ / this.chunkManager.chunkSize);
    const targetChunk = this.chunkManager.getChunkAt(targetChunkX, targetChunkZ);
    if (!targetChunk) return;

    // Convertir a coordenadas locales dentro del chunk.
    const localX = voxelX - targetChunk.x * targetChunk.size;
    const localZ = voxelZ - targetChunk.z * targetChunk.size;

    if (event.button === 0) {
      targetChunk.updateVoxel(localX, voxelY, localZ, VoxelType.AIR);
    } else if (event.button === 2) {
      const faceNormal = intersection.face?.normal.clone();
      if (!faceNormal) return;
      const offsetX = Math.round(faceNormal.x);
      const offsetY = Math.round(faceNormal.y);
      const offsetZ = Math.round(faceNormal.z);
      const addGlobalX = voxelX + offsetX;
      const addGlobalY = voxelY + offsetY;
      const addGlobalZ = voxelZ + offsetZ;

      if (this.checkPlayerPosition(addGlobalX, addGlobalY, addGlobalZ))
        return;

      const addChunkX = Math.floor(addGlobalX / this.chunkManager.chunkSize);
      const addChunkZ = Math.floor(addGlobalZ / this.chunkManager.chunkSize);
      const addChunk = this.chunkManager.getChunkAt(addChunkX, addChunkZ);
      if (!addChunk) return;
      const addLocalX = addGlobalX - addChunk.x * addChunk.size;
      const addLocalZ = addGlobalZ - addChunk.z * addChunk.size;
      if (addLocalX < 0 || addLocalX >= addChunk.size || addLocalZ < 0 || addLocalZ >= addChunk.size) return;
      if (addChunk.terrainData[addLocalX][addGlobalY][addLocalZ] !== VoxelType.AIR) return;
      addChunk.updateVoxel(addLocalX, addGlobalY, addLocalZ, VoxelType.TRUNK);
    }
  }

  // Evitar insertar en la posición del jugador
  // Se asume que la posición del jugador es la de la cámara menos 1.5 en Y (para bajar al nivel del cuerpo)
  private checkPlayerPosition(addGlobalX: number, addGlobalY: number, addGlobalZ: number) {
    const playerVoxelX = Math.floor(this.camera.position.x);
    const playerVoxelY = Math.floor(this.camera.position.y - 1.5);
    const playerVoxelZ = Math.floor(this.camera.position.z);
    return addGlobalX === playerVoxelX &&
      addGlobalY === playerVoxelY &&
      addGlobalZ === playerVoxelZ;
  }
}
