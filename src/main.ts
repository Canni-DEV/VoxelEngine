import { Renderer } from './graphics/Renderer';
import { World } from './world/World';
import { Player } from './player/Player';
import { AudioManager } from './audio/AudioManager';
import { UIManager } from './ui/UIManager';
import { Controls } from './player/Controls';
import { InputManager } from './player/InputManager';
import { ChunkManager } from './world/ChunkManager';

async function init() {
  const renderer = new Renderer();
  const chunkManager = new ChunkManager(renderer.scene);
  const world = new World(renderer, chunkManager);
  const player = new Player(renderer, world);
  const inputManager = new InputManager(renderer.camera, renderer.scene, chunkManager);
  const controls = new Controls(player, renderer.domElement, inputManager);
  const audioManager = new AudioManager();
  const uiManager = new UIManager();

  let lastTime = performance.now();
  let accumulator = 0;
  // Fijamos un timestep fijo: 1/20 s (20 actualizaciones por segundo)
  const fixedTimeStep = 1 / 20; // 0.05 segundos

  function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    let delta = (now - lastTime) / 1000; 
    lastTime = now;

    delta = Math.min(delta, 0.05);
    accumulator += delta;
    controls.update(delta);
    player.update(delta);
    while (accumulator >= fixedTimeStep) {    
      world.update(fixedTimeStep, player.position);    
      accumulator -= fixedTimeStep;
    }

    const alpha = accumulator / fixedTimeStep;
    renderer.render(alpha);
    uiManager.update(now);
  }

  animate();
}

init();
