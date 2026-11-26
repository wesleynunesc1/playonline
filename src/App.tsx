import React from 'react';
import { CasinoScreen } from './components/CasinoScreen';
import { CasinoMods } from './components/CasinoMods';
import { useLiteEffects } from './hooks/useDevice';

export const App: React.FC = () => {
  useLiteEffects();
  return (
    <div className="app-frame w-full h-[100dvh] overflow-hidden bg-[#1a0630] text-slate-100 flex flex-col font-sans select-none antialiased">
      <CasinoScreen />
      <CasinoMods />
    </div>
  );
};

export default App;
