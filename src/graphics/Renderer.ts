import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader';

interface DayNightConfig {
  dayBackground: THREE.Color;
  nightBackground: THREE.Color;
  dayAmbient: number;
  nightAmbient: number;
  dayDirectional: number;
  nightDirectional: number;
  dayDuration: number;        // en segundos (ej. 300)
  nightDuration: number;      // en segundos (ej. 300)
  transitionDuration: number; // en segundos (ej. 60)
}

export class Renderer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public domElement: HTMLCanvasElement;
  private composer: EffectComposer;
  private ssaoPass: SSAOPass;
  private fxaaPass: ShaderPass;

  // Luces para el sistema de día/noche
  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight;

  // Configuración del ciclo día-noche
  private dayNightConfig: DayNightConfig = {
    dayBackground: new THREE.Color(0x6FA8DC),  // celeste
    nightBackground: new THREE.Color(0x000000),  // negro
    dayAmbient: 0.4,
    nightAmbient: 0.1,
    dayDirectional: 0.6,
    nightDirectional: 0.0,
    dayDuration: 90,         // 5 minutos
    nightDuration: 120,       // 5 minutos
    transitionDuration: 30    // 1 minuto
  };

  // Temporizador para el ciclo (en segundos)
  private cycleTime: number = 0;
  private totalCycleTime: number =
    this.dayNightConfig.dayDuration +
    this.dayNightConfig.transitionDuration +
    this.dayNightConfig.nightDuration +
    this.dayNightConfig.transitionDuration;

  private lastTime: number = performance.now();

  constructor() {
    // Crear escena y cámara
    this.scene = new THREE.Scene();
    this.scene.background = this.dayNightConfig.dayBackground.clone();

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    this.scene.add(this.camera);

    // Configurar renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMappingExposure = 1;
    document.body.appendChild(this.renderer.domElement);
    this.domElement = this.renderer.domElement;

    // Crear luces para el sistema de día/noche
    this.ambientLight = new THREE.AmbientLight(0xffffff, this.dayNightConfig.dayAmbient);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, this.dayNightConfig.dayDirectional);
    this.directionalLight.position.set(0, 1000, 500);
    this.directionalLight.castShadow = true;
    this.scene.add(this.directionalLight);

    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.ssaoPass = new SSAOPass(this.scene, this.camera, window.innerWidth, window.innerHeight);
    this.ssaoPass.kernelRadius = 16;
    // Opcionalmente se puede agregar el SSAO pass
    this.composer.addPass(this.ssaoPass);

    this.fxaaPass = new ShaderPass(FXAAShader);
    this.fxaaPass.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
    this.composer.addPass(this.fxaaPass);

    window.addEventListener('resize', this.onWindowResize.bind(this), false);
  }

  private onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.fxaaPass.uniforms['resolution'].value.set(1 / width, 1 / height);
    this.ssaoPass.setSize(width, height);
  }

  /**
   * Actualiza el ciclo día/noche en función del delta de tiempo (en segundos).
   */
  private updateDayNightCycle(delta: number) {
    // Actualiza el temporizador y envuelve el ciclo
    this.cycleTime = (this.cycleTime + delta) % this.totalCycleTime;

    // Determinar la etapa actual del ciclo:
    // Segmentos:
    // 0 - dayDuration: día completo (factor = 0)
    // dayDuration - (dayDuration + transitionDuration): transición día a noche (factor: 0->1)
    // (dayDuration + transitionDuration) - (dayDuration + transitionDuration + nightDuration): noche completa (factor = 1)
    // (dayDuration + transitionDuration + nightDuration) - totalCycleTime: transición noche a día (factor: 1->0)
    const { dayDuration, nightDuration, transitionDuration } = this.dayNightConfig;
    let factor = 0; // 0 = día, 1 = noche

    if (this.cycleTime < dayDuration) {
      // Día completo
      factor = 0;
    } else if (this.cycleTime < dayDuration + transitionDuration) {
      // Transición de día a noche
      factor = (this.cycleTime - dayDuration) / transitionDuration;
    } else if (this.cycleTime < dayDuration + transitionDuration + nightDuration) {
      // Noche completa
      factor = 1;
    } else {
      // Transición de noche a día
      factor = 1 - ((this.cycleTime - dayDuration - transitionDuration - nightDuration) / transitionDuration);
    }

    // Interpolar las intensidades y el color de fondo
    const ambientIntensity = THREE.MathUtils.lerp(this.dayNightConfig.dayAmbient, this.dayNightConfig.nightAmbient, factor);
    const directionalIntensity = THREE.MathUtils.lerp(this.dayNightConfig.dayDirectional, this.dayNightConfig.nightDirectional, factor);

    this.ambientLight.intensity = ambientIntensity;
    this.directionalLight.intensity = directionalIntensity;

    // Interpolar el color de fondo
    this.scene.background = this.dayNightConfig.dayBackground.clone().lerp(this.dayNightConfig.nightBackground, factor);
  }

  /**
   * Render loop: actualiza el ciclo día/noche y renderiza la escena.
   */
  public render() {
    const now = performance.now();
    const delta = (now - this.lastTime) / 1000;
    this.lastTime = now;

    this.updateDayNightCycle(delta);
    this.composer.render();
  }
}
