import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/** Acabamento da qualidade alta: brilho do fogo e das luzes e distorção de calor na explosão */
export class Post {
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private heat: ShaderPass;
  private from = new THREE.Vector3();
  private age = 9;
  private power = 1;
  constructor(r: THREE.WebGLRenderer, scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    this.composer = new EffectComposer(r, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.45, 1);
    this.composer.addPass(this.bloom);
    this.heat = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, at: { value: new THREE.Vector2() }, age: { value: 9 }, power: { value: 1 }, aspect: { value: 1 } },
      vertexShader: 'varying vec2 u; void main(){ u=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform sampler2D tDiffuse; uniform vec2 at; uniform float age,power,aspect; varying vec2 u; void main(){ vec2 d=(u-at)*vec2(aspect,1.); float l=length(d); float r=age*.55*power; float w=exp(-pow((l-r)*14.,2.))*max(0.,1.-age)*.045*power; float h=max(0.,1.-age/3.)*exp(-l*5./power)*.004; vec2 o=normalize(d+1e-4)*w+vec2(sin(u.y*140.+age*30.),cos(u.x*120.+age*26.))*h; gl_FragColor=texture2D(tDiffuse,u-o); }',
    });
    this.heat.enabled = false;
    this.composer.addPass(this.heat);
    this.composer.addPass(new OutputPass());
  }
  resize(w: number, h: number) {
    this.composer.setPixelRatio(this.composer.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.heat.uniforms.aspect.value = w / h;
  }
  blast(at: THREE.Vector3, power: number) {
    this.from.copy(at);
    this.power = power;
    this.age = 0;
  }
  render(dt: number) {
    this.age += dt;
    this.heat.enabled = this.age < 3;
    if (this.heat.enabled) {
      const p = this.from.clone().project(this.camera);
      this.heat.uniforms.at.value.set((p.x + 1) / 2, (p.y + 1) / 2);
      this.heat.uniforms.age.value = this.age;
      this.heat.uniforms.power.value = this.power;
      if (p.z > 1) this.heat.enabled = false;
    }
    this.composer.render(dt);
  }
  dispose() {
    this.bloom.dispose();
    this.heat.dispose();
    this.composer.dispose();
  }
}
