import React, { Suspense, lazy } from 'react';
import { useApp } from './ui';
import { HomeScreen } from './components/screens/HomeScreen';
import { SelectCountryScreen } from './components/screens/SelectCountryScreen';

const GameScreen = lazy(() => import('./components/screens/GameScreen').then((m) => ({ default: m.GameScreen })));
const SnakeScreen = lazy(() => import('./components/screens/SnakeScreen').then((m) => ({ default: m.SnakeScreen })));

export const App: React.FC = () => {
  const screen = useApp((s) => s.screen);
  return (
    <div className="w-full h-[100dvh] overflow-hidden bg-[#070a12] text-slate-100 flex flex-col font-sans select-none antialiased">
      <Suspense fallback={<div className="m-auto text-sm text-slate-400">Carregando...</div>}>
        {screen === 'home' && <HomeScreen />}
        {screen === 'country_select' && <SelectCountryScreen />}
        {screen === 'game' && <GameScreen />}
        {screen === 'snake' && <SnakeScreen />}
      </Suspense>
    </div>
  );
};

export default App;
