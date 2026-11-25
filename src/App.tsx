import React, { Suspense, lazy } from 'react';
import { useApp } from './ui';
import { AdminMenu } from './components/panels/AdminPanel';
import { UpdateBanner } from './components/common/UpdateBanner';
import { Toast } from './components/common/Toast';
import { useLiteEffects } from './hooks/useDevice';
import { HomeScreen } from './components/screens/HomeScreen';
import { SelectCountryScreen } from './components/screens/SelectCountryScreen';

const GameScreen = lazy(() => import('./components/screens/GameScreen').then((m) => ({ default: m.GameScreen })));
const LanScreen = lazy(() => import('./components/screens/LanScreen').then((m) => ({ default: m.LanScreen })));
const WarScreen = lazy(() => import('./components/screens/WarScreen').then((m) => ({ default: m.WarScreen })));
const SnakeScreen = lazy(() => import('./components/screens/SnakeScreen').then((m) => ({ default: m.SnakeScreen })));

export const App: React.FC = () => {
  const screen = useApp((s) => s.screen);
  useLiteEffects();
  return (
    <div className="app-frame w-full h-[100dvh] overflow-hidden bg-[#070a12] text-slate-100 flex flex-col font-sans select-none antialiased">
      <Suspense fallback={<div className="m-auto text-sm text-slate-400">Carregando...</div>}>
        {screen === 'home' && <HomeScreen />}
        {screen === 'country_select' && <SelectCountryScreen />}
        {screen === 'game' && <GameScreen />}
        {screen === 'snake' && <SnakeScreen />}
        {screen === 'lan' && <LanScreen />}
        {screen === 'war' && <WarScreen />}
      </Suspense>
      <AdminMenu />
      <UpdateBanner />
      <Toast />
    </div>
  );
};

export default App;
