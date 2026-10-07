import { create } from 'zustand';
import {
  CountryId,
  CountryRuntimeState,
  ScreenType,
  BattleResult,
  OfflineProgressInfo,
} from '../types/game';
import { COUNTRIES_DATA, INITIAL_COUNTRY_IDS } from '../data/countries';
import {
  calculateEconomyUpgradeCost,
  calculateIncomeForLevel,
  calculateRecruitCost,
  resolveBattle,
  BALANCE,
} from '../utils/formulas';
import { StorageService } from '../services/storage';
import { sound } from '../utils/audio';

export type ActiveModal =
  | 'country_detail'
  | 'battle_result'
  | 'offline_progress'
  | 'pause_menu'
  | 'debug'
  | null;

export interface NotificationState {
  id: string;
  message: string;
  type: 'success' | 'danger' | 'info';
}

interface GameStore {
  // Navegação e Telas
  screen: ScreenType;
  setScreen: (screen: ScreenType) => void;

  // Estado da Partida
  playerCountryId: CountryId | null;
  money: number;
  militaryPower: number;
  countries: Record<CountryId, CountryRuntimeState>;
  selectedCountryId: CountryId | null;

  // Modais e Diálogos
  activeModal: ActiveModal;
  lastBattleResult: BattleResult | null;
  offlineProgress: OfflineProgressInfo | null;
  notification: NotificationState | null;

  // Sistema
  soundEnabled: boolean;
  hasSavedGame: boolean;
  totalPlayTimeSeconds: number;

  // Getters / Cálculos derivados
  getTotalIncomePerSecond: () => number;
  getConqueredTerritoriesCount: () => number;

  // Ações Principais
  initFromStorage: () => void;
  startNewGame: (countryId: CountryId) => void;
  continueSavedGame: () => boolean;
  gameTick: (deltaSeconds?: number) => void;

  // Interação
  selectCountry: (countryId: CountryId | null) => void;
  upgradeCountryEconomy: (countryId: CountryId) => boolean;
  recruitMilitary: (batchCount?: number) => boolean;
  attackCountry: (targetCountryId: CountryId) => BattleResult | null;
  collectOfflineProgress: () => void;

  // Gerenciamento e Menu
  openModal: (modal: ActiveModal) => void;
  closeModal: () => void;
  saveGame: () => void;
  restartGame: () => void;
  returnToHome: () => void;
  toggleSound: () => void;
  showNotification: (message: string, type?: 'success' | 'danger' | 'info') => void;

  // Ferramentas de Debug (Somente Dev)
  debugAddMoney: (amount: number) => void;
  debugAddMilitary: (amount: number) => void;
  debugConquerCountry: (countryId: CountryId) => void;
  debugAdvanceTime: (seconds: number) => void;
}

/**
 * Cria o estado inicial neutro de todos os países
 */
function createInitialCountriesState(playerCountryId?: CountryId): Record<CountryId, CountryRuntimeState> {
  const result = {} as Record<CountryId, CountryRuntimeState>;
  
  INITIAL_COUNTRY_IDS.forEach((id) => {
    const base = COUNTRIES_DATA[id];
    const isPlayer = playerCountryId === id;
    result[id] = {
      id,
      name: base.name,
      iso: base.iso,
      flag: base.flag,
      income: base.baseIncome,
      militaryPower: base.initialMilitary,
      defense: base.baseDefense,
      economyLevel: 1,
      owner: isPlayer ? 'player' : null,
    };
  });

  return result;
}

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'home',
  setScreen: (screen) => set({ screen }),

  playerCountryId: null,
  money: 1000,
  militaryPower: 100,
  countries: createInitialCountriesState(),
  selectedCountryId: null,

  activeModal: null,
  lastBattleResult: null,
  offlineProgress: null,
  notification: null,

  soundEnabled: true,
  hasSavedGame: StorageService.hasSave(),
  totalPlayTimeSeconds: 0,

  getTotalIncomePerSecond: () => {
    const { countries } = get();
    return Object.values(countries)
      .filter((c) => c.owner === 'player')
      .reduce((acc, c) => acc + c.income, 0);
  },

  getConqueredTerritoriesCount: () => {
    const { countries } = get();
    return Object.values(countries).filter((c) => c.owner === 'player').length;
  },

  initFromStorage: () => {
    const hasSave = StorageService.hasSave();
    set({ hasSavedGame: hasSave });
  },

  startNewGame: (selectedId: CountryId) => {
    const base = COUNTRIES_DATA[selectedId];
    const initialCountries = createInitialCountriesState(selectedId);
    
    // Configura o país do jogador como nível 1 e dono player
    initialCountries[selectedId] = {
      ...initialCountries[selectedId],
      income: base.baseIncome,
      militaryPower: base.initialMilitary,
      defense: base.baseDefense,
      economyLevel: 1,
      owner: 'player',
    };

    const newState = {
      screen: 'game' as ScreenType,
      playerCountryId: selectedId,
      money: 1000,
      militaryPower: base.initialMilitary,
      countries: initialCountries,
      selectedCountryId: selectedId,
      activeModal: null,
      lastBattleResult: null,
      offlineProgress: null,
      totalPlayTimeSeconds: 0,
    };

    set(newState);

    // Salva imediatamente
    StorageService.saveGame({
      version: 1,
      playerCountryId: selectedId,
      money: 1000,
      militaryPower: base.initialMilitary,
      countries: initialCountries,
      conqueredCount: 1,
      totalPlayTimeSeconds: 0,
    });

    set({ hasSavedGame: true });
    get().showNotification(`Bem-vindo, Comandante! Você lidera o ${base.name}.`, 'info');
  },

  continueSavedGame: () => {
    const saved = StorageService.loadGame();
    if (!saved) {
      set({ hasSavedGame: false });
      return false;
    }

    const currentIncome = Object.values(saved.countries)
      .filter((c) => c.owner === 'player')
      .reduce((acc, c) => acc + c.income, 0);

    // Calcular progresso offline
    const offlineInfo = StorageService.calculateOfflineProgress(saved, currentIncome);

    set({
      screen: 'game',
      playerCountryId: saved.playerCountryId,
      money: saved.money,
      militaryPower: saved.militaryPower,
      countries: saved.countries,
      selectedCountryId: saved.playerCountryId,
      totalPlayTimeSeconds: saved.totalPlayTimeSeconds || 0,
      offlineProgress: offlineInfo,
      activeModal: offlineInfo ? 'offline_progress' : null,
    });

    return true;
  },

  gameTick: (deltaSeconds = 1) => {
    const { screen, money, getTotalIncomePerSecond, totalPlayTimeSeconds } = get();
    if (screen !== 'game') return;

    const income = getTotalIncomePerSecond();
    const newMoney = money + income * deltaSeconds;

    set({
      money: newMoney,
      totalPlayTimeSeconds: totalPlayTimeSeconds + deltaSeconds,
    });
  },

  selectCountry: (countryId: CountryId | null) => {
    sound.playClick();
    set({
      selectedCountryId: countryId,
      activeModal: countryId ? 'country_detail' : null,
    });
  },

  upgradeCountryEconomy: (countryId: CountryId) => {
    const { countries, money } = get();
    const target = countries[countryId];
    if (!target || target.owner !== 'player') return false;

    const base = COUNTRIES_DATA[countryId];
    const cost = calculateEconomyUpgradeCost(base.baseIncome, target.economyLevel);

    if (money < cost) {
      sound.playDefeat();
      get().showNotification('Fundos insuficientes para melhoria econômica.', 'danger');
      return false;
    }

    const nextLevel = target.economyLevel + 1;
    const nextIncome = calculateIncomeForLevel(base.baseIncome, nextLevel);

    const updatedCountries = {
      ...countries,
      [countryId]: {
        ...target,
        economyLevel: nextLevel,
        income: nextIncome,
      },
    };

    const newMoney = money - cost;
    sound.playBuy();

    set({
      money: newMoney,
      countries: updatedCountries,
    });

    get().saveGame();
    get().showNotification(
      `${target.name} expandiu a economia para Nível ${nextLevel}! (+$${nextIncome}/s)`,
      'success'
    );
    return true;
  },

  recruitMilitary: (batchCount = 1) => {
    const { militaryPower, money } = get();
    const cost = calculateRecruitCost(militaryPower, batchCount);
    const troopsToAdd = BALANCE.RECRUIT_BATCH_SIZE * batchCount;

    if (money < cost) {
      sound.playDefeat();
      get().showNotification('Fundos insuficientes para recrutar tropas.', 'danger');
      return false;
    }

    const newMilitary = militaryPower + troopsToAdd;
    const newMoney = money - cost;

    sound.playRecruit();

    set({
      money: newMoney,
      militaryPower: newMilitary,
    });

    get().saveGame();
    get().showNotification(`+${troopsToAdd} Força Militar recrutada com sucesso!`, 'success');
    return true;
  },

  attackCountry: (targetCountryId: CountryId) => {
    const { countries, militaryPower } = get();
    const target = countries[targetCountryId];
    if (!target || target.owner === 'player') return null;

    if (militaryPower < 10) {
      sound.playDefeat();
      get().showNotification('Seu exército está muito fraco para iniciar um ataque!', 'danger');
      return null;
    }

    const battleResult = resolveBattle(militaryPower, target);

    let updatedCountries = { ...countries };
    let newMilitary = Math.max(10, militaryPower - battleResult.playerCasualties);

    if (battleResult.won) {
      sound.playVictory();
      updatedCountries[targetCountryId] = {
        ...target,
        owner: 'player',
      };
    } else {
      sound.playDefeat();
    }

    set({
      militaryPower: newMilitary,
      countries: updatedCountries,
      lastBattleResult: battleResult,
      activeModal: 'battle_result',
    });

    get().saveGame();
    return battleResult;
  },

  collectOfflineProgress: () => {
    const { offlineProgress, money } = get();
    if (!offlineProgress) return;

    sound.playBuy();
    const newMoney = money + offlineProgress.moneyEarned;

    set({
      money: newMoney,
      offlineProgress: null,
      activeModal: null,
    });

    get().saveGame();
    get().showNotification(`Coletado ${offlineProgress.moneyEarned} de rendimentos offline!`, 'success');
  },

  openModal: (modal) => {
    sound.playClick();
    set({ activeModal: modal });
  },

  closeModal: () => {
    sound.playClick();
    set({ activeModal: null });
  },

  saveGame: () => {
    const {
      playerCountryId,
      money,
      militaryPower,
      countries,
      getConqueredTerritoriesCount,
      totalPlayTimeSeconds,
    } = get();

    if (!playerCountryId) return;

    StorageService.saveGame({
      version: 1,
      playerCountryId,
      money,
      militaryPower,
      countries,
      conqueredCount: getConqueredTerritoriesCount(),
      totalPlayTimeSeconds,
    });
    set({ hasSavedGame: true });
  },

  restartGame: () => {
    StorageService.clearSave();
    set({
      hasSavedGame: false,
      screen: 'country_select',
      activeModal: null,
      selectedCountryId: null,
    });
  },

  returnToHome: () => {
    get().saveGame();
    set({
      screen: 'home',
      activeModal: null,
      selectedCountryId: null,
      hasSavedGame: true,
    });
  },

  toggleSound: () => {
    const nextState = !get().soundEnabled;
    sound.enabled = nextState;
    set({ soundEnabled: nextState });
  },

  showNotification: (message, type = 'info') => {
    const id = Date.now().toString();
    set({ notification: { id, message, type } });
    setTimeout(() => {
      const current = get().notification;
      if (current && current.id === id) {
        set({ notification: null });
      }
    }, 3800);
  },

  // Ferramentas de depuração
  debugAddMoney: (amount: number) => {
    set((state) => ({ money: state.money + amount }));
    get().showNotification(`[DEBUG] +$${amount} adicionado!`, 'info');
  },

  debugAddMilitary: (amount: number) => {
    set((state) => ({ militaryPower: state.militaryPower + amount }));
    get().showNotification(`[DEBUG] +${amount} Poder Militar adicionado!`, 'info');
  },

  debugConquerCountry: (countryId: CountryId) => {
    const { countries } = get();
    if (!countries[countryId]) return;
    set({
      countries: {
        ...countries,
        [countryId]: {
          ...countries[countryId],
          owner: 'player',
        },
      },
    });
    get().saveGame();
    get().showNotification(`[DEBUG] ${countries[countryId].name} conquistado!`, 'info');
  },

  debugAdvanceTime: (seconds: number) => {
    const { getTotalIncomePerSecond, money, totalPlayTimeSeconds } = get();
    const income = getTotalIncomePerSecond();
    const earned = income * seconds;
    set({
      money: money + earned,
      totalPlayTimeSeconds: totalPlayTimeSeconds + seconds,
    });
    get().showNotification(`[DEBUG] Avançou ${seconds}s (+${earned})`, 'info');
  },
}));
