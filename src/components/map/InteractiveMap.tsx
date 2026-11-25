import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo';
import { useGameStore } from '../../stores/useGameStore';
import { COUNTRIES_DATA, INITIAL_COUNTRY_IDS, NUMERIC_TO_COUNTRY } from '../../data/countries';
import { CountryId, CountryRuntimeState, Strike, Threat } from '../../types/game';
import { useWorldGeo } from '../../services/worldGeo';
import { ZoomIn, ZoomOut, LocateFixed, Loader2 } from 'lucide-react';

const W = 1000;
const H = 520;
const MIN_K = 1;
const MAX_K = 14;
const DRAG_THRESHOLD_PX = 6;
const MARKER_PX = 24;
const DETAIL_PX_PER_UNIT = 1.9;

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

/** Polígonos dos países. Memoizado: não re-renderiza ao arrastar/zoom. */
const CountryShapes = memo(function CountryShapes({
  shapes,
  countries,
  playerCountryId,
  selectedCountryId,
  threatTargetId,
}: {
  shapes: Shape[];
  countries: Record<CountryId, CountryRuntimeState>;
  playerCountryId: CountryId | null;
  selectedCountryId: CountryId | null;
  threatTargetId?: CountryId;
}) {
  return (
    <g>
      {shapes.map(({ key, d, countryId }) => {
        if (!countryId) {
          return <path key={key} d={d} className="land-inert" vectorEffect="non-scaling-stroke" />;
        }
        const c = countries[countryId];
        const cls = [
          'land-playable',
          c.owner === 'player' ? (countryId === playerCountryId ? 'land-capital' : 'land-owned') : c.sabotageSeconds > 0 ? 'land-sabotaged' : 'land-rival',
          countryId === selectedCountryId ? 'land-selected' : '',
          countryId === threatTargetId ? 'land-threat' : '',
        ].join(' ');
        return <path key={key} d={d} data-id={countryId} className={cls} vectorEffect="non-scaling-stroke" />;
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

const SPARK_ANGLES = Array.from({ length: 14 }, (_, i) => Math.round((i * 360) / 14));

const StrikeLayer = ({ strike, anchors, scale }: { strike: Strike; anchors: Record<CountryId, Point>; scale: number }) => {
  const from = anchors[strike.fromId];
  const to = anchors[strike.toId];
  const d = arcPath(from, to);
  const color = strike.hostile ? '#f43f5e' : '#fbbf24';
  return (
    <g key={strike.key} pointerEvents="none">
      <path d={d} pathLength={1} className="strike-path" stroke={color} vectorEffect="non-scaling-stroke" />
      <circle r={4 * scale} fill="#fff" style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
        <animateMotion dur="0.9s" path={d} fill="freeze" />
      </circle>
      <g transform={`translate(${to[0]},${to[1]}) scale(${scale})`}>
        <circle r={46} className="strike-ring" stroke={color} />
        {SPARK_ANGLES.map((a, i) => (
          <g key={a} transform={`rotate(${a})`}>
            <rect x={0} y={-1.5} width={8 + (i % 3) * 4} height={3} rx={1.5} className="strike-spark" fill={i % 2 ? '#fef08a' : color} />
          </g>
        ))}
        <circle r={26} className="strike-blast" fill={color} />
        <circle r={14} className="strike-blast strike-blast-core" fill="#fff" />
      </g>
    </g>
  );
};

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

const ThreatLayer = ({ threat, anchors }: { threat: Threat; anchors: Record<CountryId, Point> }) => (
  <path
    d={arcPath(anchors[threat.attackerId], anchors[threat.targetId])}
    className="threat-path"
    vectorEffect="non-scaling-stroke"
    pointerEvents="none"
  />
);

export const InteractiveMap: React.FC = () => {
  const geo = useWorldGeo();
  const countries = useGameStore((s) => s.countries);
  const playerCountryId = useGameStore((s) => s.playerCountryId);
  const selectedCountryId = useGameStore((s) => s.selectedCountryId);
  const selectCountry = useGameStore((s) => s.selectCountry);
  const strike = useGameStore((s) => s.strike);
  const threat = useGameStore((s) => s.threat);

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
  // Um único contorno de todos os continentes: relevo e brilho costeiro baratos
  const coast = useMemo(() => shapes.map((s) => s.d).join(''), [shapes]);
  const ownedKey = INITIAL_COUNTRY_IDS.filter((id) => countries[id].owner === 'player' && id !== playerCountryId).join(',');
  const graticule = useMemo(() => (projection ? geoPath(projection)(geoGraticule10()) ?? '' : ''), [projection]);
  const anchors = useMemo(() => {
    if (!projection) return null;
    return Object.fromEntries(
      INITIAL_COUNTRY_IDS.map((id) => [id, (projection(COUNTRIES_DATA[id].anchor) ?? [0, 0]) as Point])
    ) as Record<CountryId, Point>;
  }, [projection]);

  // ---------- Medidas da tela ----------
  const measure = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return { cw: W, ch: H };
    const cw = svg.clientWidth || W;
    const ch = svg.clientHeight || H;
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
    if (g && !g.moved && g.tapId && pointers.current.size === 0) selectCountry(g.tapId);
    // Ao soltar um dedo da pinça, reinicia o gesto com o dedo restante
    if (pointers.current.size > 0) beginGesture();
    else gesture.current = null;
  };

  const center = (): Point => [W / 2, H / 2];
  const pxPerUnit = unitPx * view.k;
  const markerScale = 1 / pxPerUnit;
  const showDetails = pxPerUnit >= DETAIL_PX_PER_UNIT;

  return (
    <div
      className={`map-ocean relative w-full h-full overflow-hidden select-none ${strike ? 'map-shake' : ''} ${threat ? 'map-alert' : ''}`}
    >
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
          <linearGradient id="gradRival" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7c8ba1" />
            <stop offset="100%" stopColor="#3f4c5f" />
          </linearGradient>
          <linearGradient id="gradOwned" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1e40af" />
          </linearGradient>
          <linearGradient id="gradCapital" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>

        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          <path d={graticule} className="graticule" vectorEffect="non-scaling-stroke" />
          <path d={coast} className="coast coast-far" vectorEffect="non-scaling-stroke" />
          <path d={coast} className="coast coast-near" vectorEffect="non-scaling-stroke" />
          <path d={coast} className="land-depth" transform={`translate(0,${2.6 / Math.sqrt(view.k)})`} />
          <CountryShapes
            shapes={shapes}
            countries={countries}
            playerCountryId={playerCountryId}
            selectedCountryId={selectedCountryId}
            threatTargetId={threat?.targetId}
          />

          {/* Marcadores com tamanho constante na tela */}
          {anchors &&
            INITIAL_COUNTRY_IDS.map((id) => {
              const c = countries[id];
              const [x, y] = anchors[id];
              const owned = c.owner === 'player';
              const selected = id === selectedCountryId;
              const ring = selected ? '#fbbf24' : owned ? '#60a5fa' : c.sabotageSeconds > 0 ? '#f43f5e' : '#64748b';
              return (
                <g key={id} data-id={id} transform={`translate(${x},${y}) scale(${markerScale})`} className="cursor-pointer">
                  <circle r={MARKER_PX / 2} fill="#0b1220" fillOpacity={0.9} stroke={ring} strokeWidth={selected ? 2.5 : 1.5} />
                  <text y={4.5} textAnchor="middle" fontSize={13} className="emoji-text" pointerEvents="none">
                    {COUNTRIES_DATA[id].flag}
                  </text>
                  {(showDetails || selected) && (
                    <g pointerEvents="none">
                      <rect x={-42} y={15} width={84} height={30} rx={7} fill="#0b1220" fillOpacity={0.88} stroke={ring} strokeOpacity={0.6} />
                      <text y={28} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#f1f5f9" className="font-sans">
                        {COUNTRIES_DATA[id].name}
                      </text>
                      <text y={40} textAnchor="middle" fontSize={9} fontWeight={600} fill={owned ? '#34d399' : '#fda4af'} className="font-mono">
                        {owned ? `+$${c.income}/s` : `🛡 ${c.defense}`}
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

          {anchors && threat && <ThreatLayer threat={threat} anchors={anchors} />}

          {anchors && strike && <StrikeLayer strike={strike} anchors={anchors} scale={markerScale} />}
        </g>
      </svg>

      <div className="cloud-layer" />
      <div className="map-vignette" />
      {strike && <div key={strike.key} className={`impact-flash ${strike.hostile ? 'impact-hostile' : ''}`} />}

      {!geo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs font-mono">
          <Loader2 className="animate-spin text-cyan-400" size={28} />
          ESTABELECENDO LINK DE SATÉLITE...
        </div>
      )}

      {/* Controles */}
      <div className="absolute right-3 bottom-3 z-20 flex flex-col gap-2">
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

      <div className="absolute left-3 bottom-3 z-20 hidden sm:flex items-center gap-3 glass-panel px-3 py-2 rounded-xl text-[11px] text-slate-300 pointer-events-none">
        <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm bg-blue-500" />Seu império</span>
        <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm bg-slate-600" />Rival</span>
        <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm bg-rose-600" />Sabotado</span>
        <span className="text-slate-500">• Pinça/roda para zoom</span>
      </div>
    </div>
  );
};
