import * as THREE from 'three';
import { ChunkManager } from './ChunkManager';
import { Chunk } from './Chunk';
import { Renderer } from '../graphics/Renderer';

export class World {
  public scene: THREE.Scene;
  public onNight: (() => void) | null = null;
  public onDay: (() => void) | null = null;
  private timeOfDay: Number = 0;

  private readonly chunkManager: ChunkManager;
  private readonly renderer: Renderer;
  private cycleTime: number = 0;

  private totalCycleTime: number = 0;

  constructor(renderer: Renderer, chunkManager: ChunkManager) {
    this.scene = renderer.scene;
    this.chunkManager = chunkManager;
    this.renderer = renderer;
    this.totalCycleTime =
      this.renderer.dayNightConfig.dayDuration +
      this.renderer.dayNightConfig.transitionDuration +
      this.renderer.dayNightConfig.nightDuration +
      this.renderer.dayNightConfig.transitionDuration;
  }

  update(delta: number, playerPosition: THREE.Vector3) {
    this.updateDayNightCycle(delta);
    this.chunkManager.update(playerPosition);
  }

  public getLoadedChunks(): Chunk[] {
    return this.chunkManager.getLoadedChunks();
  }

  public isWorldLoaded(): boolean {
    return this.chunkManager.isWorldLoaded();
  }

  public getClosestFreePosition(position: THREE.Vector3): THREE.Vector3 {
    return this.chunkManager.closestFreeSpace(position);
  }

  private updateDayNightCycle(delta: number) {
    this.cycleTime = (this.cycleTime + delta) % this.totalCycleTime;
    const { dayDuration, nightDuration, transitionDuration } = this.renderer.dayNightConfig;
    let factor = 0; // 0 = día, 1 = noche

    if (this.cycleTime < dayDuration) {
      // Día completo
      factor = 0;
      if (this.timeOfDay != factor) {
        this.timeOfDay = factor;
        if (this.onDay) {
          this.onDay();
        }
      }
    } else if (this.cycleTime < dayDuration + transitionDuration) {
      // Transición de día a noche
      factor = (this.cycleTime - dayDuration) / transitionDuration;
    } else if (this.cycleTime < dayDuration + transitionDuration + nightDuration) {
      // Noche completa
      factor = 1;
      if (this.timeOfDay != factor) {
        this.timeOfDay = factor;
        if (this.onNight) {
          this.onNight();
        }
      }
    } else {
      // Transición de noche a día
      factor = 1 - ((this.cycleTime - dayDuration - transitionDuration - nightDuration) / transitionDuration);
    }
    this.timeOfDay = factor;

    const ambientIntensity = THREE.MathUtils.lerp(this.renderer.dayNightConfig.dayAmbient, this.renderer.dayNightConfig.nightAmbient, factor);
    const directionalIntensity = THREE.MathUtils.lerp(this.renderer.dayNightConfig.dayDirectional, this.renderer.dayNightConfig.nightDirectional, factor);

    this.renderer.ambientLight.intensity = ambientIntensity;
    this.renderer.directionalLight.intensity = directionalIntensity;

    const newBackground = this.renderer.dayNightConfig.dayBackground.clone().lerp(this.renderer.dayNightConfig.nightBackground, factor);
    this.scene.background = newBackground;
    this.scene.fog?.color.copy(newBackground);
  }
}
