import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo';
import { useApp } from '../../ui';
import { COUNTRIES, COUNTRY_IDS, NUMERIC_TO_COUNTRY } from '../../data/countries';
import { Game, PLAYER, STRIKE_MS, ZOMBIES, game, hooks, isHuman, rivalDef, useGame } from '../../engine/state';
import { L, colorOf, playerOf } from '../../lan/match';
import { myHotspots, reach, warFronts } from '../../engine/calc';
import { MapFx } from '../../fx/mapFx';
import { useWorldGeo } from '../../services/worldGeo';
import { ZoomIn, ZoomOut, LocateFixed, Loader2 } from 'lucide-react';

const W = 1000;
const H = 520;
const MIN_K = 1;
const MAX_K = 14;
const DRAG_THRESHOLD_PX = 6;
const MARKER_PX = 22;
const ALERT_ICON = { terra: '🪖', mar: '🚢', ar: '✈️', bomba: '💣', nuclear: '☢️', inimigo: '🚀', sabotagem: '💥', ciber: '💻', carta: '⚡', meteoro: '☄️' };
const DETAIL_PX_PER_UNIT = 4;

type CountryId = string;
type Threat = NonNullable<Game['threat']>;
interface View { k: number; x: number; y: number }
interface Shape { key: string; d: string; countryId?: CountryId }
type Point = [number, number];

const clampView = (v: View): View => {
  const k = Math.min(MAX_K, Math.max(MIN_K, v.k));
  return {
    k,
    x: Math.min(W * 0.4, Math.max(W * (1 - k) - W * 0.4, v.x)),
    y: Math.min(H * 0.8, Math.max(H * (1 - k) - H * 0.8, v.y)),
  };
};

/** Estado visual de cada país em texto, para redesenhar só quando algo muda */
function visualOf(id: string, g: Game, reachable: boolean, selected: string): string {
  const c = g.countries[id];
  const fill = c.owner === PLAYER ? (id === g.capital ? 'capital' : 'owned') : c.sab > 0 ? 'sabotaged' : c.owner || (c.vassal ? 'vassal' : 'rival');
  return `${fill}|${id === selected ? 'land-selected' : g.threat?.target === id ? 'land-threat' : g.mode === 'lan' && L.mode === 'colina' && L.hill === id ? 'land-hill' : c.siege ? 'land-siege' : reachable ? 'land-reach' : ''}`;
}

/** Polígonos dos países. Memoizado: não re-renderiza ao arrastar/zoom. */
const CountryShapes = memo(function CountryShapes({ shapes, visuals }: { shapes: Shape[]; visuals: string }) {
  const look = Object.fromEntries(visuals.split(';').map((v) => v.split(':')));
  return (
    <g>
      {shapes.map(({ key, d, countryId }) => {
        if (!countryId) return <path key={key} d={d} className="land-inert" vectorEffect="non-scaling-stroke" />;
        const [fill, extra] = (look[countryId] as string).split('|');
        const rival = /^[rh]\d/.test(fill);
        return (
          <path key={key} d={d} data-id={countryId} vectorEffect="non-scaling-stroke"
            className={`land-playable ${rival ? '' : `land-${fill}`} ${extra}`}
            style={rival ? { fill: rivalDef(fill).color } : undefined} />
        );
      })}
    </g>
  );
});

function arcPath([x1, y1]: Point, [x2, y2]: Point): string {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 - dist * 0.35;
  return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
}

/** Comboios entre a capital e os territórios conquistados */
const SupplyLayer = memo(function SupplyLayer({ capital, owned, anchors, scale }: {
  capital: CountryId;
  owned: string;
  anchors: Record<CountryId, Point>;
  scale: number;
}) {
  return (
    <g pointerEvents="none">
      {(owned ? (owned.split(',') as CountryId[]) : []).map((id, i) => {
        const d = arcPath(anchors[capital], anchors[id]);
        return (
          <g key={id}>
            <path d={d} className="supply-path" vectorEffect="non-scaling-stroke" />
            <circle r={2.6 * scale} fill="#fde68a">
              <animateMotion dur={`${4 + (i % 4)}s`} begin={`${-i * 0.7}s`} path={d} repeatCount="indefinite" />
            </circle>
          </g>
        );
      })}
    </g>
  );
});

const ThreatLayer = ({ threat, from, anchors }: { threat: Threat; from?: CountryId; anchors: Record<CountryId, Point> }) => (
  <path
    d={arcPath(from ? anchors[from] : [anchors[threat.target][0], -60], anchors[threat.target])}
    className="threat-path"
    vectorEffect="non-scaling-stroke"
    pointerEvents="none"
  />
);

export const InteractiveMap: React.FC = () => {
  const geo = useWorldGeo();
  const tickVersion = useGame();
  const g = game();
  const selected = useApp((s) => s.selected);
  const selectCountry = useApp((s) => s.select);
  const { threat, capital } = g;
  const lastTap = useRef({ at: 0, x: 0, y: 0 });
  const playerCountryId = capital;
  // Um passo de jogo = um recálculo; arrastar o mapa não passa por aqui
  const { visuals, reachable } = useMemo(() => {
    const near = new Set(COUNTRY_IDS.filter((id) => g.countries[id].owner !== PLAYER && reach(id) && !g.countries[id].vassal));
    return { reachable: near, visuals: COUNTRY_IDS.map((id) => `${id}:${visualOf(id, g, near.has(id), selected)}`).join(';') };
  }, [g, tickVersion, selected]);

  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });
  const [unitPx, setUnitPx] = useState(1);
  const viewRef = useRef(view);
  viewRef.current = view;

  // ---------- Projeção geográfica ----------
  const projection = useMemo(() => (geo ? geoNaturalEarth1().fitExtent([[8, 8], [W - 8, H - 8]], geo) : null), [geo]);
  const shapes = useMemo<Shape[]>(() => {
    if (!geo || !projection) return [];
    const path = geoPath(projection);
    return geo.features.map((f, i) => ({
      key: String(f.id ?? i),
      d: path(f) ?? '',
      countryId: NUMERIC_TO_COUNTRY[String(f.id)],
    }));
  }, [geo, projection]);
  const ownedKey = COUNTRY_IDS.filter((id) => g.countries[id].owner === PLAYER && id !== playerCountryId).slice(0, 24).join(',');
  const graticule = useMemo(() => (projection ? geoPath(projection)(geoGraticule10()) ?? '' : ''), [projection]);
  const anchors = useMemo(() => {
    if (!projection) return null;
    return Object.fromEntries(
      COUNTRY_IDS.map((id) => [id, (projection(COUNTRIES[id].anchor) ?? [0, 0]) as Point])
    ) as Record<CountryId, Point>;
  }, [projection]);

  // ---------- Medidas da tela ----------
  const [box, setBox] = useState({ cw: W, ch: H });
  const measure = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return { cw: W, ch: H };
    const cw = svg.clientWidth || W;
    const ch = svg.clientHeight || H;
    setBox((b) => (b.cw === cw && b.ch === ch ? b : { cw, ch }));
    setUnitPx(Math.min(cw / W, ch / H));
    return { cw, ch };
  }, []);

  const focusOn = useCallback(
    (id: CountryId | null, kOverride?: number) => {
      if (!anchors || !id) return;
      const { cw, ch } = measure();
      // Em telas verticais, aproxima até preencher a altura
      const fillK = Math.max(1.6, (ch / cw) * (W / H));
      const k = kOverride ?? Math.min(4, fillK);
      const [ax, ay] = anchors[id];
      setView(clampView({ k, x: W / 2 - ax * k, y: H / 2 - ay * k }));
    },
    [anchors, measure]
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(svg);
    return () => ro.disconnect();
  }, [measure]);

  // Centraliza no império ao abrir o mapa
  const focusedOnce = useRef(false);
  useEffect(() => {
    if (anchors && playerCountryId && !focusedOnce.current) {
      focusedOnce.current = true;
      focusOn(playerCountryId);
    }
  }, [anchors, playerCountryId, focusOn]);

  // ---------- Zoom ----------
  const toSvgPoint = useCallback((clientX: number, clientY: number): Point => {
    const svg = svgRef.current!;
    const ctm = svg.getScreenCTM();
    if (!ctm) return [0, 0];
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return [p.x, p.y];
  }, []);

  const zoomAt = useCallback((factor: number, [px, py]: Point) => {
    setView((v) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
      const wx = (px - v.x) / v.k;
      const wy = (py - v.y) / v.k;
      return clampView({ k, x: px - wx * k, y: py - wy * k });
    });
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.deltaY > 0 ? 1 / 1.2 : 1.2, toSvgPoint(e.clientX, e.clientY));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomAt, toSvgPoint]);

  // ---------- Gestos: arrastar, pinça e toque ----------
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    start: View;
    startPts: Point[];
    startClient: { x: number; y: number };
    moved: boolean;
    tapId?: CountryId;
  } | null>(null);

  const beginGesture = (tapId?: CountryId) => {
    const pts = [...pointers.current.values()];
    gesture.current = {
      start: viewRef.current,
      startPts: pts.map((p) => toSvgPoint(p.x, p.y)),
      startClient: pts[0],
      moved: pts.length > 1,
      tapId,
    };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const tapId = (e.target as Element).closest('[data-id]')?.getAttribute('data-id') as CountryId | undefined;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    beginGesture(pointers.current.size === 1 ? tapId : undefined);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];

    if (pts.length === 1) {
      if (!g.moved && Math.hypot(pts[0].x - g.startClient.x, pts[0].y - g.startClient.y) < DRAG_THRESHOLD_PX) return;
      g.moved = true;
      const [cx, cy] = toSvgPoint(pts[0].x, pts[0].y);
      const [sx, sy] = g.startPts[0];
      setView(clampView({ k: g.start.k, x: g.start.x + cx - sx, y: g.start.y + cy - sy }));
    } else if (pts.length >= 2 && g.startPts.length >= 2) {
      const [a, b] = [toSvgPoint(pts[0].x, pts[0].y), toSvgPoint(pts[1].x, pts[1].y)];
      const [sa, sb] = g.startPts;
      const ratio = Math.hypot(a[0] - b[0], a[1] - b[1]) / Math.max(1, Math.hypot(sa[0] - sb[0], sa[1] - sb[1]));
      const k = Math.min(MAX_K, Math.max(MIN_K, g.start.k * ratio));
      const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const startMid: Point = [(sa[0] + sb[0]) / 2, (sa[1] + sb[1]) / 2];
      const wx = (startMid[0] - g.start.x) / g.start.k;
      const wy = (startMid[1] - g.start.y) / g.start.k;
      setView(clampView({ k, x: mid[0] - wx * k, y: mid[1] - wy * k }));
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    // Toque duplo no mar aproxima
    if (g && !g.moved && !g.tapId && pointers.current.size === 0) {
      const t = lastTap.current;
      if (e.timeStamp - t.at < 350 && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 30) zoomAt(1.8, toSvgPoint(e.clientX, e.clientY));
      lastTap.current = { at: e.timeStamp, x: e.clientX, y: e.clientY };
    }
    if (g && !g.moved && g.tapId && pointers.current.size === 0) selectCountry(g.tapId);
    // Ao soltar um dedo da pinça, reinicia o gesto com o dedo restante
    if (pointers.current.size > 0) beginGesture();
    else gesture.current = null;
  };

  // ---------- Efeitos de combate ----------
  const fxCanvas = useRef<HTMLCanvasElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const shaker = useRef<HTMLDivElement>(null);
  const fx = useRef<MapFx | null>(null);
  useEffect(() => {
    const engine = new MapFx(fxCanvas.current!);
    engine.onShake = (power) => {
      const el = shaker.current;
      if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const px = 14 * power;
      el.animate(Array.from({ length: 12 }, (_, i) => ({ transform: `translate(${(Math.random() - 0.5) * px * (1 - i / 12)}px, ${(Math.random() - 0.5) * px * (1 - i / 12)}px)` })), { duration: 350 + 900 * power });
    };
    engine.onFlash = () => flash.current?.animate([{ opacity: 1 }, { opacity: 0.9, offset: 0.2 }, { opacity: 0 }], { duration: 1500 });
    fx.current = engine;
    return () => engine.destroy();
  }, []);
  const offX = (box.cw - W * unitPx) / 2;
  const offY = (box.ch - H * unitPx) / 2;
  if (fx.current) {
    fx.current.place = (x, y) => [offX + (view.x + x * view.k) * unitPx, offY + (view.y + y * view.k) * unitPx];
    fx.current.zoom = unitPx * view.k;
  }
  // Toda ação de ataque chega por aqui: sua, dos rivais e dos outros jogadores
  const [alerts, setAlerts] = useState<{ key: number; text: string; to: CountryId; color: string }[]>([]);
  const shown = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!anchors) return;
    let seq = 0;
    hooks.fx = (kind, from, to, by) => {
      if (!anchors[from] || !anchors[to]) return;
      const human = isHuman(by);
      const rival = game().rivals[by];
      const color = human ? colorOf(by) : rival ? rivalDef(by).color : '#2563eb';
      const name = human ? playerOf(by)?.name ?? '' : rival ? rivalDef(by).icon : '';
      fx.current?.attack(kind, anchors[from], anchors[to], name, color);
      shown.current[to] = Date.now() + STRIKE_MS[kind] + 1500;
      // Aviso tocável quando envolve jogadores
      const victim = game().countries[to].owner;
      if (by === PLAYER || (!human && victim !== PLAYER && !isHuman(victim))) return;
      const key = ++seq;
      setAlerts((l) => [...l, { key, text: `${ALERT_ICON[kind]} ${name || 'Ataque'} → ${COUNTRIES[to].name}`, to, color }].slice(-3));
      setTimeout(() => setAlerts((l) => l.filter((a) => a.key !== key)), 6000);
    };
    return () => { hooks.fx = () => {}; };
  }, [anchors]);
  useEffect(() => {
    if (!anchors) return;
    const ids = new Set([...myHotspots(), ...warFronts(), ...(g.mode === 'lan' ? L.players.flatMap((p) => p.hot ?? []) : [])]);
    fx.current?.setHot([...ids].map((id) => anchors[id]));
  }, [anchors, g, tickVersion]);
  // Trocas de dono sem ataque visível (revolta, cerco, golpe)
  const owners = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!anchors) return;
    for (const id of COUNTRY_IDS) {
      const now = g.countries[id].owner;
      const before = owners.current[id];
      if (before !== undefined && before !== now && now !== PLAYER && Date.now() > (shown.current[id] ?? 0)) fx.current?.skirmish(anchors[id]);
      owners.current[id] = now;
    }
  }, [anchors, g, tickVersion]);

  const daylight = 0.5 + 0.5 * Math.cos((g.time / 240) * Math.PI * 2);
  const center = (): Point => [W / 2, H / 2];
  const pxPerUnit = unitPx * view.k;
  const markerScale = 1 / pxPerUnit;
  const showDetails = pxPerUnit >= DETAIL_PX_PER_UNIT;

  return (
    <div ref={shaker} className={`map-ocean relative w-full h-full overflow-hidden select-none ${threat ? 'map-alert' : ''}`}>
      {/* Satélite (NASA) já na projeção do mapa; a noite acende as cidades */}
      <div
        className="satellite"
        style={{ width: W * unitPx, height: H * unitPx, transform: `translate(${offX + view.x * unitPx}px, ${offY + view.y * unitPx}px) scale(${view.k})` }}
      >
        <img src="/img/map-day.webp" alt="" draggable={false} />
        <img src="/img/map-night.webp" alt="" draggable={false} className="night" style={{ opacity: (1 - daylight) * 0.82 }} />
      </div>
      <div className="ocean-light" />
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="map-layer absolute inset-0 w-full h-full touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <radialGradient id="burn"><stop offset="0%" stopColor="#0a0705" stopOpacity=".92" /><stop offset="45%" stopColor="#1c120b" stopOpacity=".7" /><stop offset="100%" stopColor="#2a1a0e" stopOpacity="0" /></radialGradient>
          <radialGradient id="fallout"><stop offset="0%" stopColor="#a3e635" stopOpacity=".5" /><stop offset="100%" stopColor="#4d7c0f" stopOpacity="0" /></radialGradient>
        </defs>

        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          <path d={graticule} className="graticule" vectorEffect="non-scaling-stroke" />
          <CountryShapes shapes={shapes} visuals={visuals} />

          {anchors && g.scars.map((s) => (
            <g key={s.id + s.at} transform={`translate(${anchors[s.id].join(',')}) scale(${1 / Math.sqrt(view.k)})`} pointerEvents="none">
              <circle r={s.nuke ? 26 : 14} fill="url(#burn)" opacity={Math.max(0.25, 1 - (g.time - s.at) / 600)} />
              {s.nuke && <circle r={32} fill="url(#fallout)" className="fallout" />}
            </g>
          ))}

          {/* Marcadores com tamanho constante na tela */}
          {anchors &&
            COUNTRY_IDS.map((id) => {
              const c = g.countries[id];
              const [x, y] = anchors[id];
              const owned = c.owner === PLAYER;
              const isSelected = id === selected;
              const rivalCapital = g.rivals[c.owner]?.capital === id;
              // Longe, mostra só o que importa; de perto, todos
              if (!isSelected && !rivalCapital && id !== capital && !(g.mode === 'lan' && L.mode === 'colina' && L.hill === id) && pxPerUnit < (owned || reachable.has(id) ? 1.1 : COUNTRIES[id].income >= 30 ? 1.8 : 3)) return null;
              const ring = isSelected ? '#fbbf24' : owned ? '#60a5fa' : g.rivals[c.owner] ? rivalDef(c.owner).color : c.owner === ZOMBIES ? '#84cc16' : reachable.has(id) ? '#facc15' : '#64748b';
              return (
                <g key={id} data-id={id} transform={`translate(${x},${y}) scale(${markerScale})`} className="cursor-pointer">
                  <circle r={MARKER_PX / 2} fill="#0b1220" fillOpacity={0.9} stroke={ring} strokeWidth={isSelected ? 2.5 : 1.5} />
                  <text y={4.5} textAnchor="middle" fontSize={13} className="emoji-text" pointerEvents="none">
                    {rivalCapital ? rivalDef(c.owner).icon : id === capital ? '👑' : c.owner === ZOMBIES ? '🧟' : g.mode === 'lan' && L.mode === 'colina' && L.hill === id ? '⛰️' : COUNTRIES[id].flag}
                  </text>
                  {(showDetails || isSelected) && (
                    <g pointerEvents="none">
                      <rect x={-42} y={15} width={84} height={30} rx={7} fill="#0b1220" fillOpacity={0.88} stroke={ring} strokeOpacity={0.6} />
                      <text y={28} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#f1f5f9" className="font-sans">
                        {COUNTRIES[id].name}
                      </text>
                      <text y={40} textAnchor="middle" fontSize={9} fontWeight={600} fill={owned ? '#34d399' : '#fda4af'} className="font-mono">
                        {owned ? `🛡 ${Math.round(c.def)} 🙂${Math.round(c.happy)}` : `🛡 ${Math.round(c.def)}`}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
        </g>
      </svg>

      {/* Efeitos animados em camada própria: o terreno não é repintado a cada quadro */}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="map-layer absolute inset-0 w-full h-full pointer-events-none">
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {anchors && playerCountryId && (
            <>
              <SupplyLayer capital={playerCountryId} owned={ownedKey} anchors={anchors} scale={markerScale} />
              <g transform={`translate(${anchors[playerCountryId].join(',')}) scale(${markerScale})`} pointerEvents="none">
                <circle r={60} className="radar-ring" />
                <circle r={60} className="radar-ring radar-ring-late" />
                <path d="M0,0 L60,0 A60,60 0 0 0 42,-42 Z" className="radar-sweep" />
              </g>
            </>
          )}

          {anchors && threat && <ThreatLayer threat={threat} from={g.rivals[threat.by]?.capital} anchors={anchors} />}

        </g>
      </svg>

      <canvas ref={fxCanvas} className="absolute inset-0 w-full h-full pointer-events-none" />
      <div className="cloud-layer" />
      <div className="map-vignette" />
      <div ref={flash} className="nuke-flash" />
      <div className="absolute right-2 top-28 z-20 flex flex-col items-end gap-1.5">
        {alerts.map((a) => (
          <button key={a.key} onClick={() => focusOn(a.to)} className="speech glass-panel rounded-full px-3 py-1.5 text-xs font-bold max-w-[60vw] truncate" style={{ borderColor: a.color }}>{a.text}</button>
        ))}
      </div>

      {!geo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs font-mono">
          <Loader2 className="animate-spin text-cyan-400" size={28} />
          ESTABELECENDO LINK DE SATÉLITE...
        </div>
      )}

      {/* Controles */}
      <div className="absolute right-2 bottom-2 z-20 flex flex-col gap-2">
        {[
          { icon: <ZoomIn size={18} />, label: 'Aproximar', fn: () => zoomAt(1.5, center()) },
          { icon: <ZoomOut size={18} />, label: 'Afastar', fn: () => zoomAt(1 / 1.5, center()) },
          { icon: <LocateFixed size={17} />, label: 'Centralizar no império', fn: () => focusOn(playerCountryId) },
        ].map((b) => (
          <button key={b.label} onClick={b.fn} title={b.label} aria-label={b.label} className="glass-btn w-11 h-11">
            {b.icon}
          </button>
        ))}
      </div>
    </div>
  );
};
