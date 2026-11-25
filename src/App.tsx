import React, { Suspense, lazy, useEffect } from 'react';
import { useGameStore } from './stores/useGameStore';
import { HomeScreen } from './components/screens/HomeScreen';
import { SelectCountryScreen } from './components/screens/SelectCountryScreen';

const GameScreen = lazy(() => import('./components/screens/GameScreen').then((m) => ({ default: m.GameScreen })));
const SnakeScreen = lazy(() => import('./components/screens/SnakeScreen').then((m) => ({ default: m.SnakeScreen })));

export const App: React.FC = () => {
  const screen = useGameStore((state) => state.screen);
  const initFromStorage = useGameStore((state) => state.initFromStorage);

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  return (
    <div className="w-full h-[100dvh] overflow-hidden bg-[#070a12] text-slate-100 flex flex-col font-sans select-none antialiased">
      {screen === 'home' && <HomeScreen />}
      {screen === 'country_select' && <SelectCountryScreen />}
      <Suspense fallback={<div className="m-auto text-sm text-slate-400">Carregando...</div>}>
        {screen === 'game' && <GameScreen />}
        {screen === 'snake' && <SnakeScreen />}
      </Suspense>
    </div>
  );
};

export default App;
