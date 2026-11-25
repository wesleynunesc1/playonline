import React, { useEffect, useRef, useState } from 'react';
import { quad } from '../../fx/gl';
import { COUNTRIES } from '../../data/countries';
import { hooks } from '../../engine/state';

const SECONDS = 8.5;
/** Cogumelo nuclear volumétrico (ray marching) sobre uma cidade ao entardecer. */
const FRAG = `
precision highp float;
uniform vec2 res; uniform float t; uniform float steps;
float hash(vec3 p){ p = fract(p*.3183099+.1); p *= 17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s += a*noise(p); p = p*2.03 + 7.1; a *= .5; } return s; }
float smin(float a,float b,float k){ float h=clamp(.5+.5*(b-a)/k,0.,1.); return mix(b,a,h)-k*h*(1.-h); }
float shape(vec3 p){
  float g = 1. - exp(-t*.55);
  float top = .25 + 3.1*g;
  float capR = .35 + 1.25*g;
  vec3 c = p - vec3(0., top, 0.);
  float ring = length(vec2(length(c.xz) - capR*.62, c.y*1.15)) - capR*.5;
  float dome = length(c * vec3(1.,1.45,1.)) - capR*.78;
  float cap = smin(ring, dome, .35);
  float r = length(p.xz);
  float stem = max(r - (.2 + .12*g + .55*exp(-p.y*2.4) + .1*smoothstep(top*.5, top, p.y)), p.y - top);
  float skirt = length(vec2(r - (.5+1.0*g)*.55, (p.y - top*.52)*2.6)) - .16*g;
  float baseR = .4 + 2.6*g;
  float base = length(vec2(max(r - baseR, 0.) , (p.y - .12)*1.6)) - (.16 + .22*g);
  return smin(smin(smin(cap, stem, .3), skirt, .2), base, .35);
}
float density(vec3 p, out float heat){
  float d = shape(p);
  heat = 0.;
  if(d > .55) return 0.;
  float g = 1. - exp(-t*.55);
  vec3 c = p - vec3(0., .25+3.1*g, 0.);
  // A nuvem gira sobre si mesma, subindo por dentro
  float roll = t*.55;
  vec3 q = p*1.7; q.y -= t*.42; q.xz *= 1. + .1*sin(roll + c.y*2.);
  float n = fbm(q + fbm(q*1.6)*.9);
  float v = -d + (n - .46)*1.05;
  heat = clamp((v*1.5 + .22 + .35*smoothstep(.2,-.5,c.y)*smoothstep(1.2,.1,length(c.xz))) * exp(-t*.2) * 1.5 - .1*length(c.xz), 0., 1.5);
  return clamp(v*3.2, 0., 1.);
}
float building(vec2 p, float layer){
  float x = p.x*(30.-layer*7.) + layer*9.; float id = floor(x);
  float r = hash(vec3(id, layer, 3.));
  float h = .035 + .13*r*r*(.45+.55*noise(vec3(p.x*3.,layer*4.,1.))) ;
  float f = fract(x);
  h += step(.42,f)*step(f,.58)*step(.8,r)*.03 + step(.2,f)*step(f,.8)*.008;
  float gap = step(.06, f);
  return gap * step(p.y, h);
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5*res)/res.y;
  float shock = max(0., t - 1.1);
  float shake = exp(-shock*1.2) * step(1.1, t) * .022;
  uv += shake * vec2(sin(t*71.), cos(t*83.));
  vec2 s = uv + vec2(0., .5);
  vec3 sky = mix(vec3(.95,.42,.16), vec3(.07,.09,.2), smoothstep(-.02,.75,s.y-.14));
  sky = mix(sky, vec3(.13,.11,.12), clamp(t*.09,0.,.65));
  float flash = exp(-abs(t-.9)*2.4);
  float glow = exp(-max(t-.9,0.)*.42) * step(.8,t);
  vec3 col = sky + vec3(1.,.55,.2) * glow * .95 * exp(-length(uv - vec2(0.,-.12))*1.9);
  // Ogiva caindo
  if(t < .9){ vec2 a = uv - vec2((.9-t)*.55, -.3 + (.9-t)*1.1); float k = dot(a, normalize(vec2(.45,.9))); float w = length(a - normalize(vec2(.45,.9))*k);
    col += vec3(1.,.85,.6) * smoothstep(.012,.0,w) * smoothstep(.5,0.,k) * step(0.,k) + vec3(1.)*smoothstep(.016,0.,length(a)); }
  // Anel de condensação
  if(shock > 0.){ float rr = shock*.5; float ring = abs(length((uv - vec2(0.,-.1))*vec2(1.,1.25)) - rr); col += vec3(.9,.92,1.) * smoothstep(.035,0.,ring) * exp(-shock*1.3) * .75; }
  // Volume
  if(t > .85){
    vec3 ro = vec3(0., 1.55, -8.2), rd = normalize(vec3(uv.x, uv.y + .02, 1.22));
    float z = 5.2, T = 1.; vec3 acc = vec3(0.);
    float dz = 6. / steps;
    z += dz * hash(vec3(gl_FragCoord.xy, t));
    for(int i=0;i<72;i++){
      if(float(i) >= steps || T < .03) break;
      vec3 p = ro + rd*z; p.y += .02;
      if(p.y > -.15){
        float heat; float d = density(p, heat);
        if(d > .01){
          float hh; float occ = density(p + vec3(-.25,.42,-.28), hh);
          vec3 smoke = mix(vec3(.1,.075,.065), vec3(.72,.56,.43), clamp(1. - occ*.95, 0., 1.)) * (.3 + .55*smoothstep(-1.,3.,p.y)) ;
          smoke *= mix(vec3(1.,.62,.38), vec3(1.), clamp(t*.14,0.,1.));
          vec3 fire = vec3(2.5,.72,.1)*heat*heat + vec3(2.6,1.7,.7)*pow(heat,4.);
          float a = 1. - exp(-d*dz*4.6);
          acc += T*a*(smoke + fire); T *= 1.-a;
        }
      }
      z += dz;
    }
    col = col*T + acc;
  }
  // Cidade em silhueta, varrida pela onda de choque
  for(float L=0.; L<3.; L++){
    vec2 bp = s*vec2(1.,1.) - vec2(0., .0 + (2.-L)*.035);
    float fallen = smoothstep(0., .5, shock - abs(uv.x)*1.1 - (2.-L)*.12);
    float b = building(vec2(bp.x, bp.y / max(.12, 1. - fallen*.85)), L);
    vec3 bc = mix(vec3(.2,.12,.1), vec3(.012,.012,.018), L*.5) + vec3(1.,.5,.2)*glow*.12*(2.-L)*.5;
    float win = step(.8, hash(vec3(floor(bp*vec2(240.,170.)), L))) * step(.3, fract(bp.x*240.)) * step(.35, fract(bp.y*170.)) * step(t,.9 + .2*hash(vec3(floor(bp.x*40.),L,1.)));
    bc += vec3(1.,.78,.42)*win*.55*step(.5,L);
    bc += vec3(1.,.35,.06)*fallen*.5*pow(noise(vec3(bp*26., t*2.)),3.);
    col = mix(col, bc, b);
  }
  // Parede de poeira chegando na câmera
  float dust = smoothstep(2.6, 6.2, t) * smoothstep(.55,-.1, s.y - fbm(vec3(uv*3., t*.7))*.5);
  col = mix(col, vec3(.3,.21,.15)*(.7+.5*fbm(vec3(uv*5.+t*.5, t))), dust*.85);
  vec2 au = (uv + vec2(sin(t*.7+uv.y*5.)*.03, t*.09))*70.; float ah = hash(vec3(floor(au), 1.));
  float ash = step(.985, ah) * smoothstep(.22*fract(ah*97.)+.04, 0., length(fract(au)-.5));
  col += vec3(.5,.42,.36)*ash*smoothstep(2.4,4.5,t)*.6;
  col += vec3(1.,.97,.9) * flash * 5. * step(.55,t);
  col *= 1. - .5*dot(uv,uv);
  col = 1. - exp(-col*1.15);
  col *= smoothstep(${SECONDS.toFixed(1)}, ${(SECONDS - 0.8).toFixed(1)}, t);
  gl_FragColor = vec4(col, 1.);
}`;

/** Cena em tela cheia quando uma bomba atômica atinge um país. Toque para pular. */
export const NukeCinematic: React.FC = () => {
  const [target, setTarget] = useState('');
  useEffect(() => {
    hooks.nuke = (id) => setTarget(id);
    return () => { hooks.nuke = () => {}; };
  }, []);
  if (!target) return null;
  return <Scene key={target} target={target} onEnd={() => setTarget('')} />;
};

const Scene: React.FC<{ target: string; onEnd: () => void }> = ({ target, onEnd }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const end = useRef(onEnd);
  end.current = onEnd;
  useEffect(() => {
    const canvas = ref.current!;
    const q = quad(canvas, FRAG);
    const timer = setTimeout(() => end.current(), q ? SECONDS * 1000 : 1500);
    if (!q) return () => clearTimeout(timer);
    const [res, t, steps] = ['res', 't', 'steps'].map(q.uniform);
    // O volume é caro: resolução baixa, ampliada com suavização
    let height = Math.min(360, window.innerHeight * 0.5);
    let quality = 56;
    let raf = 0;
    let last = 0;
    const start = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (last && now - last > 45) {
        height = Math.max(130, height * 0.94);
        quality = Math.max(26, quality - 2);
      }
      last = now;
      const h = Math.round(height);
      const w = Math.round((h * window.innerWidth) / window.innerHeight);
      if (Math.abs(canvas.height - h) > 12 || canvas.width < 2) {
        canvas.width = w;
        canvas.height = h;
        q.gl.viewport(0, 0, w, h);
      }
      q.gl.uniform2f(res, canvas.width, canvas.height);
      q.gl.uniform1f(t, (now - start) / 1000);
      q.gl.uniform1f(steps, quality);
      q.draw();
    };
    raf = requestAnimationFrame(frame);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      q.destroy();
    };
  }, []);
  return (
    <div className="nuke-scene fixed inset-0 z-[70] bg-black" onPointerDown={() => end.current()}>
      <canvas ref={ref} className="w-full h-full" />
      <div className="absolute inset-x-0 bottom-[12%] text-center pointer-events-none">
        <p className="nuke-title text-3xl sm:text-6xl font-black tracking-[0.2em] text-white">{COUNTRIES[target]?.name.toUpperCase()}</p>
        <p className="nuke-title text-xs sm:text-sm tracking-[0.4em] text-orange-200">DETONAÇÃO NUCLEAR CONFIRMADA</p>
      </div>
      <p className="absolute bottom-3 inset-x-0 text-center text-[11px] text-white/50">Toque para pular</p>
    </div>
  );
};
