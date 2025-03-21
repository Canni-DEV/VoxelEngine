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

  function animate() {
    requestAnimationFrame(animate);

    const currentTime = performance.now();
    // Calcular delta en segundos y limitarlo para evitar grandes saltos en la simulación
    let delta = (currentTime - lastTime) / 1000;
    delta = Math.min(delta, 0.1);
    lastTime = currentTime;

    // Procesar entrada
    controls.update(delta);
    // Actualizar el mundo primero para disponer de chunks actualizados
    world.update(delta, player.position);
    // Actualizar la física del jugador, que dependerá de datos actualizados en el mundo
    player.update(delta);

    // Renderizar la escena; se puede pasar delta para efectos que dependan del tiempo
    renderer.render(delta);
    // Actualizar la interfaz (UI)
    uiManager.update(currentTime);
  }

  animate();
}

init();
