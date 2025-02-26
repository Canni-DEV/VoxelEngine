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
  const controls = new Controls(player, renderer.domElement);
  const inputManager = new InputManager(renderer.camera, renderer.scene, chunkManager);
  const audioManager = new AudioManager();
  const uiManager = new UIManager();
  // Opcional: inicializa el toolbar y menú
  // new Toolbar();
  // new Menu();
  let lastTime = performance.now();

  function animate() {
    const currentTime = performance.now();
    const delta = (currentTime - lastTime) / 1000; // delta en segundos
    lastTime = currentTime;
    
    requestAnimationFrame(animate);
    controls.update();
    player.update();
    world.update(player.position);
    renderer.render();
    uiManager.update(); // Actualiza el contador de FPS, etc.
  }
  animate();
}

init();
