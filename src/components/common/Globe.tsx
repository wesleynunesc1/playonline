import React, { useEffect, useRef } from 'react';
import { quad } from '../../fx/gl';

/** Planeta fotorrealista: satélite, noite com cidades, nuvens, relevo, reflexo do mar e atmosfera. */
const FRAG = `
precision highp float;
uniform vec2 res; uniform float time; uniform vec2 offset; uniform float radius;
uniform sampler2D day, night, data;
const float PI = 3.14159265;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
vec2 uvOf(vec3 n, float spin){ return vec2(fract(atan(n.x, n.z) / (2.*PI) + .5 + spin), .5 - asin(clamp(n.y,-1.,1.)) / PI); }
vec3 stars(vec2 p){
  vec3 c = vec3(0.);
  for(float i=0.;i<3.;i++){
    vec2 g = p * (70. + i*60.); vec2 id = floor(g); float h = hash(id + i*17.);
    if(h > .975){ float d = length(fract(g) - .5); c += vec3(.8,.9,1.) * smoothstep(.16,.0,d) * (h-.975)*40. * (.6 + .4*sin(time*2. + h*900.)); }
  }
  float band = exp(-pow((p.y*.8 + p.x*.45), 2.) * 9.);
  return c + vec3(.05,.06,.1) * band * (.5 + .5*hash(floor(p*240.)));
}
void main(){
  vec2 p = (gl_FragCoord.xy - .5*res) / min(res.x, res.y) - offset;
  float R = radius, d = length(p);
  vec3 sun = normalize(vec3(-.75, .42, .5));
  vec3 col = stars(gl_FragCoord.xy / res.y);
  // Sol distante
  vec2 sp = p - vec2(-.78, .5) * R * 1.35; float sd = length(sp);
  col += vec3(1.,.85,.6) * (.02 / (sd*sd + .02)) * .55 * smoothstep(R*.98, R*1.1, d);
  float edge = d - R;
  // Halo da atmosfera
  vec3 dir = vec3(p / max(d, .001), 0.);
  float lit = clamp(dot(dir, sun) * .6 + .55, 0., 1.);
  col += vec3(.25,.55,1.) * exp(-max(edge,0.) / (R*.055)) * lit * .95 * step(0., edge);
  if(edge < 0.){
    vec3 n = vec3(p / R, sqrt(max(0., 1. - d*d/(R*R))));
    float tilt = .32; mat3 rx = mat3(1.,0.,0., 0.,cos(tilt),-sin(tilt), 0.,sin(tilt),cos(tilt));
    vec3 w = rx * n;
    float spin = time * .006;
    vec2 uv = uvOf(w, spin);
    vec3 dat = texture2D(data, uv).rgb;
    float e = 1./1536.;
    float hx = texture2D(data, vec2(fract(uv.x+e), uv.y)).g - texture2D(data, vec2(fract(uv.x-e), uv.y)).g;
    float hy = texture2D(data, uv + vec2(0.,e*2.)).g - texture2D(data, uv - vec2(0.,e*2.)).g;
    float water = dat.b;
    vec3 tx = normalize(cross(vec3(0.,1.,0.), n)); vec3 ty = cross(n, tx);
    vec3 bn = normalize(n + (tx * -hx + ty * hy) * 2.2 * (1.-water));
    float nl = dot(n, sun), bl = max(dot(bn, sun), 0.);
    float dayMix = smoothstep(-.12, .28, nl);
    vec3 land = texture2D(day, uv).rgb;
    vec3 surf = pow(land, vec3(.92)) * 1.25 * (bl*1.1 + .04);
    vec3 h = normalize(sun + vec3(0.,0.,1.));
    surf += vec3(1.,.86,.62) * pow(max(dot(n,h),0.), 60.) * water * .9 + vec3(.2,.4,.6) * pow(max(dot(n,h),0.), 9.) * water * .18;
    vec3 ntx = texture2D(night, uv).rgb;
    float city = smoothstep(.22, .7, ntx.r);
    vec3 dark = land * vec3(.012,.02,.045) + vec3(1.,.72,.36) * city * 1.9;
    vec3 c = mix(dark, surf, dayMix);
    float cl = texture2D(data, uvOf(w, spin*1.35 + .11)).r;
    float sh = texture2D(data, uvOf(normalize(w - sun*.018), spin*1.35 + .11)).r;
    c *= 1. - sh * .42 * dayMix;
    vec3 cloud = mix(vec3(.02,.025,.04), vec3(1.05,1.02,.98) * (max(nl,0.)*1.05 + .05), dayMix);
    c = mix(c, cloud, smoothstep(.08,.85,cl) * .92);
    // Faixa alaranjada do entardecer
    c += vec3(.9,.32,.08) * exp(-pow((nl-.06)*8.,2.)) * .16;
    float fr = pow(1. - n.z, 3.2);
    c = mix(c, vec3(.36,.64,1.) * (.25 + max(nl+.25,0.)), fr * .72 * smoothstep(-.35,.25,nl));
    float aa = smoothstep(0., -2./min(res.x,res.y), edge);
    col = mix(col, c, aa);
  }
  col = 1. - exp(-col * 1.45);
  gl_FragColor = vec4(pow(col, vec3(.92)), 1.);
}`;

const FRAME_MS = 30;

export const Globe: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const q = quad(canvas, FRAG);
    if (!q) return;
    ['earth-day', 'earth-night', 'earth-data'].forEach((n, i) => q.texture(i, `/img/${n}.webp`));
    const u = (n: string) => q.uniform(n);
    q.gl.uniform1i(u('day'), 0);
    q.gl.uniform1i(u('night'), 1);
    q.gl.uniform1i(u('data'), 2);
    const [res, time, offset, radius] = ['res', 'time', 'offset', 'radius'].map(u);
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = -100;
    let scale = Math.min(1.5, window.devicePixelRatio || 1);
    let slow = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const gap = now - last;
      if (gap < FRAME_MS) return;
      // Aparelho lento: reduz a resolução em vez de engasgar
      if (last > 0 && gap > 60 && ++slow > 12 && scale > 0.5) {
        scale *= 0.75;
        slow = 0;
      }
      last = now;
      const w = Math.round(canvas.clientWidth * scale);
      const h = Math.round(canvas.clientHeight * scale);
      if (!w || !h) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        q.gl.viewport(0, 0, w, h);
      }
      const wide = w / h > 1.15;
      q.gl.uniform2f(res, w, h);
      q.gl.uniform1f(time, still ? 0 : now / 1000);
      q.gl.uniform2f(offset, wide ? Math.min(0.55, (w / h) * 0.26) : 0, wide ? 0 : 0.28);
      q.gl.uniform1f(radius, wide ? 0.43 : 0.46);
      q.draw();
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      q.destroy();
    };
  }, []);
  return <canvas ref={ref} aria-hidden="true" className="fixed inset-0 w-full h-full pointer-events-none" />;
};
