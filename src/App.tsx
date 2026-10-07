import React, { useEffect } from 'react';
import { useGameStore } from './stores/useGameStore';
import { HomeScreen } from './components/screens/HomeScreen';
import { SelectCountryScreen } from './components/screens/SelectCountryScreen';
import { GameScreen } from './components/screens/GameScreen';

export const App: React.FC = () => {
  const screen = useGameStore((state) => state.screen);
  const initFromStorage = useGameStore((state) => state.initFromStorage);

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  return (
    <div className="w-full h-full min-h-screen bg-[#070a12] text-slate-100 flex flex-col font-sans select-none antialiased">
      {screen === 'home' && <HomeScreen />}
      {screen === 'country_select' && <SelectCountryScreen />}
      {screen === 'game' && <GameScreen />}
    </div>
  );
};

export default App;
