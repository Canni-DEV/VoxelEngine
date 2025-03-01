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
  const chunkManager = new ChunkManager(renderer.scene)
  const world = new World(renderer.scene, chunkManager);
  const player = new Player(renderer.camera, world);
  const inputManager = new InputManager(renderer.camera, renderer.scene, chunkManager);
  const controls = new Controls(player, renderer.domElement, inputManager);
  const audioManager = new AudioManager();
  const uiManager = new UIManager();
  let lastTime = performance.now();

  function animate() {
    const currentTime = performance.now();
    const delta = (currentTime - lastTime) / 1000; 
    lastTime = currentTime;
    
    requestAnimationFrame(animate);
    controls.update(delta);
    player.update();
    world.update(player.position);
    renderer.render();
    uiManager.update();
  }
  animate();
}

init();
