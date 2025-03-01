import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader';

export class Renderer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public domElement: HTMLCanvasElement;
  private composer: EffectComposer;
  private ssaoPass: SSAOPass;
  private outlinePass: OutlinePass;
  private fxaaPass: ShaderPass;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color( 0x6FA8DC );

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    this.scene.add(this.camera);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;	
    this.renderer.toneMappingExposure = 1;
    document.body.appendChild(this.renderer.domElement);
    this.domElement = this.renderer.domElement;

    // Iluminación
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(0, 2000, 500);
    directionalLight.castShadow = true;
    // directionalLight.shadow.mapSize.set( 4096, 4096 );
    // directionalLight.shadow.bias = -0.0005;
    // directionalLight.shadow.camera.left =	-100;
    // directionalLight.shadow.camera.right = 	100;
    // directionalLight.shadow.camera.top = 	100;
    // directionalLight.shadow.camera.bottom = -100;
     const indicatorGeometry = new THREE.SphereGeometry(50, 64,64);
        const indicatorMaterial = new THREE.MeshBasicMaterial({
          color: 0xffff00,
          opacity: 1,
          transparent: true,
          side: THREE.FrontSide
        });
    var selectionIndicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    directionalLight.add(selectionIndicator);
    this.scene.add(directionalLight);

    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // SSAOPass: para oclusión ambiental
    this.ssaoPass = new SSAOPass(this.scene, this.camera, window.innerWidth, window.innerHeight);
    this.ssaoPass.kernelRadius = 16;
    this.composer.addPass(this.ssaoPass);

    // OutlinePass: resaltar bordes
    this.outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.scene, this.camera);
    this.outlinePass.edgeStrength = 1;
    this.outlinePass.edgeGlow = 0.5;
    this.outlinePass.edgeThickness = 1.0;
    this.outlinePass.visibleEdgeColor.set('#ffffff');
    this.outlinePass.hiddenEdgeColor.set('#190a05');
    this.composer.addPass(this.outlinePass);

    // FXAA para anti-aliasing
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
    this.outlinePass.setSize(width, height);
    this.ssaoPass.setSize(width, height);
  }

  public render() {
    this.composer.render();
  }
}
