import React, { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { COUNTRIES_DATA, INITIAL_COUNTRY_IDS } from '../../data/countries';
import { CountryId } from '../../types/game';
import { Button } from '../common/Button';
import { ArrowLeft, ChevronRight, DollarSign, Shield, Users, Globe } from 'lucide-react';
import { sound } from '../../utils/audio';

export const SelectCountryScreen: React.FC = () => {
  const [selectedId, setSelectedId] = useState<CountryId>('BRA');
  const startNewGame = useGameStore((state) => state.startNewGame);
  const setScreen = useGameStore((state) => state.setScreen);

  const selectedCountry = COUNTRIES_DATA[selectedId];

  const handleSelect = (id: CountryId) => {
    sound.playClick();
    setSelectedId(id);
  };

  const handleStartGame = () => {
    startNewGame(selectedId);
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#070a12] text-slate-100 overflow-hidden select-none">
      {/* Header Fixo */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md z-10 shrink-0">
        <button
          onClick={() => setScreen('home')}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-100 transition-colors"
        >
          <ArrowLeft size={16} /> Voltar ao Menu
        </button>
        <div className="text-center">
          <h2 className="text-base sm:text-lg font-black tracking-wide uppercase text-slate-100">
            Escolha Sua Nação
          </h2>
          <p className="text-[11px] text-slate-400 hidden xs:block">
            Defina a sede soberana do seu império global
          </p>
        </div>
        <div className="w-16" /> {/* Espaçador para balancear header */}
      </header>

      {/* Conteúdo Principal com Scroll */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-6xl mx-auto w-full flex flex-col md:flex-row gap-6">
        {/* Lista/Grade de Países */}
        <div className="flex-1 order-2 md:order-1">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {INITIAL_COUNTRY_IDS.map((id) => {
              const country = COUNTRIES_DATA[id];
              const isSelected = selectedId === id;

              return (
                <div
                  key={id}
                  onClick={() => handleSelect(id)}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all duration-150 flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-950/60 border-blue-500 shadow-lg shadow-blue-950/50 scale-[1.02]'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{country.flag}</span>
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {country.iso}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-slate-100 leading-tight">
                      {country.name}
                    </h3>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {country.region}
                    </span>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-1 text-[11px] font-mono">
                    <span className="text-emerald-400 font-semibold">+${country.baseIncome}/s</span>
                    <span className="text-blue-400 font-semibold text-right">⚔ {country.initialMilitary}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Painel Lateral com Detalhes da Nação Selecionada */}
        <div className="w-full md:w-80 shrink-0 order-1 md:order-2 flex flex-col gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            {/* Header do País */}
            <div className="flex items-center gap-3">
              <span className="text-4xl">{selectedCountry.flag}</span>
              <div>
                <h3 className="text-xl font-black text-slate-100 leading-tight">
                  {selectedCountry.name}
                </h3>
                <span className="text-xs text-blue-400 font-medium">
                  {selectedCountry.region} • ISO {selectedCountry.iso}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              {selectedCountry.description}
            </p>

            {/* Atributos da Nação */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-950/70 rounded-xl border border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <DollarSign size={14} className="text-emerald-400" /> Renda Inicial
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  +${selectedCountry.baseIncome}/s
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-950/70 rounded-xl border border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Shield size={14} className="text-blue-400" /> Força Militar
                </span>
                <span className="font-mono font-bold text-blue-400">
                  ⚔ {selectedCountry.initialMilitary}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-950/70 rounded-xl border border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Users size={14} className="text-amber-400" /> População
                </span>
                <span className="font-mono font-bold text-slate-200">
                  {selectedCountry.population}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-950/70 rounded-xl border border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Globe size={14} className="text-indigo-400" /> Defesa Territorial
                </span>
                <span className="font-mono font-bold text-slate-200">
                  🛡 {selectedCountry.baseDefense}
                </span>
              </div>
            </div>

            {/* Ação de Início */}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleStartGame}
              icon={<ChevronRight size={18} />}
            >
              LIDERAR ESTA NAÇÃO
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
