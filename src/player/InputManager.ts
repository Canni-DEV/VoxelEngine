import * as THREE from 'three';
import { Chunk } from '../world/Chunk';
import { VoxelType } from '../world/TerrainGenerator';
import { ChunkManager } from '../world/ChunkManager';

export class InputManager {
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private raycaster: THREE.Raycaster;
  private selectionIndicator: THREE.Mesh;
  private chunkManager: ChunkManager;

  constructor(camera: THREE.PerspectiveCamera, scene: THREE.Scene, chunkManager: ChunkManager) {
    this.camera = camera;
    this.scene = scene;
    this.chunkManager = chunkManager;
    this.raycaster = new THREE.Raycaster();

    // Crear el indicador visual: un plano semitransparente amarillo.
    const indicatorGeometry = new THREE.PlaneGeometry(0.1, 0.1);
    const indicatorMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      opacity: 0.2,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false
    });
    this.selectionIndicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    this.selectionIndicator.visible = false;
    this.scene.add(this.selectionIndicator);

    window.addEventListener('mousedown', this.onMouseDown.bind(this), false);
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  public DrawIndicator() {
    const center = new THREE.Vector2(0, 0);
    this.raycaster.setFromCamera(center, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    if (intersects.length === 0) {
      this.selectionIndicator.visible = false;
      return;
    }
    const intersection = intersects[0];
    const faceNormal = intersection.face?.normal;
    if (!faceNormal) {
      this.selectionIndicator.visible = false;
      return;
    }
    const indicatorPos = intersection.point.clone().add(faceNormal.clone().multiplyScalar(0.01));
    this.selectionIndicator.position.copy(indicatorPos);
    const target = indicatorPos.clone().add(faceNormal);
    this.selectionIndicator.lookAt(target);
    this.selectionIndicator.visible = true;
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
      // this.DrawIndicator();
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
}
