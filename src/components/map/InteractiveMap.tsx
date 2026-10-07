import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { COUNTRIES_DATA, INITIAL_COUNTRY_IDS } from '../../data/countries';
import { ZoomIn, ZoomOut, RotateCcw, Crosshair } from 'lucide-react';

export const InteractiveMap: React.FC = () => {
  const countriesState = useGameStore((state) => state.countries);
  const playerCountryId = useGameStore((state) => state.playerCountryId);
  const selectedCountryId = useGameStore((state) => state.selectedCountryId);
  const selectCountry = useGameStore((state) => state.selectCountry);

  // Transformação do mapa (pan e zoom)
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const initialTouchDistRef = useRef<number | null>(null);

  // Manipulação de Zoom
  const handleZoomIn = () => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.6, +(z - 0.25).toFixed(2)));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Wheel Zoom no Desktop
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom((z) => {
      const next = +(z + delta).toFixed(2);
      return Math.min(3, Math.max(0.6, next));
    });
  }, []);

  // Mouse Drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPan({
        x: panStartRef.current.x + dx,
        y: panStartRef.current.y + dy,
      });
    },
    [isDragging]
  );

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch Drag & Pinch Zoom no Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStartRef.current = { ...pan };
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialTouchDistRef.current = dist;
    }
  };

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1 && isDragging) {
        const dx = e.touches[0].clientX - dragStartRef.current.x;
        const dy = e.touches[0].clientY - dragStartRef.current.y;
        setPan({
          x: panStartRef.current.x + dx,
          y: panStartRef.current.y + dy,
        });
      } else if (e.touches.length === 2 && initialTouchDistRef.current !== null) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scaleChange = dist / initialTouchDistRef.current;
        if (scaleChange > 1.05) {
          handleZoomIn();
          initialTouchDistRef.current = dist;
        } else if (scaleChange < 0.95) {
          handleZoomOut();
          initialTouchDistRef.current = dist;
        }
      }
    },
    [isDragging]
  );

  const handleTouchEnd = () => {
    setIsDragging(false);
    initialTouchDistRef.current = null;
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#060911] cursor-grab active:cursor-grabbing select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background tático estilo centro de comando com grade sutil */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-35 pointer-events-none" />

      {/* Linhas de grade geopolítica */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-15 stroke-slate-500">
        <line x1="0" y1="25%" x2="100%" y2="25%" strokeDasharray="4 8" />
        <line x1="0" y1="50%" x2="100%" y2="50%" strokeDasharray="4 8" />
        <line x1="0" y1="75%" x2="100%" y2="75%" strokeDasharray="4 8" />
        <line x1="25%" y1="0" x2="25%" y2="100%" strokeDasharray="4 8" />
        <line x1="50%" y1="0" x2="50%" y2="100%" strokeDasharray="4 8" />
        <line x1="75%" y1="0" x2="75%" y2="100%" strokeDasharray="4 8" />
      </svg>

      {/* Radar de Varredura Circular Animado */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-cyan-500/10 pointer-events-none flex items-center justify-center">
        <div className="w-[500px] h-[500px] rounded-full border border-cyan-500/10" />
        <div className="w-[300px] h-[300px] rounded-full border border-cyan-500/10" />
        <div className="w-[120px] h-[120px] rounded-full border border-cyan-500/10" />
        {/* Linha de varredura rotativa de sonar */}
        <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0_310deg,rgba(56,189,248,0.12)_360deg)] animate-[spin_10s_linear_infinite]" />
      </div>

      {/* SVG Canvas dos Países com transformação de Pan e Zoom */}
      <div
        className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
        }}
      >
        <svg
          viewBox="0 0 1000 620"
          className="w-full max-w-[1100px] h-auto drop-shadow-[0_25px_60px_rgba(0,0,0,0.85)]"
        >
          <defs>
            {/* Gradiente para o Território Soberano do Jogador */}
            <linearGradient id="playerTerritoryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>

            {/* Gradiente para Territórios Conquistados pelo Jogador */}
            <linearGradient id="conqueredTerritoryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#1e40af" />
            </linearGradient>

            {/* Gradiente para Territórios Neutros */}
            <linearGradient id="neutralTerritoryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>

            {/* Filtro de Glow para Seleção */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#f59e0b" floodOpacity="0.8" />
            </filter>
            
            <filter id="playerGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#38bdf8" floodOpacity="0.5" />
            </filter>
          </defs>

          {/* Oceanos & Rótulos Continentais */}
          <text x="210" y="30" fill="#475569" fontSize="13" fontWeight="bold" letterSpacing="4" opacity="0.35">
            AMÉRICA DO NORTE
          </text>
          <text x="320" y="280" fill="#475569" fontSize="13" fontWeight="bold" letterSpacing="4" opacity="0.35">
            AMÉRICA DO SUL
          </text>
          <text x="730" y="120" fill="#475569" fontSize="13" fontWeight="bold" letterSpacing="4" opacity="0.35">
            ÁSIA PACÍFICO
          </text>

          {/* Renderização dos Países */}
          {INITIAL_COUNTRY_IDS.map((id) => {
            const base = COUNTRIES_DATA[id];
            const state = countriesState[id];
            const isPlayerOrigin = playerCountryId === id;
            const isConqueredByPlayer = state?.owner === 'player';
            const isSelected = selectedCountryId === id;
            const isSabotaged = state?.sabotagedTurns && state.sabotagedTurns > 0;

            // Determinar cores
            let fill = 'url(#neutralTerritoryGrad)';
            let stroke = '#334155';
            let strokeWidth = '1.8';
            let filter = undefined;

            if (isPlayerOrigin) {
              fill = 'url(#playerTerritoryGrad)';
              stroke = '#60a5fa';
              strokeWidth = '2.5';
              filter = 'url(#playerGlow)';
            } else if (isConqueredByPlayer) {
              fill = 'url(#conqueredTerritoryGrad)';
              stroke = '#38bdf8';
              strokeWidth = '2.2';
            }

            if (isSelected) {
              stroke = '#fbbf24';
              strokeWidth = '3.5';
              filter = 'url(#glow)';
            }

            return (
              <g
                key={id}
                onClick={(e) => {
                  e.stopPropagation();
                  selectCountry(id);
                }}
                className="cursor-pointer transition-transform duration-150 group"
              >
                {/* Caminho do Território */}
                <path
                  d={base.svg.path}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  filter={filter}
                  className="transition-colors duration-200 group-hover:brightness-125"
                />

                {/* Marcador e Nome do País */}
                <g transform={`translate(${base.svg.center[0]}, ${base.svg.center[1]})`} pointerEvents="none">
                  {/* Badge de fundo para legibilidade */}
                  <rect
                    x="-34"
                    y="-16"
                    width="68"
                    height="29"
                    rx="6"
                    fill="#090d16"
                    fillOpacity="0.88"
                    stroke={
                      isSelected
                        ? '#f59e0b'
                        : isConqueredByPlayer
                        ? '#3b82f6'
                        : isSabotaged
                        ? '#ef4444'
                        : '#334155'
                    }
                    strokeWidth="1.2"
                  />
                  <text
                    x="0"
                    y="-3"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="11"
                    fontWeight="700"
                    className="font-sans"
                  >
                    {base.flag} {base.iso} {isSabotaged ? '💀' : ''}
                  </text>
                  <text
                    x="0"
                    y="8"
                    textAnchor="middle"
                    fill={isConqueredByPlayer ? '#38bdf8' : isSabotaged ? '#f87171' : '#94a3b8'}
                    fontSize="8.5"
                    fontWeight="600"
                    className="font-mono"
                  >
                    {isConqueredByPlayer ? `+$${state?.income}/s` : `Def: ${state?.defense}`}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Controles Flutuantes de Zoom e Centralização */}
      <div className="absolute bottom-5 right-4 z-20 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="w-10 h-10 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 flex items-center justify-center shadow-lg active:scale-95 transition-all"
          title="Aumentar Zoom"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={handleZoomOut}
          className="w-10 h-10 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 flex items-center justify-center shadow-lg active:scale-95 transition-all"
          title="Diminuir Zoom"
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={handleReset}
          className="w-10 h-10 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 flex items-center justify-center shadow-lg active:scale-95 transition-all"
          title="Redefinir Visão"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Mira Tática / Coordenadas de Satélite */}
      <div className="absolute top-16 left-4 z-20 hidden md:flex items-center gap-2 bg-slate-950/70 border border-slate-800/80 px-2.5 py-1 rounded-xl text-[10px] font-mono text-slate-400 pointer-events-none">
        <Crosshair size={12} className="text-cyan-400" />
        <span>RADAR TÁTICO ATIVO // ESCALA 1:1.000.000</span>
      </div>

      {/* Legenda Tática Inferior Esquerda */}
      <div className="absolute bottom-5 left-4 z-20 hidden sm:flex items-center gap-3 bg-slate-950/85 backdrop-blur-md border border-slate-800/90 px-3.5 py-2 rounded-xl text-[11px] text-slate-300 pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-blue-600 border border-blue-400" />
          <span>Seu Império</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-slate-800 border border-slate-600" />
          <span>Rival</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border-2 border-amber-400" />
          <span>Alvo</span>
        </div>
      </div>
    </div>
  );
};
