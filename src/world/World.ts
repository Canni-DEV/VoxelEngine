import * as THREE from 'three';
import { ChunkManager } from './ChunkManager';
import { Chunk } from './Chunk';

export class World {
  public scene: THREE.Scene;
  private chunkManager: ChunkManager;

  constructor(scene: THREE.Scene, chunkManager: ChunkManager) {
    this.scene = scene;
    this.chunkManager = chunkManager;
  }

  // Se actualiza el mundo en función de la posición del jugador
  update(playerPosition: THREE.Vector3) {
    this.chunkManager.update(playerPosition);
  }

  public getLoadedChunks(): Chunk[] {
    return this.chunkManager.getLoadedChunks();
  }

  createStarSkysphere(radius: number, starCount: number): THREE.Mesh {
    // Crear una esfera con suficientes segmentos.
    const geometry = new THREE.SphereGeometry(radius, 128, 128);
    // Invertir las normales para que la textura se vea desde el interior.
    geometry.scale(-1, 1, 1);
  
    // Crear una textura procedural usando un canvas.
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    // Fondo negro.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Dibujar estrellas (puntos blancos aleatorios)
    ctx.fillStyle = '#FFF';
    for (let i = 0; i < starCount; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const r = Math.random() * 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipMapLinearFilter;
  
    // Material básico para el cielo (no necesita iluminación)
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.FrontSide // Opción alternativa: como invertimos la geometría, FrontSide también funciona.
    });
  
    const skyMesh = new THREE.Mesh(geometry, material);
    return skyMesh;
  }
}
