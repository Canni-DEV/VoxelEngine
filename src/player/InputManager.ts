import * as THREE from 'three';
import { VoxelType } from '../world/TerrainGenerator';
import { ChunkManager } from '../world/ChunkManager';

export class InputManager {
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private raycaster: THREE.Raycaster;
  private chunkManager: ChunkManager;

  constructor(
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    chunkManager: ChunkManager
  ) {
    this.camera = camera;
    this.scene = scene;
    this.chunkManager = chunkManager;
    this.raycaster = new THREE.Raycaster();

    window.addEventListener('mousedown', this.onMouseDown.bind(this), false);
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  public SetVoxel(): void {
    const intersection = this.raycastCenter();
    if (!intersection) return;

    const voxelCoords = this.getVoxelCoordinates(intersection);
    const faceNormal = intersection.face?.normal.clone();
    if (!faceNormal) return;
    const addCoords = this.getAdditionCoordinates(voxelCoords, faceNormal);
    if (this.checkPlayerPosition(addCoords.x, addCoords.y, addCoords.z)) return;

    const addData = this.getChunkAndLocalCoords(
      addCoords.x,
      addCoords.y,
      addCoords.z
    );
    if (!addData) return;
    if (addData.chunk.terrainData[addData.localX][addCoords.y][addData.localZ] !== VoxelType.AIR)
      return;
    addData.chunk.updateVoxel(addData.localX, addCoords.y, addData.localZ, VoxelType.TRUNK);
  }

  public DeleteVoxel(): void {
    const intersection = this.raycastCenter();
    if (!intersection) return;

    const voxelCoords = this.getVoxelCoordinates(intersection);
    const targetData = this.getChunkAndLocalCoords(
      voxelCoords.x,
      voxelCoords.y,
      voxelCoords.z
    );
    if (!targetData) return;
    targetData.chunk.updateVoxel(targetData.localX, voxelCoords.y, targetData.localZ, VoxelType.AIR);
  }

  private onMouseDown(event: MouseEvent): void {
    event.preventDefault();
    const intersection = this.raycastCenter();
    if (!intersection) return;
    const voxelCoords = this.getVoxelCoordinates(intersection);
    const targetData = this.getChunkAndLocalCoords(
      voxelCoords.x,
      voxelCoords.y,
      voxelCoords.z
    );
    if (!targetData) return;

    if (event.button === 0) { // Botón izquierdo: eliminar voxel
      targetData.chunk.updateVoxel(targetData.localX, voxelCoords.y, targetData.localZ, VoxelType.AIR);
    } else if (event.button === 2) { // Botón derecho: agregar voxel
      const faceNormal = intersection.face?.normal.clone();
      if (!faceNormal) return;
      const addCoords = this.getAdditionCoordinates(voxelCoords, faceNormal);
      if (this.checkPlayerPosition(addCoords.x, addCoords.y, addCoords.z)) return;
      const addData = this.getChunkAndLocalCoords(addCoords.x, addCoords.y, addCoords.z);
      if (!addData) return;
      if (addData.chunk.terrainData[addData.localX][addCoords.y][addData.localZ] !== VoxelType.AIR)
        return;
      addData.chunk.updateVoxel(addData.localX, addCoords.y, addData.localZ, VoxelType.TRUNK);
    }
  }

  private raycastCenter(): THREE.Intersection | null {
    const center = new THREE.Vector2(0, 0);
    this.raycaster.setFromCamera(center, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    return intersects.length ? intersects[0] : null;
  }

  private getVoxelCoordinates(intersection: THREE.Intersection, epsilon: number = 0.1): THREE.Vector3 {
    const normal = intersection.face!.normal;
    return new THREE.Vector3(
      Math.floor(intersection.point.x - normal.x * epsilon),
      Math.floor(intersection.point.y - normal.y * epsilon),
      Math.floor(intersection.point.z - normal.z * epsilon)
    );
  }

  private getAdditionCoordinates(voxelCoords: THREE.Vector3, faceNormal: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(
      voxelCoords.x + Math.round(faceNormal.x),
      voxelCoords.y + Math.round(faceNormal.y),
      voxelCoords.z + Math.round(faceNormal.z)
    );
  }

  private getChunkAndLocalCoords(globalX: number, globalY: number, globalZ: number):
    { chunk: any, localX: number, localZ: number } | null {
    const chunkX = Math.floor(globalX / this.chunkManager.chunkSize);
    const chunkZ = Math.floor(globalZ / this.chunkManager.chunkSize);
    const chunk = this.chunkManager.getChunkAt(chunkX, chunkZ);
    if (!chunk) return null;
    const localX = globalX - chunk.x * chunk.size;
    const localZ = globalZ - chunk.z * chunk.size;
    if (localX < 0 || localX >= chunk.size || localZ < 0 || localZ >= chunk.size) return null;
    return { chunk, localX, localZ };
  }

  private checkPlayerPosition(addGlobalX: number, addGlobalY: number, addGlobalZ: number): boolean {
    const playerVoxelX = Math.floor(this.camera.position.x);
    const playerVoxelY = Math.floor(this.camera.position.y - 1.5);
    const playerVoxelZ = Math.floor(this.camera.position.z);
    return (addGlobalX === playerVoxelX &&
            addGlobalY === playerVoxelY &&
            addGlobalZ === playerVoxelZ) ||
           (addGlobalX === playerVoxelX &&
            addGlobalY === playerVoxelY + 1 &&
            addGlobalZ === playerVoxelZ);
  }
}
