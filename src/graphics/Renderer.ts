import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader';

interface DayNightConfig {
  dayBackground: THREE.Color;
  nightBackground: THREE.Color;
  dayAmbient: number;
  nightAmbient: number;
  dayDirectional: number;
  nightDirectional: number;
  dayDuration: number;
  nightDuration: number;
  transitionDuration: number;
}

export class Renderer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public domElement: HTMLCanvasElement;
  private composer: EffectComposer;
  private fxaaPass: ShaderPass;

  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight;

  private dayNightConfig: DayNightConfig = {
    dayBackground: new THREE.Color(0x6FA8DC),
    nightBackground: new THREE.Color(0x000000),
    dayAmbient: 0.3,
    nightAmbient: 0.1,
    dayDirectional: 0.6,
    nightDirectional: 0.0,
    dayDuration: 90,
    nightDuration: 120,
    transitionDuration: 30
  };

  private cycleTime: number = 0;
  private totalCycleTime: number =
    this.dayNightConfig.dayDuration +
    this.dayNightConfig.transitionDuration +
    this.dayNightConfig.nightDuration +
    this.dayNightConfig.transitionDuration;

  constructor() {
    THREE.ShaderChunk.fog_pars_fragment = `
    #ifdef USE_FOG
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      varying vec3 vWorldPosition;
    #endif
    `;
        THREE.ShaderChunk.fog_fragment = `
    #ifdef USE_FOG
      float fogDistance = length(vWorldPosition - cameraPosition);
      float fogFactor = smoothstep(fogNear, fogFar, fogDistance);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
    #endif
    `;
        THREE.ShaderChunk.fog_pars_vertex = `
    #ifdef USE_FOG
      varying vec3 vWorldPosition;
    #endif
    `;
        THREE.ShaderChunk.fog_vertex = `
    #ifdef USE_FOG
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    #endif
    `;

    this.scene = new THREE.Scene();
    this.scene.background = this.dayNightConfig.dayBackground.clone();
    this.scene.fog = new THREE.Fog(this.scene.background.clone(), 60, 150);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.05,
      1000
    );
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMappingExposure = 1;
    document.body.appendChild(this.renderer.domElement);
    this.domElement = this.renderer.domElement;

    this.ambientLight = new THREE.AmbientLight(0xffffff, this.dayNightConfig.dayAmbient);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, this.dayNightConfig.dayDirectional);
    this.directionalLight.position.set(0, 1000, 500);
    this.directionalLight.castShadow = true;
    this.scene.add(this.directionalLight);

    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

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
  }

  private updateDayNightCycle(delta: number) {
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

    const ambientIntensity = THREE.MathUtils.lerp(this.dayNightConfig.dayAmbient, this.dayNightConfig.nightAmbient, factor);
    const directionalIntensity = THREE.MathUtils.lerp(this.dayNightConfig.dayDirectional, this.dayNightConfig.nightDirectional, factor);

    this.ambientLight.intensity = ambientIntensity;
    this.directionalLight.intensity = directionalIntensity;

    const newBackground = this.dayNightConfig.dayBackground.clone().lerp(this.dayNightConfig.nightBackground, factor);
    this.scene.background = newBackground;
    this.scene.fog?.color.copy(newBackground);
  }

  public render(delta: number) {
    this.updateDayNightCycle(delta);
    this.composer.render();
  }
}
