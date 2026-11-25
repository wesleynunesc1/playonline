import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CITIES, CITY, City, ROADS } from './data';
import { facade, mat } from './models';
import { BOUNDS, COAST_CANVAS, EXT, HEIGHT, LAKES, NX, NZ, PHONE, RINGS, RIVERS, STEP_M, Y, cityNamed, isWater, lakeEdge, noise, silhouette, spread } from './terrain';

/** Cenário: chão, água, céu, estradas, cidades que crescem ou viram ruína, plantas, pontos famosos e clima. */
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const NOISE = `
float h21(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<${PHONE ? 3 : 4};i++){ s+=a*vn(p); p=p*2.03+7.1; a*=.5; } return s; }`;
/** Uniformes usados por todo o cenário */
export const U = {
  time: { value: 0 }, night: { value: 0 }, wet: { value: 0 }, fogMap: { value: null as THREE.Texture | null }, fogOn: { value: 0 }, land: { value: null as THREE.Texture | null },
  box: { value: new THREE.Vector4(BOUNDS.x0, BOUNDS.z0, BOUNDS.w, BOUNDS.h) },
};
/** Escurece o que está fora da visão e entrega a posição no mundo ao sombreador */
function world(m: THREE.MeshStandardMaterial, color = '', extra: (s: { vertexShader: string; fragmentShader: string }) => void = () => {}) {
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vNw; uniform float time;').replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp=vec4(position,1.);
      #ifdef USE_INSTANCING
      wp=instanceMatrix*wp;
      #endif
      vW=(modelMatrix*wp).xyz; vNw=normal;`);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vW; varying vec3 vNw; uniform float time,night,wet,fogOn; uniform sampler2D fogMap,land; uniform vec4 box;${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${color}
        { vec2 fu=(vW.xz-box.xy)/box.zw; float fo=fogOn*texture2D(fogMap,fu).a*step(0.,fu.x)*step(fu.x,1.)*step(0.,fu.y)*step(fu.y,1.);
          float lu=dot(diffuseColor.rgb,vec3(.3,.59,.11)); diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(lu),diffuseColor.rgb,.45)*vec3(.6,.64,.7),fo*.7); }`);
    extra(s);
  };
  m.customProgramCacheKey = () => color + extra.toString();
  return m;
}
const GROUND = `
  vec2 p=vW.xz; float alt=vW.y; float slope=1.-normalize(vNw).y;
  float big=fbm(p*.3), mid=fbm(p*1.9), fine=fbm(p*9.), grit=vn(p*70.), grit2=vn(p*190.);
  vec3 dry=mix(vec3(.46,.35,.2),vec3(.62,.5,.3),mid), scrub=mix(vec3(.3,.31,.14),vec3(.43,.42,.2),fine), lush=mix(vec3(.1,.23,.07),vec3(.2,.36,.11),fine);
  float green=smoothstep(.28,.55,big+(mid-.5)*.35);
  vec3 col=mix(dry,scrub,green);
  col=mix(col,lush,smoothstep(.62,1.15,alt+(mid-.5)*.35));
  col=mix(col,lush*1.1,smoothstep(.55,.7,big)*.5);
  // Moitas e pedras
  float tuft=smoothstep(.56,.64,fbm(p*5.5+3.)); col=mix(col,col*vec3(.62,.78,.5),tuft*.65*green);
  col=mix(col,mix(vec3(.36,.31,.27),vec3(.56,.51,.45),fine),smoothstep(.16,.36,slope+(fine-.5)*.14));
  // Lavouras em talhões
  vec2 q=mat2(.92,.39,-.39,.92)*p*1.35; vec2 cell=floor(q); float crop=h21(cell);
  if(crop>.8&&alt>.2&&alt<.62&&slope<.1){ vec2 f=fract(q); float ed=smoothstep(.03,.05,f.x)*smoothstep(.03,.05,f.y)*smoothstep(.03,.05,1.-f.x)*smoothstep(.03,.05,1.-f.y);
    float row=.78+.22*smoothstep(-.3,.3,sin((crop>.9?q.x:q.y)*62.)); vec3 cc=crop>.9?vec3(.5,.43,.2):crop>.82?vec3(.21,.3,.12):vec3(.33,.36,.16); col=mix(col,cc*row*(.85+.3*fine),ed*.7); }
  col*=(.86+.2*grit)*(.93+.12*grit2);
  // Praia e areia molhada
  float beach=smoothstep(.27,.15,alt+(mid-.5)*.06); vec3 sand=mix(vec3(.84,.74,.54),vec3(.95,.88,.71),fine)*(.93+.1*grit2);
  col=mix(col,sand,beach); col=mix(col,sand*.6,smoothstep(.06,-.02,alt));
  vec2 lu=(p-box.xy)/box.zw; vec4 own=texture2D(land,lu); float inside=step(0.,lu.x)*step(lu.x,1.)*step(0.,lu.y)*step(lu.y,1.)*own.a;
  col=mix(col*vec3(.74,.76,.8),col,smoothstep(.02,.1,inside));
  float own2=smoothstep(.2,.6,inside); col=mix(col,own.rgb*(dot(col,vec3(.3,.59,.11))*1.25+.05),own2*.15); col=max(vec3(0.),mix(vec3(dot(col,vec3(.3,.59,.11))),col,1.28));
  col*=1.-.22*smoothstep(.5,.72,fbm(p*.075+vec2(time*.012,time*.007)))*(1.-night);
  col=mix(col,col*vec3(.62,.64,.68),wet);
  diffuseColor.rgb=pow(col,vec3(1.35));`;
const WATER = (shore: string) => `
  vec2 p=vW.xz; float near=${shore}; float w=fbm(p*1.6+vec2(time*.14,-time*.1)); float w2=vn(p*14.+time*.9);
  diffuseColor.rgb=mix(diffuseColor.rgb*(.75+.5*w)+w2*.02,vec3(.1,.44,.45),smoothstep(.04,.6,near)*.72);
  float foam=smoothstep(.72,.9,sin(near*36.-time*1.4+w*8.)*.5+.5)*smoothstep(.24,.42,near)*smoothstep(.3,.6,w);
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.92,.97,.98),clamp(foam*1.2,0.,.75));`;
const ripple = (s: { fragmentShader: string }) => {
  s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
    { vec2 o=vW.xz*4.; float a=vn(o+time*.6)+.5*vn(o*2.7-time*.8), b=vn(o+vec2(.2,0.)+time*.6)+.5*vn((o+vec2(.2,0.))*2.7-time*.8), c=vn(o+vec2(0.,.2)+time*.6)+.5*vn((o+vec2(0.,.2))*2.7-time*.8);
      normal=normalize(normal+(viewMatrix*vec4(a-b,0.,a-c,0.)).xyz*.55); }`);
};
/** Quarteirões, ruas e calçadas, nítidos em qualquer distância */
const URBAN = `
  vec2 l=vUv2.xy; float rad=vUv2.z; float d=length(l)/rad; vec2 g=(l-.0425)/.17; vec2 f=abs(fract(g+.5)-.5)*.17; float aa=max(fwidth(l.x),fwidth(l.y));
  float st=1.-smoothstep(.017-aa,.017+aa,min(f.x,f.y)); float side=1.-smoothstep(.026-aa,.026+aa,min(f.x,f.y));
  vec2 b=floor(g+.5); float bh=h21(b); vec3 block=mix(mix(vec3(.4,.36,.3),vec3(.5,.47,.42),bh),vec3(.26,.34,.16),step(.84,bh)); block*=.85+.25*vn(vW.xz*60.);
  vec3 asph=vec3(.15,.155,.17)*(.85+.3*vn(vW.xz*120.)); float dash=step(.5,fract((f.x<f.y?l.y:l.x)*22.))*(1.-smoothstep(.0012,.0012+aa,min(f.x,f.y)));
  vec3 cc=mix(block,vec3(.55,.54,.52),side); cc=mix(cc,asph,st); cc=mix(cc,vec3(.85,.75,.35),dash*step(aa,.01)*.8);
  cc=pow(cc,vec3(1.75)); diffuseColor.rgb=mix(cc,cc*vec3(.6,.62,.66),wet); diffuseColor.a=1.-smoothstep(.86,1.,d+(vn(l*9.)-.5)*.16);`;

const roadTexture = () => {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const x = c.getContext('2d')!;
  x.fillStyle = '#7d6f57';
  x.fillRect(0, 0, 128, 256);
  x.fillStyle = '#34373c';
  x.fillRect(16, 0, 96, 256);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.12)';
    x.fillRect(16 + Math.random() * 96, Math.random() * 256, 2, 3);
  }
  x.fillStyle = 'rgba(255,255,255,.65)';
  x.fillRect(21, 0, 4, 256);
  x.fillRect(103, 0, 4, 256);
  x.fillStyle = '#f0c94f';
  x.fillRect(62, 20, 5, 120);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16;
  return t;
};
type Pt = { x: number; z: number };
/** Ponto de uma estrada (k de 0 a 1) */
function roadAt(i: number, k: number): Pt {
  const [a, b] = ROADS[i];
  const bend = (((a.id + b.id) % 7) - 3) * 0.12;
  const mx = (a.x + b.x) / 2 + (b.z - a.z) * bend;
  const mz = (a.z + b.z) / 2 - (b.x - a.x) * bend;
  const u = 1 - k;
  return { x: u * u * a.x + 2 * u * k * mx + k * k * b.x, z: u * u * a.z + 2 * u * k * mz + k * k * b.z };
}
/** Fita que acompanha o relevo */
function ribbons(lines: Pt[][], w: number, lift: number, rep: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const l of lines) {
    let len = 0;
    l.forEach((p, i) => {
      const n = l[Math.min(l.length - 1, i + 1)];
      const b = l[Math.max(0, i - 1)];
      const a = Math.atan2(n.z - b.z, n.x - b.x) + Math.PI / 2;
      if (i) len += Math.hypot(p.x - b.x, p.z - b.z);
      const at = pos.length / 3;
      for (const s of [1, -1]) {
        const [x, z] = [p.x + Math.cos(a) * w * s, p.z + Math.sin(a) * w * s];
        pos.push(x, Math.max(Y(x, z), Y(p.x, p.z)) + lift, z);
      }
      uv.push(0, len * rep, 1, len * rep);
      if (i) idx.push(at - 2, at, at - 1, at, at + 1, at - 1);
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Sempre voltada para cima
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) if (n.getY(i) < 0) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}
const plain = (g: THREE.BufferGeometry, color?: string) => {
  const n = g.index ? g.toNonIndexed() : g;
  n.deleteAttribute('uv');
  if (color) {
    const c = new THREE.Color(color);
    n.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 3).map((_, i) => [c.r, c.g, c.b][i % 3]), 3));
  }
  return n;
};
interface House { mesh: THREE.InstancedMesh; i: number; x: number; z: number; rot: number; s: number; h: number; tint: THREE.Color; rank: number; luck: number }
export interface Sky { light: number; warm: number; rain: number; mist: number }

export class Scenery {
  private ground: THREE.Mesh;
  private painted = new Map<number, string>();
  private ownCtx!: CanvasRenderingContext2D;
  private ownTex!: THREE.CanvasTexture;
  private ownDirty = true;
  private cars!: THREE.InstancedMesh;
  private lamps!: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private traffic: { road: number; k: number; v: number; side: number }[] = [];
  private houses = new Map<number, House[]>();
  private looks = new Map<number, string>();
  private tall!: THREE.MeshStandardMaterial;
  private grass!: THREE.InstancedMesh;
  private grassAt = '';
  private turbines: THREE.Object3D[] = [];
  private kites: THREE.Object3D[] = [];
  private rain!: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private dome!: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  mask = silhouette(256, BOUNDS);

  constructor(private scene: THREE.Scene) {
    this.sky();
    this.water();
    this.territory();
    this.ground = this.terrain();
    this.borders();
    this.urban();
    this.roads();
    this.towns();
    this.nature();
    this.landmarks();
    this.makeCars();
    this.weather();
    void this.ground;
  }
  private add<T extends THREE.Object3D>(o: T) {
    this.scene.add(o);
    return o;
  }
  private sky() {
    this.dome = this.add(new THREE.Mesh(new THREE.SphereGeometry(230, 32, 20), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { ...U, sun: { value: new THREE.Vector3(0, 1, 0) }, day: { value: 1 }, warm: { value: 0 }, gray: { value: 0 } },
      vertexShader: 'varying vec3 d; void main(){ d=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `varying vec3 d; uniform vec3 sun; uniform float time,day,warm,gray;${NOISE}
        void main(){ float h=max(d.y,0.); vec3 top=mix(vec3(.012,.02,.06),vec3(.11,.33,.72),day), low=mix(vec3(.05,.07,.13),vec3(.66,.79,.9),day);
          low=mix(low,vec3(1.,.5,.22),warm*.85); vec3 c=mix(low,top,pow(h,.45));
          float s=max(dot(normalize(d),normalize(sun)),0.); c+=vec3(1.,.75,.45)*(pow(s,900.)*4.+pow(s,14.)*.35*(.4+warm))*step(-.05,sun.y);
          vec2 q=d.xz/(h+.12)*1.1; float cl=smoothstep(.5,.78,fbm(q+time*.006)); c=mix(c,mix(vec3(.1,.11,.15),vec3(1.),day)*mix(vec3(1.),vec3(1.,.7,.5),warm),cl*smoothstep(.02,.2,h)*.8);
          float st=step(.9975,h21(floor(d.xz/(h+.3)*160.))); c+=st*(1.-day)*smoothstep(.1,.4,h)*(1.-cl);
          c=mix(c,vec3(.42,.46,.5)*(.25+.75*day),gray*.8); gl_FragColor=vec4(c,1.);
          #include <colorspace_fragment>
        }`,
    })));
    this.dome.renderOrder = -5;
    this.dome.frustumCulled = false;
  }
  private water() {
    const coast = new THREE.CanvasTexture(COAST_CANVAS);
    coast.flipY = false;
    const m = world(new THREE.MeshStandardMaterial({ color: '#0b3f63', roughness: 0.12, metalness: 0.15 }), WATER('seaNear(vW.xz)'), (s) => {
      (s as unknown as { uniforms: Record<string, unknown> }).uniforms.coast = { value: coast };
      (s as unknown as { uniforms: Record<string, unknown> }).uniforms.ext = { value: new THREE.Vector4(EXT.x0, EXT.z0, EXT.w, EXT.h) };
      s.fragmentShader = s.fragmentShader.replace('varying vec3 vW;', 'uniform sampler2D coast; uniform vec4 ext; float seaNear(vec2 p){ vec2 u=(p-ext.xy)/ext.zw; return u.x>0.&&u.x<1.&&u.y>0.&&u.y<1.?texture2D(coast,u).a:0.; }\nvarying vec3 vW;');
      ripple(s);
    });
    const sea = this.add(new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), m));
    sea.position.y = 0.02;
    sea.receiveShadow = true;
    // Açudes e rios
    const lake = world(new THREE.MeshStandardMaterial({ color: '#17506a', roughness: 0.1, metalness: 0.15 }), WATER('0.'), ripple);
    for (const l of LAKES) {
      const s = new THREE.Shape();
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        const r = lakeEdge(l, a) * 1.02;
        if (i) s.lineTo(Math.cos(a) * r, -Math.sin(a) * r);
        else s.moveTo(Math.cos(a) * r, -Math.sin(a) * r);
      }
      this.add(new THREE.Mesh(new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2), lake)).position.set(l.x, l.level, l.z);
    }
    const lines = RIVERS.map((pts) => {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, 0, p.z)));
      return curve.getSpacedPoints(Math.ceil(curve.getLength() / 0.12)).map((v) => ({ x: v.x + (noise(v.x * 1.3, v.z * 1.3) - 0.5) * 0.35, z: v.z + (noise(v.x * 1.3 + 9, v.z * 1.3) - 0.5) * 0.35 })).filter((v) => Y(v.x, v.z) > 0.03);
    });
    const river = this.add(new THREE.Mesh(ribbons(lines, 0.075, 0.02, 1), lake));
    (river.material as THREE.Material).side = THREE.DoubleSide;
    const bank = this.add(new THREE.Mesh(ribbons(lines, 0.13, 0.012, 1), world(new THREE.MeshStandardMaterial({ color: '#3f5a24', roughness: 1, side: THREE.DoubleSide }), 'diffuseColor.rgb*=.7+.6*vn(vW.xz*40.);')));
    bank.receiveShadow = true;
  }
  /** Cor do dono de cada município, lida pelo chão */
  private territory() {
    const px = PHONE ? 16 : 24;
    const c = document.createElement('canvas');
    c.width = Math.round(BOUNDS.w * px);
    c.height = Math.round(BOUNDS.h * px);
    this.ownCtx = c.getContext('2d')!;
    this.ownTex = new THREE.CanvasTexture(c);
    this.ownTex.flipY = false;
    this.ownTex.premultiplyAlpha = false;
    U.land.value = this.ownTex;
    for (const x of CITIES) this.paint(x.id, '');
  }
  paint(id: number, color: string) {
    if (this.painted.get(id) === color) return;
    this.painted.set(id, color);
    const x = this.ownCtx;
    const { width, height } = x.canvas;
    x.beginPath();
    for (const r of RINGS.get(id)!) r.forEach(([a, b], i) => {
      const [u, v] = [((a - BOUNDS.x0) / BOUNDS.w) * width, ((b - BOUNDS.z0) / BOUNDS.h) * height];
      if (i) x.lineTo(u, v);
      else x.moveTo(u, v);
    });
    x.globalCompositeOperation = 'destination-out';
    x.fillStyle = '#000';
    x.fill();
    x.globalCompositeOperation = 'source-over';
    // Alfa baixo marca "dentro do estado, sem dono"
    x.globalAlpha = color ? 1 : 0.15;
    x.fillStyle = color || '#777';
    x.fill();
    x.globalAlpha = 1;
    this.ownDirty = true;
  }
  private terrain() {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(NX * NZ * 3);
    const idx = new Uint32Array((NX - 1) * (NZ - 1) * 6);
    let n = 0;
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const k = j * NX + i;
        pos.set([EXT.x0 + i * STEP_M, HEIGHT[k], EXT.z0 + j * STEP_M], k * 3);
        if (i < NX - 1 && j < NZ - 1) idx.set([k, k + NX, k + 1, k + 1, k + NX, k + NX + 1], (n++) * 6);
      }
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    const mesh = this.add(new THREE.Mesh(g, world(new THREE.MeshStandardMaterial({ roughness: 0.96 }), GROUND)));
    mesh.receiveShadow = true;
    // Terras vizinhas até o horizonte
    const far = this.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 260).rotateX(-Math.PI / 2), world(new THREE.MeshStandardMaterial({ roughness: 1 }), GROUND)));
    far.position.set(0, 0.4, EXT.z0 + EXT.h + 129);
    for (const s of [-1, 1]) {
      const side = this.add(new THREE.Mesh(new THREE.PlaneGeometry(200, EXT.h * 0.72).rotateX(-Math.PI / 2), far.material));
      side.position.set(s < 0 ? EXT.x0 - 99 : EXT.x0 + EXT.w + 99, 0.4, EXT.z0 + EXT.h * (s < 0 ? 0.64 : 0.7));
      if (s > 0) side.visible = false;
    }
    return mesh;
  }
  private borders() {
    const pos: number[] = [];
    RINGS.forEach((l) => l.forEach((r) => {
      for (let i = 1; i < r.length; i++) {
        const [a, b] = [r[i - 1], r[i]];
        const n = Math.max(1, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / 0.25));
        for (let k = 0; k < n; k++) for (const t of [k / n, (k + 1) / n]) {
          const [x, z] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          pos.push(x, Math.max(0.03, Y(x, z)) + 0.025, z);
        }
      }
    }));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#1b1a12', transparent: true, opacity: 0.34 })));
  }
  private urban() {
    const geos = CITIES.map((c) => {
      const r = spread(c) * 1.2;
      const g = new THREE.CircleGeometry(r, 28).rotateX(-Math.PI / 2);
      const p = g.attributes.position;
      g.setAttribute('uvc', new THREE.BufferAttribute(new Float32Array(p.count * 3).map((_, i) => [p.getX(Math.floor(i / 3)), p.getZ(Math.floor(i / 3)), r][i % 3]), 3));
      return g.translate(c.x, Y(c.x, c.z) + 0.012, c.z);
    });
    const m = world(new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 }), URBAN, (s) => {
      s.vertexShader = s.vertexShader.replace('varying vec3 vW;', 'attribute vec3 uvc; varying vec3 vUv2; varying vec3 vW;').replace('vNw=normal;', 'vNw=normal; vUv2=uvc;');
      s.fragmentShader = s.fragmentShader.replace('varying vec3 vW;', 'varying vec3 vUv2; varying vec3 vW;');
    });
    const mesh = this.add(new THREE.Mesh(mergeGeometries(geos)!, m));
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
  }
  private roads() {
    const lines = ROADS.map(([a, b], r) => {
      const n = Math.max(10, Math.ceil(Math.hypot(a.x - b.x, a.z - b.z) / 0.14));
      // Dentro da cidade quem manda são as ruas
      const pts = Array.from({ length: n + 1 }, (_, i) => roadAt(r, i / n));
      return pts.filter((p) => Math.hypot(p.x - a.x, p.z - a.z) > spread(a) * 0.8 && Math.hypot(p.x - b.x, p.z - b.z) > spread(b) * 0.8);
    });
    const m = this.add(new THREE.Mesh(ribbons(lines, 0.058, 0.022, 3), world(new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -10 }))));
    m.receiveShadow = true;
    m.renderOrder = 1;
  }

  // ===== Cidades =====
  private towns() {
    const box = (w: number, h: number, d: number, y: number, x = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed();
    const gable = new THREE.CylinderGeometry(0.01, 0.66, 0.4, 4, 1).rotateY(Math.PI / 4).scale(1.1, 1, 0.95).translate(0, 0.8, 0).toNonIndexed();
    const kinds = {
      house: mergeGeometries([box(1, 0.6, 0.85, 0.3), gable, box(0.16, 0.3, 0.04, 0.15, 0.1, 0.43)])!,
      shop: mergeGeometries([box(1.15, 0.55, 1, 0.275), box(1.2, 0.06, 1.05, 0.57), box(0.3, 0.14, 0.3, 0.66, 0.25, 0.2), box(0.9, 0.12, 0.2, 0.36, 0, 0.55)])!,
      tower: mergeGeometries([box(1, 1, 1, 0.5), box(1.06, 0.015, 1.06, 0.25), box(1.06, 0.015, 1.06, 0.5), box(1.06, 0.015, 1.06, 0.75), box(0.7, 0.06, 0.7, 1.03), box(0.2, 0.05, 0.3, 1.08)])!,
      step: mergeGeometries([box(1, 0.6, 1, 0.3), box(0.72, 0.3, 0.72, 0.75), box(0.42, 0.14, 0.42, 0.97), box(0.04, 0.3, 0.04, 1.15)])!,
    };
    type Kind = keyof typeof kinds;
    const raw: { kind: Kind; city: City; x: number; z: number; s: number; h: number; rot: number; rank: number; luck: number }[] = [];
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const c of CITIES) {
      const s0 = spread(c);
      const n = Math.min(PHONE ? 90 : 150, 34 + Math.round(Math.sqrt(c.pop) / 8));
      const used = new Set<string>();
      for (let i = 0; i < n; i++) {
        const a = rnd() * 6.283;
        const d = Math.sqrt(0.04 + rnd() * 0.96) * s0;
        const gx = Math.round((Math.cos(a) * d) / 0.085);
        const gz = Math.round((Math.sin(a) * d) / 0.085);
        const key = `${gx},${gz}`;
        if (Math.hypot(gx, gz) * 0.085 < 0.15 || used.has(key)) continue;
        used.add(key);
        const big = c.pop > 45_000 && rnd() < (d < s0 * 0.55 ? 0.72 : 0.2);
        const kind: Kind = big ? (rnd() < 0.3 ? 'step' : 'tower') : rnd() < 0.28 ? 'shop' : 'house';
        // Do centro para a borda: a cidade cresce para fora
        raw.push({ kind, city: c, x: c.x + gx * 0.085, z: c.z + gz * 0.085, s: 0.05 + rnd() * 0.014, h: big ? 1.5 + rnd() * (c.pop > 1e6 ? 8 : 3.4) * (1.15 - d / s0) : 1, rot: Math.floor(rnd() * 4) * (Math.PI / 2), rank: (d / s0) * 0.75 + rnd() * 0.25, luck: rnd() });
      }
    }
    const lightless = world(new THREE.MeshStandardMaterial({ roughness: 0.88 }));
    this.tall = world(new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.35, emissiveMap: facade(), emissive: '#ffd98f', emissiveIntensity: 0.25 }));
    const tints: Record<Kind, string[]> = {
      house: ['#cdbfa8', '#e2dccf', '#b8a48c', '#b36a4c', '#d3cdc4', '#c7b48b', '#9c5a43', '#8aa0a8'], shop: ['#d7d2c8', '#b9b4a8', '#c98f5a', '#7f97a8', '#e6e2d8'],
      tower: ['#c8d2da', '#8ea2b4', '#e4e6e6', '#b9aa93', '#738ba0', '#5f7f9c'], step: ['#d9dfe3', '#9fb3c2', '#c9bda8'],
    };
    for (const k of Object.keys(kinds) as Kind[]) {
      const list = raw.filter((r) => r.kind === k);
      const mesh = this.add(new THREE.InstancedMesh(kinds[k], k === 'tower' || k === 'step' ? this.tall : lightless, list.length));
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      list.forEach((r, i) => {
        const l = this.houses.get(r.city.id) ?? [];
        if (!l.length) this.houses.set(r.city.id, l);
        l.push({ mesh, i, x: r.x, z: r.z, rot: r.rot, s: r.s, h: r.h, tint: new THREE.Color(tints[k][(i * 7) % tints[k].length]), rank: r.rank, luck: r.luck });
        mesh.setColorAt(i, new THREE.Color());
      });
    }
    for (const c of CITIES) this.look(c.id, 0, 0);
    // Luzes das ruas
    const p: number[] = [];
    for (const c of CITIES) for (let i = 0; i < 6 + c.level * 5; i++) {
      const a = rand(0, 6.28);
      const d = Math.sqrt(Math.random()) * spread(c);
      p.push(c.x + Math.cos(a) * d, Y(c.x, c.z) + 0.07, c.z + Math.sin(a) * d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    this.lamps = this.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffc873', size: 0.1, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })));
    this.lamps.frustumCulled = false;
  }
  /** Aparência de uma cidade: evolução (0 a 3) e destruição (0 a 1) */
  look(id: number, dev: number, ruin: number) {
    const key = `${dev}/${Math.round(ruin * 10)}`;
    if (this.looks.get(id) === key) return;
    this.looks.set(id, key);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    for (const h of this.houses.get(id) ?? []) {
      const shown = h.rank < 0.58 + dev * 0.15;
      const broken = h.luck < ruin;
      const tall = h.h * (1 + dev * 0.16) * (broken ? 0.16 + h.luck * 0.3 : 1);
      q.setFromAxisAngle(up, h.rot + (broken ? h.luck : 0));
      h.mesh.setMatrixAt(h.i, m.compose(new THREE.Vector3(h.x, Y(h.x, h.z) + 0.005, h.z), q, shown ? new THREE.Vector3(h.s, h.s * tall, h.s) : new THREE.Vector3(0, 0, 0)));
      h.mesh.setColorAt(h.i, broken ? c.set('#2b2723') : h.tint);
      h.mesh.instanceMatrix.needsUpdate = true;
      if (h.mesh.instanceColor) h.mesh.instanceColor.needsUpdate = true;
    }
  }

  // ===== Plantas e pedras =====
  private nature() {
    const trunk = () => plain(new THREE.CylinderGeometry(0.01, 0.017, 0.08, 5).translate(0, 0.04, 0), '#5a4632');
    const ball = (r: number, x: number, y: number, z: number, c: string) => plain(new THREE.IcosahedronGeometry(r, 1).scale(1.1, 0.82, 1).translate(x, y, z), c);
    const tree = mergeGeometries([trunk(), ball(0.055, 0, 0.11, 0, '#ffffff'), ball(0.04, 0.045, 0.095, 0.02, '#e4e4e4'), ball(0.036, -0.03, 0.1, -0.035, '#d2d2d2')])!;
    const leaf = (i: number) => plain(new THREE.ConeGeometry(0.016, 0.1, 3).rotateZ(-1.2).translate(0.048, 0, 0).rotateY((i * Math.PI) / 4).translate(0, 0.21, 0), '#ffffff');
    // Carnaúba, a palmeira do Ceará
    const palm = mergeGeometries([plain(new THREE.CylinderGeometry(0.006, 0.011, 0.21, 5).translate(0, 0.105, 0), '#8a7458'), ...[0, 1, 2, 3, 4, 5, 6, 7].map(leaf)])!;
    const cactus = mergeGeometries([plain(new THREE.CylinderGeometry(0.012, 0.014, 0.13, 6).translate(0, 0.065, 0), '#ffffff'), plain(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 5).translate(0.03, 0.085, 0), '#eeeeee'), plain(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 5).translate(-0.028, 0.07, 0), '#eeeeee')])!;
    const rock = plain(new THREE.DodecahedronGeometry(0.07, 0).scale(1.2, 0.7, 1), '#ffffff');
    const place = (geo: THREE.BufferGeometry, want: number, tints: string[], ok: (x: number, z: number, y: number) => boolean, group = 4) => {
      const list: THREE.Matrix4[] = [];
      for (let i = 0; i < want * 6 && list.length < want; i++) {
        const [x, z] = [rand(BOUNDS.x0, BOUNDS.x1), rand(BOUNDS.z0, BOUNDS.z1)];
        for (let k = 0; k < group && list.length < want; k++) {
          const [px, pz] = [x + rand(-0.4, 0.4), z + rand(-0.4, 0.4)];
          const y = Y(px, pz);
          if (y < 0.24 || !ok(px, pz, y) || isWater(px, pz) || CITIES.some((c) => Math.hypot(c.x - px, c.z - pz) < spread(c) + 0.45)) continue;
          const s = rand(0.7, 1.45);
          list.push(new THREE.Matrix4().makeRotationY(rand(0, 6)).setPosition(px, y - 0.005, pz).scale(new THREE.Vector3(s, s * rand(0.85, 1.2), s)));
        }
      }
      const mesh = this.add(new THREE.InstancedMesh(geo, world(new THREE.MeshStandardMaterial({ roughness: 1, vertexColors: true, side: THREE.DoubleSide })), list.length));
      list.forEach((m, i) => {
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, new THREE.Color(tints[i % tints.length]));
      });
      mesh.castShadow = true;
      mesh.frustumCulled = false;
    };
    const f = PHONE ? 0.45 : 1;
    place(tree, 2600 * f, ['#3f5a26', '#4c6a2c', '#33481f', '#5f6b33'], (x, z, y) => y > 0.6 || noise(x * 0.3, z * 0.3) > 0.5, 8);
    place(tree, 900 * f, ['#6f6b3a', '#7a7440', '#5d5f34'], () => true, 3);
    place(palm, 800 * f, ['#5c7a35', '#6b8440', '#4c6a2c'], (_, __, y) => y < 0.5);
    place(cactus, 600 * f, ['#4f6a3a', '#5f7844'], (_, __, y) => y > 0.3 && y < 0.6, 2);
    place(rock, 700 * f, ['#8a8278', '#746c62', '#9a9186'], () => true, 3);
    // Capim em volta da câmera
    const blade = (a: number, l: number) => plain(new THREE.ConeGeometry(0.0035, l, 3).translate(0, l / 2, 0).rotateZ(0.35).rotateY(a), '#ffffff');
    this.grass = this.add(new THREE.InstancedMesh(mergeGeometries([blade(0, 0.05), blade(1.3, 0.04), blade(2.6, 0.055), blade(3.9, 0.045), blade(5.2, 0.05)])!, world(new THREE.MeshStandardMaterial({ roughness: 1 })), PHONE ? 2400 : 4800));
    this.grass.setColorAt(0, new THREE.Color());
    this.grass.frustumCulled = false;
    this.grass.receiveShadow = true;
    this.grass.count = 0;
  }
  private growGrass(x: number, z: number, dist: number) {
    this.grass.visible = dist < 13;
    const key = `${Math.round(x / 0.8)},${Math.round(z / 0.8)}`;
    if (!this.grass.visible || key === this.grassAt) return;
    this.grassAt = key;
    const side = Math.floor(Math.sqrt(this.grass.instanceMatrix.count));
    const cell = 6.5 / side;
    const [bx, bz] = [Math.round(x / cell), Math.round(z / cell)];
    const near = CITIES.filter((c) => Math.hypot(c.x - x, c.z - z) < 7);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    let n = 0;
    for (let i = -side / 2; i < side / 2; i++) for (let j = -side / 2; j < side / 2; j++) {
      const [gx, gz] = [bx + Math.floor(i), bz + Math.floor(j)];
      const r = noise(gx * 7.7 + 0.5, gz * 5.3 + 0.5);
      const r2 = noise(gx * 3.1 + 40.5, gz * 9.7 + 0.5);
      const [px, pz] = [(gx + r * 1.6 - 0.8) * cell, (gz + r2 * 1.6 - 0.8) * cell];
      const y = Y(px, pz);
      if (y < 0.25 || noise(px * 0.7, pz * 0.7) < 0.3 || near.some((c) => Math.hypot(c.x - px, c.z - pz) < spread(c) * 1.12) || isWater(px, pz)) continue;
      const s = 0.6 + r * 0.9;
      this.grass.setMatrixAt(n, m.makeRotationY(r2 * 12).scale(new THREE.Vector3(s, s, s)).setPosition(px, y, pz));
      this.grass.setColorAt(n++, col.setHSL(0.14 + noise(px * 0.4, pz * 0.4) * 0.11, 0.42, 0.2 + r * 0.14));
      if (n >= this.grass.instanceMatrix.count) break;
    }
    this.grass.count = n;
    this.grass.instanceMatrix.needsUpdate = true;
    this.grass.instanceColor!.needsUpdate = true;
  }

  // ===== Pontos famosos =====
  private landmarks() {
    const at = (name: string, dx: number, dz: number) => {
      const c = cityNamed(name);
      const g = new THREE.Group();
      const [x, z] = [c.x + dx, c.z + dz];
      g.position.set(x, Math.max(0.03, Y(x, z)), z);
      return this.add(g);
    };
    const put = (g: THREE.Object3D, geo: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, opt: { rough?: number; metal?: number; glow?: number } = {}) => {
      const m = new THREE.Mesh(geo, mat(color, opt));
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      return m;
    };
    const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
    const cyl = (a: number, b: number, h: number, n = 14) => new THREE.CylinderGeometry(a, b, h, n).translate(0, h / 2, 0);
    // Juazeiro do Norte: estátua no Horto
    const j = at('Juazeiro do Norte', -0.35, -1.05);
    put(j, cyl(0.2, 0.26, 0.1), '#cfc8ba');
    put(j, cyl(0.055, 0.09, 0.36), '#f1efe9', 0, 0.1);
    put(j, new THREE.SphereGeometry(0.05, 12, 10), '#f1efe9', 0, 0.5);
    put(j, cyl(0.075, 0.075, 0.012), '#e2dfd8', 0, 0.535);
    put(j, cyl(0.012, 0.016, 0.3), '#d8d2c4', 0.09, 0.1);
    // Porto do Pecém: cais, guindastes e navio
    const p = at('São Gonçalo do Amarante', 0.75, -1.05);
    p.position.y = 0.04;
    put(p, box(0.12, 0.06, 1), '#a9adb2', 0, 0, -0.3);
    for (const z of [-0.65, -0.4, -0.15]) {
      for (const x of [-0.04, 0.04]) put(p, box(0.012, 0.24, 0.012), '#d9822b', x, 0.06, z);
      put(p, box(0.3, 0.018, 0.02), '#d9822b', 0.08, 0.3, z);
    }
    put(p, box(0.13, 0.07, 0.62), '#1f3a5f', 0.2, -0.01, -0.45);
    for (let i = 0; i < 10; i++) put(p, box(0.045, 0.03, 0.08), ['#b91c1c', '#1d4ed8', '#15803d', '#d97706'][i % 4], 0.175 + (i % 2) * 0.05, 0.06 + Math.floor(i / 5) * 0.03, -0.7 + (i % 5) * 0.1);
    put(p, box(0.1, 0.09, 0.06), '#e5e7eb', 0.2, 0.06, -0.2);
    // Quixadá: monólitos
    const q = cityNamed('Quixadá');
    for (let i = 0; i < 11; i++) {
      const a = i * 0.9 + 0.4;
      const d = 0.95 + (i % 3) * 0.35;
      const [x, z] = [q.x + Math.cos(a) * d, q.z + Math.sin(a) * d];
      const m = put(this.scene, new THREE.IcosahedronGeometry(0.17 + (i % 4) * 0.055, 2), '#857a70', x, Y(x, z) + 0.06, z, { rough: 1 });
      m.scale.set(1, 1.3 + (i % 3) * 0.35, 0.85);
      m.rotation.y = i;
    }
    // Jericoacoara: dunas e pipas
    const je = cityNamed('Jijoca de Jericoacoara');
    for (let i = 0; i < 9; i++) {
      const [x, z] = [je.x - 0.7 + (i % 3) * 0.45 + (i % 2) * 0.2, je.z - 0.75 - Math.floor(i / 3) * 0.2];
      if (Y(x, z) < 0.12) continue;
      const m = put(this.scene, new THREE.SphereGeometry(0.22, 20, 10, 0, 6.3, 0, 1.57), '#ecd9a6', x, Y(x, z) - 0.02, z, { rough: 1 });
      m.scale.set(1.3, 0.42, 0.8);
    }
    for (const [n, dx, dz] of [['Jijoca de Jericoacoara', 0, -1.5], ['Caucaia', -0.2, -1.1], ['Aracati', 1.2, -0.7]] as const) for (let i = 0; i < 4; i++) {
      const c = cityNamed(n);
      const k = put(this.scene, new THREE.SphereGeometry(0.055, 10, 5, 0, Math.PI, 0, 0.8), ['#ef4444', '#facc15', '#22d3ee', '#a3e635'][i], c.x + dx + i * 0.22, 0.5, c.z + dz - (i % 2) * 0.2);
      k.userData.x = k.position.x;
      this.kites.push(k);
    }
    // Fortaleza: estádio, farol e jangadas
    const s = at('Fortaleza', -0.25, 1.28);
    put(s, new THREE.TorusGeometry(0.15, 0.045, 8, 28).rotateX(Math.PI / 2).scale(1.2, 1.1, 1), '#dfe4e8', 0, 0.05);
    put(s, box(0.2, 0.012, 0.14), '#3f8f3a');
    for (let i = 0; i < 6; i++) {
      const c = cityNamed(['Fortaleza', 'Aquiraz', 'Cascavel', 'Camocim', 'Acaraú', 'Icapuí'][i]);
      for (let k = 0; k < 3; k++) {
        // Procura água perto da cidade
        for (let t = 0; t < 20; t++) {
          const a = rand(0, 6.28);
          const d = rand(1, 2.4);
          const [x, z] = [c.x + Math.cos(a) * d, c.z + Math.sin(a) * d];
          if (Y(x, z) > -0.15) continue;
          const b = new THREE.Group();
          b.position.set(x, 0.03, z);
          b.rotation.y = rand(0, 6);
          put(b, box(0.11, 0.012, 0.035), '#8a6a45');
          put(b, new THREE.ConeGeometry(0.045, 0.12, 3).scale(1, 1, 0.12).translate(0, 0.08, 0), '#f6f3ea');
          this.add(b);
          this.kites.push(b);
          b.userData.boat = rand(0, 6);
          break;
        }
      }
    }
    // Santuário de Canindé
    const ca = at('Canindé', 0.5, -0.5);
    put(ca, box(0.14, 0.1, 0.24), '#e8e2d4');
    for (const x of [-0.05, 0.05]) {
      put(ca, box(0.04, 0.2, 0.04), '#e8e2d4', x, 0, 0.12);
      put(ca, new THREE.ConeGeometry(0.03, 0.07, 4), '#a0523d', x, 0.235, 0.12);
    }
    // Parques eólicos no litoral
    for (const [n, dx, dz] of [['Trairi', 0.3, -0.75], ['Aracati', 0.75, 0.2], ['Acaraú', 0.75, -0.25], ['Camocim', -0.6, -0.1], ['Beberibe', 0.5, -0.45], ['Amontada', 0.5, -0.8]] as const) {
      const c = cityNamed(n);
      for (let i = 0; i < 4; i++) {
        const [x, z] = [c.x + dx + (i % 2) * 0.28, c.z + dz + Math.floor(i / 2) * 0.28];
        if (Y(x, z) < 0.1) continue;
        const g = new THREE.Group();
        g.position.set(x, Y(x, z), z);
        put(g, cyl(0.008, 0.014, 0.42, 8), '#f4f6f8');
        const hub = new THREE.Group();
        hub.position.set(0.025, 0.42, 0);
        hub.rotation.x = i;
        for (let b = 0; b < 3; b++) put(hub, new THREE.BoxGeometry(0.008, 0.2, 0.018).translate(0, 0.1, 0), '#f4f6f8').rotation.x = (b * Math.PI * 2) / 3;
        g.add(hub);
        this.add(g);
        this.turbines.push(hub);
      }
    }
  }
  private makeCars() {
    const n = PHONE ? 110 : 240;
    const geo = mergeGeometries([plain(new THREE.BoxGeometry(0.05, 0.014, 0.024).translate(0, 0.012, 0), '#ffffff'), plain(new THREE.BoxGeometry(0.026, 0.012, 0.021).translate(-0.003, 0.025, 0), '#33404d'), plain(new THREE.BoxGeometry(0.003, 0.006, 0.02).translate(0.026, 0.013, 0), '#fff7cf')])!;
    this.cars = this.add(new THREE.InstancedMesh(geo, world(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.3 })), n));
    this.cars.frustumCulled = false;
    this.cars.castShadow = true;
    for (let i = 0; i < n; i++) {
      this.traffic.push({ road: Math.floor(Math.random() * ROADS.length), k: Math.random(), v: rand(0.06, 0.14), side: Math.random() < 0.5 ? 1 : -1 });
      this.cars.setColorAt(i, new THREE.Color(['#e5e7eb', '#3b4450', '#b91c1c', '#1d4ed8', '#9ca3af', '#f59e0b'][i % 6]));
    }
  }
  private weather() {
    const n = PHONE ? 700 : 1600;
    const pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const [x, y, z] = [Math.random(), Math.random(), Math.random()];
      pos.set([x, y, z, x, y + 0.035, z], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const ends = new Float32Array(n * 2).map((_, i) => i % 2);
    g.setAttribute('end', new THREE.BufferAttribute(ends, 1));
    this.rain = this.add(new THREE.LineSegments(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { time: U.time, at: { value: new THREE.Vector3() }, size: { value: 10 }, power: { value: 0 } },
      vertexShader: 'attribute float end; uniform float time,size; uniform vec3 at; varying float a; void main(){ vec3 p=position; p.y=fract(p.y-end*.035-time*1.5)+end*.035; a=1.-end*.8; vec3 w=at+(p-vec3(.5,.15,.5))*size; gl_Position=projectionMatrix*viewMatrix*vec4(w,1.); }',
      fragmentShader: 'uniform float power; varying float a; void main(){ gl_FragColor=vec4(.75,.82,.92,a*.4*power); }',
    })));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.rain.renderOrder = 5;
  }
  update(dt: number, at: THREE.Vector3, dist: number, sky: Sky, sun: THREE.Vector3) {
    U.time.value += dt;
    U.night.value = 1 - sky.light;
    U.wet.value += ((sky.rain > 0 ? 1 : 0) - U.wet.value) * Math.min(1, dt * 0.4);
    const d = this.dome.material.uniforms;
    d.sun.value.copy(sun);
    d.day.value = sky.light;
    d.warm.value = sky.warm;
    d.gray.value = Math.max(sky.rain, sky.mist);
    this.tall.emissiveIntensity = 0.12 + (1 - sky.light) * 1.15;
    this.lamps.material.opacity = Math.max(0, 0.9 - sky.light * 1.3);
    this.rain.visible = sky.rain > 0.02;
    if (this.rain.visible) {
      const r = this.rain.material.uniforms;
      r.at.value.copy(at);
      r.size.value = Math.max(6, dist * 1.3);
      r.power.value = sky.rain;
    }
    if (this.ownDirty) {
      this.ownDirty = false;
      this.ownTex.needsUpdate = true;
    }
    this.growGrass(at.x, at.z, dist);
    const close = dist < 30;
    this.cars.visible = close;
    if (!close) return;
    const t = U.time.value;
    for (const h of this.turbines) h.rotation.x += dt * 1.6;
    this.kites.forEach((k, i) => {
      if (k.userData.boat !== undefined) {
        k.rotation.z = Math.sin(t * 1.3 + k.userData.boat) * 0.08;
        k.position.y = 0.025 + Math.sin(t + k.userData.boat) * 0.008;
      } else k.position.set(k.userData.x + Math.sin(t * 0.6 + i) * 0.18, 0.5 + Math.sin(t * 1.1 + i * 2) * 0.08, k.position.z);
    });
    const m = new THREE.Matrix4();
    this.traffic.forEach((c, i) => {
      const [a, b] = ROADS[c.road];
      c.k += (c.v * dt * c.side) / Math.max(0.5, Math.hypot(a.x - b.x, a.z - b.z));
      if (c.k < 0 || c.k > 1) Object.assign(c, { road: Math.floor(Math.random() * ROADS.length), k: c.side > 0 ? 0 : 1 });
      const p = roadAt(c.road, c.k);
      const q = roadAt(c.road, c.k + 0.01 * c.side);
      const r = Math.atan2(q.z - p.z, q.x - p.x);
      const [x, z] = [p.x - Math.sin(r) * 0.024, p.z + Math.cos(r) * 0.024];
      this.cars.setMatrixAt(i, m.makeRotationY(-r).setPosition(x, Y(x, z) + 0.026, z));
    });
    this.cars.instanceMatrix.needsUpdate = true;
  }
}
export { BOUNDS, CITY, PHONE, Y, spread };
