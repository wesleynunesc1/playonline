import React from 'react';
import { GymScreen } from './components/GymScreen';
import { GymMods } from './components/GymMods';
import { useLiteEffects } from './hooks/useDevice';

export const App: React.FC = () => {
  useLiteEffects();
  return (
    <div className="app-frame w-full h-[100dvh] overflow-hidden bg-[#041016] text-slate-100 flex flex-col font-sans select-none antialiased">
      <GymScreen />
      <GymMods />
    </div>
  );
};

export default App;
