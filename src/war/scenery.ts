import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CITIES, CITY, City, REGION_COLOR, ROADS, wx, wz } from './data';
import { facade, mat, relief } from './models';

/** Cenário do mundo: terreno, mar, céu, estradas, cidades, árvores e carros. */
export const H = 0.3;
export const PHONE = Math.min(window.innerWidth, window.innerHeight) < 700;
const ringPoints = (enc: number[]) => {
  const out: [number, number][] = [[enc[0], enc[1]]];
  for (let i = 2; i < enc.length; i += 2) out.push([out[out.length - 1][0] + enc[i], out[out.length - 1][1] + enc[i + 1]]);
  return out;
};
const RINGS = new Map(CITIES.map((c) => [c.id, c.rings.map((r) => ringPoints(r).map(([x, y]) => [wx(x), wz(y)] as const))]));
export const BOUNDS = (() => {
  let [x0, x1, z0, z1] = [1e9, -1e9, 1e9, -1e9];
  RINGS.forEach((l) => l.forEach((r) => r.forEach(([x, z]) => {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  })));
  return { x0: x0 - 1, x1: x1 + 1, z0: z0 - 1, z1: z1 + 1, w: x1 - x0 + 2, h: z1 - z0 + 2 };
})();
export const spread = (c: City) => Math.min(1.15, 0.26 + Math.sqrt(c.pop) / 1300);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

const NOISE = `
float h21(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<${PHONE ? 3 : 4};i++){ s+=a*vn(p); p=p*2.03+7.1; a*=.5; } return s; }`;

/** Terreno: relevo, lavouras e sombra de nuvens calculados por pixel, nítidos em qualquer distância */
function groundMaterial(time: { value: number }) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  m.onBeforeCompile = (s) => {
    s.uniforms.time = time;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvW=(modelMatrix*vec4(position,1.)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vW; uniform float time;${NOISE}`).replace('#include <color_fragment>', `#include <color_fragment>
      vec2 p=vW.xz;
      float big=fbm(p*.35), mid=fbm(p*2.1), tiny=vn(p*26.);
      float hill=(fbm(p*.9)-fbm(p*.9+vec2(.16,-.1)))*2.6+(mid-fbm(p*2.1+vec2(.14,-.09)))*1.5;
      vec3 dry=vec3(1.12,1.0,.78), wet=vec3(.74,.92,.62);
      diffuseColor.rgb*=mix(dry,wet,smoothstep(.36,.62,big))*(.8+.42*mid)*(.92+.16*tiny)*(1.+clamp(hill,-.45,.45));
      vec2 q=mat2(.92,.39,-.39,.92)*p*1.5; vec2 cell=floor(q); float crop=h21(cell);
      if(crop>.72 && big>.45){ vec2 f=fract(q); float edge=step(.06,f.x)*step(.06,f.y); float row=.9+.14*sin((crop>.86?q.x:q.y)*55.);
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*mix(vec3(1.25,1.12,.6),vec3(.7,1.05,.5),step(.86,crop))*row,edge*.75); }
      diffuseColor.rgb*=1.-.3*smoothstep(.5,.72,fbm(p*.075+vec2(time*.012,time*.007)));`);
  };
  return m;
}
/** Mar: ondas em movimento, água rasa e espuma na praia */
function seaMaterial(time: { value: number }, coast: THREE.Texture) {
  const m = new THREE.MeshStandardMaterial({ color: '#0f4f74', roughness: 0.16, metalness: 0.1 });
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, { time, coast: { value: coast }, box: { value: new THREE.Vector4(BOUNDS.x0, BOUNDS.z0, BOUNDS.w, BOUNDS.h) } });
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvW=(modelMatrix*vec4(position,1.)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vW; uniform float time; uniform sampler2D coast; uniform vec4 box;${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 p=vW.xz; vec2 uvc=(p-box.xy)/box.zw; float near=0.;
        if(uvc.x>0.&&uvc.x<1.&&uvc.y>0.&&uvc.y<1.) near=texture2D(coast,uvc).a;
        float w=fbm(p*1.4+vec2(time*.12,-time*.08));
        diffuseColor.rgb=mix(diffuseColor.rgb*(.8+.45*w),vec3(.16,.55,.58),smoothstep(.05,.8,near)*.7);
        float foam=smoothstep(.8,.95,sin(near*34.-time*1.5+w*7.)*.5+.5)*smoothstep(.3,.7,near)*w;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.93,.97,.98),clamp(foam*1.3,0.,.6));`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec2 o=vW.xz*3.; float a=vn(o+time*.5), b=vn(o+vec2(.2,0.)+time*.5), c=vn(o+vec2(0.,.2)+time*.5);
        normal=normalize(normal+(viewMatrix*vec4(a-b,0.,a-c,0.)).xyz*.9);`);
  };
  return m;
}
const gradientSky = () => {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#3f78b5');
  g.addColorStop(0.36, '#8fb6d6');
  g.addColorStop(0.5, '#e6dcc4');
  g.addColorStop(1, '#b9c4c8');
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
const roadTexture = () => {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = '#8b7c62';
  x.fillRect(0, 0, 64, 128);
  x.fillStyle = '#3d4147';
  x.fillRect(8, 0, 48, 128);
  x.fillStyle = 'rgba(255,255,255,.5)';
  x.fillRect(10, 0, 2, 128);
  x.fillRect(52, 0, 2, 128);
  x.fillStyle = '#e8c65a';
  x.fillRect(31, 10, 3, 60);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
};
/** Ponto de uma estrada (k de 0 a 1) */
function roadAt(i: number, k: number) {
  const [a, b] = ROADS[i];
  const bend = (((a.id + b.id) % 7) - 3) * 0.12;
  const mx = (a.x + b.x) / 2 + (b.z - a.z) * bend;
  const mz = (a.z + b.z) / 2 - (b.x - a.x) * bend;
  const u = 1 - k;
  return { x: u * u * a.x + 2 * u * k * mx + k * k * b.x, z: u * u * a.z + 2 * u * k * mz + k * k * b.z };
}

export class Scenery {
  private time = { value: 0 };
  private ground: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  private ranges = new Map<number, [number, number]>();
  private painted = new Map<number, string>();
  private cars: THREE.InstancedMesh;
  private traffic: { road: number; k: number; v: number; side: number }[] = [];
  /** Recorte do estado, para a névoa e as árvores */
  mask: HTMLCanvasElement;
  land: (x: number, z: number) => boolean;

  constructor(private scene: THREE.Scene) {
    this.mask = this.silhouette(256, 0);
    const data = this.mask.getContext('2d')!.getImageData(0, 0, 256, 256).data;
    this.land = (x, z) => data[(Math.floor(((z - BOUNDS.z0) / BOUNDS.h) * 256) * 256 + Math.floor(((x - BOUNDS.x0) / BOUNDS.w) * 256)) * 4 + 3] > 200;
    this.sky();
    this.sea();
    this.ground = this.terrain();
    this.urban();
    this.roads();
    this.towns();
    this.nature();
    this.cars = this.makeCars();
  }
  private add<T extends THREE.Object3D>(o: T) {
    this.scene.add(o);
    return o;
  }
  private silhouette(size: number, blur: number) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const m = c.getContext('2d', { willReadFrequently: true })!;
    const X = (x: number) => ((x - BOUNDS.x0) / BOUNDS.w) * size;
    const Z = (z: number) => ((z - BOUNDS.z0) / BOUNDS.h) * size;
    m.fillStyle = '#7f9270';
    if (blur) {
      m.shadowColor = '#000';
      m.shadowBlur = blur;
    }
    m.beginPath();
    RINGS.forEach((l) => l.forEach((r) => r.forEach(([x, z], i) => (i ? m.lineTo(X(x), Z(z)) : m.moveTo(X(x), Z(z))))));
    for (let i = 0; i < (blur ? 2 : 1); i++) m.fill();
    return c;
  }
  private sky() {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(190, 24, 16), new THREE.MeshBasicMaterial({ map: gradientSky(), side: THREE.BackSide, fog: false, depthWrite: false }));
    dome.renderOrder = -2;
    this.add(dome);
  }
  private sea() {
    const coast = new THREE.CanvasTexture(this.silhouette(512, 22));
    coast.flipY = false;
    const sea = this.add(new THREE.Mesh(new THREE.PlaneGeometry(420, 420), seaMaterial(this.time, coast)));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.04;
    // Estados vizinhos, só como fundo
    const pts = ([[-41.3, -2.95], [-43, -2.6], [-50, -2.2], [-60, -2], [-60, -25], [-25, -25], [-34.8, -8.2], [-34.85, -7], [-35.3, -5.1], [-36.2, -5.1], [-37.25, -4.85], [-38.6, -5.6], [-40, -5]] as const)
      .map(([lon, lat]) => new THREE.Vector2(wx((lon + 42) * 100), -wz((lat + 8) * 100)));
    const tex = relief().clone();
    tex.repeat.set(0.06, 0.06);
    tex.needsUpdate = true;
    const around = this.add(new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.2, bevelEnabled: false }).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6d6a55', roughness: 1, map: tex })));
    around.position.y = -0.03;
  }
  private terrain() {
    const geos: THREE.BufferGeometry[] = [];
    let at = 0;
    for (const c of CITIES) {
      const g = new THREE.ExtrudeGeometry(RINGS.get(c.id)!.map((r) => new THREE.Shape(r.map(([x, z]) => new THREE.Vector2(x, -z)))), { depth: H, bevelEnabled: false }).rotateX(-Math.PI / 2);
      const n = g.attributes.position.count;
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
      this.ranges.set(c.id, [at, n]);
      at += n;
      geos.push(g);
    }
    const mesh = this.add(new THREE.Mesh(mergeGeometries(geos)!, groundMaterial(this.time)));
    mesh.receiveShadow = true;
    this.ground = mesh;
    for (const c of CITIES) this.paint(c.id, '');
    return mesh;
  }
  /** Cor do dono sobre o município */
  paint(id: number, color: string) {
    if (this.painted.get(id) === color) return;
    this.painted.set(id, color);
    const [at, n] = this.ranges.get(id)!;
    const base = new THREE.Color(REGION_COLOR[CITY[id].region]).lerp(new THREE.Color('#8c8a6e'), 0.4);
    if (color) base.lerp(new THREE.Color(color), 0.34);
    const attr = this.ground.geometry.attributes.color as THREE.BufferAttribute;
    for (let i = at; i < at + n; i++) attr.setXYZ(i, base.r, base.g, base.b);
    attr.needsUpdate = true;
  }
  /** Chão urbano com ruas e limites municipais */
  private urban() {
    const px = PHONE ? 26 : 44;
    const cv = document.createElement('canvas');
    cv.width = Math.round(BOUNDS.w * px);
    cv.height = Math.round(BOUNDS.h * px);
    const ctx = cv.getContext('2d')!;
    const X = (x: number) => (x - BOUNDS.x0) * px;
    const Z = (z: number) => (z - BOUNDS.z0) * px;
    ctx.strokeStyle = 'rgba(25,24,16,.3)';
    ctx.lineWidth = px * 0.035;
    ctx.beginPath();
    RINGS.forEach((l) => l.forEach((r) => r.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z))))));
    ctx.stroke();
    for (const c of CITIES) {
      const r = spread(c) * px * 1.18;
      const g = ctx.createRadialGradient(X(c.x), Z(c.z), 0, X(c.x), Z(c.z), r);
      g.addColorStop(0, 'rgba(138,138,136,.95)');
      g.addColorStop(0.75, 'rgba(140,134,122,.8)');
      g.addColorStop(1, 'rgba(140,128,105,0)');
      ctx.fillStyle = g;
      ctx.fillRect(X(c.x) - r, Z(c.z) - r, r * 2, r * 2);
      // Ruas em quadras
      ctx.strokeStyle = 'rgba(70,72,78,.5)';
      ctx.lineWidth = Math.max(1, px * 0.022);
      ctx.beginPath();
      const s = spread(c);
      for (let k = -s; k <= s; k += 0.17) {
        const o = Math.round(k / 0.17) * 0.17 + 0.0425;
        const len = Math.sqrt(Math.max(0, s * s - o * o));
        ctx.moveTo(X(c.x + o), Z(c.z - len));
        ctx.lineTo(X(c.x + o), Z(c.z + len));
        ctx.moveTo(X(c.x - len), Z(c.z + o));
        ctx.lineTo(X(c.x + len), Z(c.z + o));
      }
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const m = this.add(new THREE.Mesh(new THREE.PlaneGeometry(BOUNDS.w, BOUNDS.h).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 })));
    m.position.set((BOUNDS.x0 + BOUNDS.x1) / 2, H + 0.005, (BOUNDS.z0 + BOUNDS.z1) / 2);
    m.receiveShadow = true;
    m.renderOrder = 1;
  }
  private roads() {
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const N = 14;
    ROADS.forEach((_, r) => {
      let len = 0;
      for (let i = 0; i <= N; i++) {
        const p = roadAt(r, i / N);
        const n = roadAt(r, Math.min(1, (i + 0.5) / N));
        const b = roadAt(r, Math.max(0, (i - 0.5) / N));
        const a = Math.atan2(n.z - b.z, n.x - b.x) + Math.PI / 2;
        if (i) {
          const o = roadAt(r, (i - 1) / N);
          len += Math.hypot(p.x - o.x, p.z - o.z);
        }
        const at = pos.length / 3;
        const w = 0.06;
        pos.push(p.x + Math.cos(a) * w, H + 0.008, p.z + Math.sin(a) * w, p.x - Math.cos(a) * w, H + 0.008, p.z - Math.sin(a) * w);
        uv.push(0, len * 4, 1, len * 4);
        if (i) idx.push(at - 2, at, at - 1, at, at + 1, at - 1);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const m = this.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.95, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -10 })));
    m.receiveShadow = true;
    m.renderOrder = 1;
  }
  private towns() {
    const box = (w: number, h: number, d: number, y: number) => new THREE.BoxGeometry(w, h, d).translate(0, y, 0).toNonIndexed();
    const house = mergeGeometries([box(1, 0.6, 0.85, 0.3), new THREE.CylinderGeometry(0.01, 0.66, 0.42, 4, 1).rotateY(Math.PI / 4).scale(1.1, 1, 0.95).translate(0, 0.81, 0).toNonIndexed()])!;
    const tower = mergeGeometries([box(1, 1, 1, 0.5), box(0.7, 0.08, 0.7, 1.04), box(0.2, 0.06, 0.3, 1.1)])!;
    const step = mergeGeometries([box(1, 0.6, 1, 0.3), box(0.72, 0.3, 0.72, 0.75), box(0.42, 0.14, 0.42, 0.97)])!;
    const lists = { house: [] as THREE.Matrix4[], tower: [] as THREE.Matrix4[], step: [] as THREE.Matrix4[] };
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const c of CITIES) {
      const s0 = spread(c);
      const n = Math.min(PHONE ? 80 : 130, 10 + Math.round(Math.sqrt(c.pop) / 11));
      const used = new Set<string>();
      for (let i = 0; i < n; i++) {
        // Lotes alinhados às ruas
        const a = rnd() * 6.283;
        const d = Math.sqrt(0.05 + rnd() * 0.95) * s0;
        const gx = Math.round((Math.cos(a) * d) / 0.085);
        const gz = Math.round((Math.sin(a) * d) / 0.085);
        const key = `${gx},${gz}`;
        if (Math.hypot(gx, gz) * 0.085 < 0.15 || used.has(key)) continue;
        used.add(key);
        const s = 0.05 + rnd() * 0.016;
        const big = c.pop > 60_000 && rnd() < (d < s0 * 0.55 ? 0.75 : 0.22);
        const h = 1.5 + rnd() * (c.pop > 1e6 ? 8 : 3.2) * (1.15 - d / s0);
        const m = new THREE.Matrix4().makeRotationY(Math.floor(rnd() * 4) * (Math.PI / 2)).setPosition(c.x + gx * 0.085, H, c.z + gz * 0.085);
        m.scale(big ? new THREE.Vector3(s, s * h, s) : new THREE.Vector3(s, s, s));
        (big ? (rnd() < 0.3 ? lists.step : lists.tower) : lists.house).push(m);
      }
    }
    const put = (geo: THREE.BufferGeometry, m: THREE.Material, list: THREE.Matrix4[], tints: string[]) => {
      const mesh = new THREE.InstancedMesh(geo, m, list.length);
      list.forEach((x, i) => {
        mesh.setMatrixAt(i, x);
        mesh.setColorAt(i, new THREE.Color(tints[(i * 7) % tints.length]));
      });
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.add(mesh);
    };
    const tall = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.3, emissiveMap: facade(), emissive: '#ffdf9a', emissiveIntensity: 0.3 });
    put(house, new THREE.MeshStandardMaterial({ roughness: 0.9 }), lists.house, ['#cdbfa8', '#e2dccf', '#b8a48c', '#b36a4c', '#d3cdc4', '#c7b48b', '#9c5a43']);
    put(tower, tall, lists.tower, ['#c8d2da', '#8ea2b4', '#e4e6e6', '#b9aa93', '#738ba0', '#5f7f9c']);
    put(step, tall, lists.step, ['#d9dfe3', '#9fb3c2', '#c9bda8']);
  }
  private nature() {
    const prep = (g: THREE.BufferGeometry) => {
      const n = g.index ? g.toNonIndexed() : g;
      n.deleteAttribute('uv');
      return n;
    };
    const trunk = () => prep(new THREE.CylinderGeometry(0.01, 0.016, 0.07, 5).translate(0, 0.035, 0));
    const bush = mergeGeometries([trunk(), prep(new THREE.IcosahedronGeometry(0.055, 1).scale(1.1, 0.85, 1).translate(0, 0.1, 0)), prep(new THREE.IcosahedronGeometry(0.036, 1).translate(0.04, 0.085, 0.02))])!;
    // Carnaúba, a palmeira do Ceará
    const leaf = (i: number) => prep(new THREE.ConeGeometry(0.018, 0.1, 3).rotateZ(-1.25).translate(0.05, 0, 0).rotateY((i * Math.PI) / 3).translate(0, 0.2, 0));
    const palm = mergeGeometries([prep(new THREE.CylinderGeometry(0.006, 0.011, 0.2, 5).translate(0, 0.1, 0)), ...[0, 1, 2, 3, 4, 5].map(leaf)])!;
    const place = (geo: THREE.BufferGeometry, want: number, tints: string[]) => {
      const list: THREE.Matrix4[] = [];
      for (let i = 0; i < want * 4 && list.length < want; i++) {
        const x = rand(BOUNDS.x0, BOUNDS.x1);
        const z = rand(BOUNDS.z0, BOUNDS.z1);
        // Bosques: várias juntas
        for (let k = 0; k < 4 && list.length < want; k++) {
          const px = x + rand(-0.4, 0.4);
          const pz = z + rand(-0.4, 0.4);
          if (px < BOUNDS.x0 || px > BOUNDS.x1 || pz < BOUNDS.z0 || pz > BOUNDS.z1 || !this.land(px, pz) || CITIES.some((c) => Math.hypot(c.x - px, c.z - pz) < spread(c) + 0.5)) continue;
          const s = rand(0.7, 1.5);
          list.push(new THREE.Matrix4().makeRotationY(rand(0, 6)).setPosition(px, H, pz).scale(new THREE.Vector3(s, s, s)));
        }
      }
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide }), list.length);
      list.forEach((m, i) => {
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, new THREE.Color(tints[i % tints.length]));
      });
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.add(mesh);
    };
    place(bush, PHONE ? 900 : 2200, ['#4c6230', '#5d7038', '#3c5429', '#6f713c']);
    place(palm, PHONE ? 350 : 800, ['#5c7a35', '#6b8440', '#4c6a2c']);
  }
  private makeCars() {
    const n = PHONE ? 90 : 180;
    const geo = mergeGeometries([new THREE.BoxGeometry(0.05, 0.014, 0.024).translate(0, 0.012, 0).toNonIndexed(), new THREE.BoxGeometry(0.026, 0.012, 0.021).translate(-0.003, 0.025, 0).toNonIndexed()])!;
    const m = this.add(new THREE.InstancedMesh(geo, mat('#ffffff', { rough: 0.35, metal: 0.3 }), n));
    m.frustumCulled = false;
    for (let i = 0; i < n; i++) {
      this.traffic.push({ road: Math.floor(Math.random() * ROADS.length), k: Math.random(), v: rand(0.06, 0.14), side: Math.random() < 0.5 ? 1 : -1 });
      m.setColorAt(i, new THREE.Color(['#e5e7eb', '#1f2937', '#b91c1c', '#1d4ed8', '#9ca3af', '#f59e0b'][i % 6]));
    }
    return m;
  }
  update(dt: number, close: boolean) {
    this.time.value += dt;
    this.cars.visible = close;
    if (!close) return;
    const m = new THREE.Matrix4();
    this.traffic.forEach((t, i) => {
      const [a, b] = ROADS[t.road];
      t.k += (t.v * dt * t.side) / Math.max(0.5, Math.hypot(a.x - b.x, a.z - b.z));
      if (t.k < 0 || t.k > 1) Object.assign(t, { road: Math.floor(Math.random() * ROADS.length), k: t.side > 0 ? 0 : 1 });
      const p = roadAt(t.road, t.k);
      const q = roadAt(t.road, t.k + 0.01 * t.side);
      const d = Math.atan2(q.z - p.z, q.x - p.x);
      this.cars.setMatrixAt(i, m.makeRotationY(-d).setPosition(p.x - Math.sin(d) * 0.024, H + 0.01, p.z + Math.cos(d) * 0.024));
    });
    this.cars.instanceMatrix.needsUpdate = true;
  }
}
