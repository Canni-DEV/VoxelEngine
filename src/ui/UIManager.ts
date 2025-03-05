export class UIManager {
    private fpsElement: HTMLElement;
    private lastTime: number;
    private frameCount: number;
  
    constructor() {
      this.fpsElement = document.getElementById('fps')!;
      this.lastTime = performance.now();
      this.frameCount = 0;
    }
  
    public update(now:number) {
      this.frameCount++;
      if (now - this.lastTime > 1000) {
        const fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
        this.fpsElement.innerText = `FPS: ${fps}`;
        this.lastTime = now;
        this.frameCount = 0;
      }
    }
  }
  