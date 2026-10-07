import { create } from 'zustand';
import {
  CountryId,
  CountryRuntimeState,
  ScreenType,
  BattleResult,
  OfflineProgressInfo,
  TechNode,
  GeopoliticalEvent,
  GameSpeed,
  NewsItem,
} from '../types/game';
import { COUNTRIES_DATA, INITIAL_COUNTRY_IDS } from '../data/countries';
import { TECHNOLOGIES } from '../data/technologies';
import { GEOPOLITICAL_EVENTS } from '../data/events';
import { ACHIEVEMENTS } from '../data/achievements';
import { generateRandomNews, generateConquestNews, generateTechNews } from '../data/newsFeed';
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
  | 'tech_tree'
  | 'crisis_event'
  | 'achievements'
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
  bonusIncomePerSecond: number;

  // Tecnologias, Eventos e Conquistas
  unlockedTechIds: string[];
  unlockedAchievementIds: string[];
  activeCrisisEvent: GeopoliticalEvent | null;
  currentNews: NewsItem;

  // Simulação e Tempo
  gameSpeed: GameSpeed;
  isPaused: boolean;
  eventTimer: number;
  newsTimer: number;

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
  getUnlockedTechs: () => TechNode[];
  isTechUnlocked: (techId: string) => boolean;

  // Ações Principais
  initFromStorage: () => void;
  startNewGame: (countryId: CountryId) => void;
  continueSavedGame: () => boolean;
  gameTick: (deltaSeconds?: number) => void;

  // Interação e Gameplay
  selectCountry: (countryId: CountryId | null) => void;
  upgradeCountryEconomy: (countryId: CountryId) => boolean;
  recruitMilitary: (batchCount?: number) => boolean;
  attackCountry: (targetCountryId: CountryId) => BattleResult | null;
  sabotageCountry: (targetCountryId: CountryId) => boolean;
  collectOfflineProgress: () => void;

  // P&D e Eventos
  unlockTech: (techId: string) => boolean;
  resolveCrisisEvent: (choiceId: string) => void;
  setGameSpeed: (speed: GameSpeed) => void;
  togglePause: () => void;

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
  debugTriggerEvent: () => void;
}

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
      sabotagedTurns: 0,
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
  bonusIncomePerSecond: 0,

  unlockedTechIds: [],
  unlockedAchievementIds: [],
  activeCrisisEvent: null,
  currentNews: generateRandomNews(),

  gameSpeed: 1,
  isPaused: false,
  eventTimer: 35, // Primeiro evento aos 35 segundos
  newsTimer: 10,

  activeModal: null,
  lastBattleResult: null,
  offlineProgress: null,
  notification: null,

  soundEnabled: true,
  hasSavedGame: StorageService.hasSave(),
  totalPlayTimeSeconds: 0,

  getTotalIncomePerSecond: () => {
    const { countries, unlockedTechIds, bonusIncomePerSecond } = get();
    const baseSum = Object.values(countries)
      .filter((c) => c.owner === 'player')
      .reduce((acc, c) => acc + c.income, 0);

    let multiplier = 1;
    TECHNOLOGIES.forEach((tech) => {
      if (unlockedTechIds.includes(tech.id) && tech.effects.incomeMultiplier) {
        multiplier += tech.effects.incomeMultiplier;
      }
    });

    return Math.round(baseSum * multiplier) + bonusIncomePerSecond;
  },

  getConqueredTerritoriesCount: () => {
    const { countries } = get();
    return Object.values(countries).filter((c) => c.owner === 'player').length;
  },

  getUnlockedTechs: () => {
    const { unlockedTechIds } = get();
    return TECHNOLOGIES.filter((t) => unlockedTechIds.includes(t.id));
  },

  isTechUnlocked: (techId: string) => {
    return get().unlockedTechIds.includes(techId);
  },

  initFromStorage: () => {
    const hasSave = StorageService.hasSave();
    set({ hasSavedGame: hasSave });
  },

  startNewGame: (selectedId: CountryId) => {
    const base = COUNTRIES_DATA[selectedId];
    const initialCountries = createInitialCountriesState(selectedId);

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
      bonusIncomePerSecond: 0,
      unlockedTechIds: [],
      unlockedAchievementIds: [],
      activeCrisisEvent: null,
      currentNews: generateRandomNews(),
      gameSpeed: 1 as GameSpeed,
      isPaused: false,
      eventTimer: 40,
      newsTimer: 10,
      activeModal: null,
      lastBattleResult: null,
      offlineProgress: null,
      totalPlayTimeSeconds: 0,
    };

    set(newState);

    StorageService.saveGame({
      version: 1,
      playerCountryId: selectedId,
      money: 1000,
      militaryPower: base.initialMilitary,
      countries: initialCountries,
      conqueredCount: 1,
      totalPlayTimeSeconds: 0,
      unlockedTechIds: [],
      unlockedAchievementIds: [],
      gameSpeed: 1,
    });

    set({ hasSavedGame: true });
    sound.playSonar();
    get().showNotification(`Comando Imperial Estabelecido: ${base.name}.`, 'info');
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

    const offlineInfo = StorageService.calculateOfflineProgress(saved, currentIncome);

    set({
      screen: 'game',
      playerCountryId: saved.playerCountryId,
      money: saved.money,
      militaryPower: saved.militaryPower,
      countries: saved.countries,
      selectedCountryId: saved.playerCountryId,
      unlockedTechIds: saved.unlockedTechIds || [],
      unlockedAchievementIds: saved.unlockedAchievementIds || [],
      gameSpeed: saved.gameSpeed || 1,
      isPaused: false,
      totalPlayTimeSeconds: saved.totalPlayTimeSeconds || 0,
      offlineProgress: offlineInfo,
      activeModal: offlineInfo ? 'offline_progress' : null,
      currentNews: generateRandomNews(),
    });

    sound.playSonar();
    return true;
  },

  gameTick: (deltaSeconds = 1) => {
    const {
      screen,
      money,
      getTotalIncomePerSecond,
      totalPlayTimeSeconds,
      gameSpeed,
      isPaused,
      eventTimer,
      newsTimer,
      unlockedAchievementIds,
      unlockedTechIds,
      militaryPower,
      getConqueredTerritoriesCount,
    } = get();

    if (screen !== 'game' || isPaused) return;

    const actualDelta = deltaSeconds * gameSpeed;
    const income = getTotalIncomePerSecond();
    const newMoney = money + income * actualDelta;

    // Gerenciador de notícias dinâmicas a cada 15 segundos
    let nextNewsTimer = newsTimer - actualDelta;
    let nextNews = get().currentNews;
    if (nextNewsTimer <= 0) {
      nextNews = generateRandomNews();
      nextNewsTimer = 15;
    }

    // Gerenciador de eventos geopolíticos a cada ~60 segundos
    let nextEventTimer = eventTimer - actualDelta;
    let nextEvent = get().activeCrisisEvent;
    let nextModal = get().activeModal;

    if (nextEventTimer <= 0 && !nextEvent && nextModal === null) {
      const randomEvt = GEOPOLITICAL_EVENTS[Math.floor(Math.random() * GEOPOLITICAL_EVENTS.length)];
      nextEvent = randomEvt;
      nextModal = 'crisis_event';
      nextEventTimer = 65; // Próximo evento em 65s
      sound.playCrisisAlert();
    }

    // Verificação contínua de conquistas
    const newUnlockedAchievements = [...unlockedAchievementIds];
    ACHIEVEMENTS.forEach((ach) => {
      if (!newUnlockedAchievements.includes(ach.id)) {
        const completed = ach.isCompleted({
          money: newMoney,
          militaryPower,
          conqueredCount: getConqueredTerritoriesCount(),
          incomePerSecond: income,
          unlockedTechsCount: unlockedTechIds.length,
        });

        if (completed) {
          newUnlockedAchievements.push(ach.id);
          sound.playTechUnlocked();
          get().showNotification(
            `🏆 CONQUISTA DESBLOQUEADA: ${ach.title}! (+${ach.rewardMoney ? `$${ach.rewardMoney}` : ''})`,
            'success'
          );
        }
      }
    });

    set({
      money: newMoney,
      totalPlayTimeSeconds: totalPlayTimeSeconds + actualDelta,
      newsTimer: nextNewsTimer,
      currentNews: nextNews,
      eventTimer: nextEventTimer,
      activeCrisisEvent: nextEvent,
      activeModal: nextModal,
      unlockedAchievementIds: newUnlockedAchievements,
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
    const { countries, money, unlockedTechIds } = get();
    const target = countries[countryId];
    if (!target || target.owner !== 'player') return false;

    // Desconto de tecnologia
    let discount = 0;
    TECHNOLOGIES.forEach((t) => {
      if (unlockedTechIds.includes(t.id) && t.effects.upgradeCostDiscount) {
        discount += t.effects.upgradeCostDiscount;
      }
    });

    const base = COUNTRIES_DATA[countryId];
    const cost = calculateEconomyUpgradeCost(base.baseIncome, target.economyLevel, discount);

    if (money < cost) {
      sound.playDefeat();
      get().showNotification('Fundos insuficientes para modernização.', 'danger');
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
      `${target.name} expandiu complexo econômico para Nv. ${nextLevel}! (+$${nextIncome}/s)`,
      'success'
    );
    return true;
  },

  recruitMilitary: (batchCount = 1) => {
    const { militaryPower, money, unlockedTechIds } = get();

    let discount = 0;
    TECHNOLOGIES.forEach((t) => {
      if (unlockedTechIds.includes(t.id) && t.effects.recruitCostDiscount) {
        discount += t.effects.recruitCostDiscount;
      }
    });

    const cost = calculateRecruitCost(militaryPower, batchCount, discount);
    const troopsToAdd = BALANCE.RECRUIT_BATCH_SIZE * batchCount;

    if (money < cost) {
      sound.playDefeat();
      get().showNotification('Tesouro insuficiente para mobilização militar.', 'danger');
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
    get().showNotification(`+${troopsToAdd} Forças Militares incorporadas de prontidão!`, 'success');
    return true;
  },

  attackCountry: (targetCountryId: CountryId) => {
    const { countries, militaryPower, getUnlockedTechs, playerCountryId } = get();
    const target = countries[targetCountryId];
    if (!target || target.owner === 'player') return null;

    if (militaryPower < 10) {
      sound.playDefeat();
      get().showNotification('Efetivo insuficiente para coordenar ofensiva militar!', 'danger');
      return null;
    }

    const battleResult = resolveBattle(militaryPower, target, getUnlockedTechs());

    let updatedCountries = { ...countries };
    let newMilitary = Math.max(10, militaryPower - battleResult.playerCasualties);

    if (battleResult.won) {
      sound.playVictory();
      updatedCountries[targetCountryId] = {
        ...target,
        owner: 'player',
        sabotagedTurns: 0,
      };

      const playerName = playerCountryId ? COUNTRIES_DATA[playerCountryId].name : 'Seu Império';
      set({ currentNews: generateConquestNews(targetCountryId, playerName) });
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

  sabotageCountry: (targetCountryId: CountryId) => {
    const { money, countries, isTechUnlocked } = get();
    const target = countries[targetCountryId];
    if (!target || target.owner === 'player') return false;

    const sabotageCost = 800;
    if (money < sabotageCost) {
      sound.playDefeat();
      get().showNotification('Fundos insuficientes para financiar operação encoberta ($800).', 'danger');
      return false;
    }

    const bonusSuccess = isTechUnlocked('int_black_ops') ? 0.95 : 0.75;
    const isSuccess = Math.random() < bonusSuccess;

    const newMoney = money - sabotageCost;

    if (isSuccess) {
      sound.playSabotage();
      const updatedCountries = {
        ...countries,
        [targetCountryId]: {
          ...target,
          sabotagedTurns: 3,
        },
      };
      set({ money: newMoney, countries: updatedCountries });
      get().showNotification(
        `OPERAÇÃO BEM-SUCEDIDA: Defesas de ${target.name} foram sabotadas e reduzidas em 25%!`,
        'success'
      );
      get().saveGame();
      return true;
    } else {
      sound.playDefeat();
      set({ money: newMoney });
      get().showNotification(
        `FALHA DE AGENTES: Infiltração em ${target.name} foi interceptada pelas defesas rivais.`,
        'danger'
      );
      return false;
    }
  },

  unlockTech: (techId: string) => {
    const { money, unlockedTechIds, playerCountryId } = get();
    const tech = TECHNOLOGIES.find((t) => t.id === techId);
    if (!tech || unlockedTechIds.includes(techId)) return false;

    if (tech.requiredTechId && !unlockedTechIds.includes(tech.requiredTechId)) {
      get().showNotification('Requisitos de tecnologia anterior não atendidos.', 'danger');
      return false;
    }

    if (money < tech.cost) {
      sound.playDefeat();
      get().showNotification('Orçamento insuficiente para pesquisa científica.', 'danger');
      return false;
    }

    const newMoney = money - tech.cost;
    const newUnlocked = [...unlockedTechIds, techId];
    sound.playTechUnlocked();

    const playerName = playerCountryId ? COUNTRIES_DATA[playerCountryId].name : 'Seu Império';

    set({
      money: newMoney,
      unlockedTechIds: newUnlocked,
      currentNews: generateTechNews(tech.name, playerName),
    });

    get().saveGame();
    get().showNotification(`PESQUISA CONCLUÍDA: ${tech.name} mobilizada com sucesso!`, 'success');
    return true;
  },

  resolveCrisisEvent: (choiceId: string) => {
    const { activeCrisisEvent, money, militaryPower, bonusIncomePerSecond } = get();
    if (!activeCrisisEvent) return;

    const choice = activeCrisisEvent.choices.find((c) => c.id === choiceId);
    if (!choice) return;

    let newMoney = money;
    let newMilitary = militaryPower;
    let newBonusIncome = bonusIncomePerSecond;

    if (choice.costMoney) {
      if (newMoney < choice.costMoney) {
        sound.playDefeat();
        get().showNotification('Recursos financeiros insuficientes para esta opção.', 'danger');
        return;
      }
      newMoney -= choice.costMoney;
    }

    if (choice.costMilitary) {
      newMilitary = Math.max(10, newMilitary - choice.costMilitary);
    }

    if (choice.rewardMoney) newMoney += choice.rewardMoney;
    if (choice.rewardMilitary) newMilitary += choice.rewardMilitary;
    if (choice.rewardIncomeBonus) newBonusIncome += choice.rewardIncomeBonus;

    if (choice.soundEffect === 'buy') sound.playBuy();
    else if (choice.soundEffect === 'recruit') sound.playRecruit();
    else if (choice.soundEffect === 'sabotage') sound.playSabotage();
    else sound.playClick();

    set({
      money: newMoney,
      militaryPower: newMilitary,
      bonusIncomePerSecond: newBonusIncome,
      activeCrisisEvent: null,
      activeModal: null,
    });

    get().saveGame();
    get().showNotification(`Decisão aplicada: ${choice.label}`, 'info');
  },

  setGameSpeed: (speed: GameSpeed) => {
    sound.playClick();
    set({ gameSpeed: speed, isPaused: false });
  },

  togglePause: () => {
    sound.playClick();
    set((s) => ({ isPaused: !s.isPaused }));
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
      unlockedTechIds,
      unlockedAchievementIds,
      gameSpeed,
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
      unlockedTechIds,
      unlockedAchievementIds,
      gameSpeed,
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
      unlockedTechIds: [],
      unlockedAchievementIds: [],
      bonusIncomePerSecond: 0,
      activeCrisisEvent: null,
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

  debugTriggerEvent: () => {
    const randomEvt = GEOPOLITICAL_EVENTS[Math.floor(Math.random() * GEOPOLITICAL_EVENTS.length)];
    set({
      activeCrisisEvent: randomEvt,
      activeModal: 'crisis_event',
    });
    sound.playCrisisAlert();
    get().showNotification(`[DEBUG] Evento acionado!`, 'info');
  },
}));
