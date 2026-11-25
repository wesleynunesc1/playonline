import { create } from 'zustand';
import {
  BattleResult,
  CountryId,
  CountryRuntimeState,
  GameSaveData,
  GameSpeed,
  GeopoliticalEvent,
  NewsItem,
  OfflineProgressInfo,
  ScreenType,
  Strike,
  TechNode,
  Threat,
} from '../types/game';
import { COUNTRIES_DATA, INITIAL_COUNTRY_IDS, TOTAL_COUNTRIES } from '../data/countries';
import { TECHNOLOGIES } from '../data/technologies';
import { GEOPOLITICAL_EVENTS } from '../data/events';
import { ACHIEVEMENTS } from '../data/achievements';
import {
  generateConquestNews,
  generateDefenseNews,
  generateRandomNews,
  generateTechNews,
  generateThreatNews,
} from '../data/newsFeed';
import {
  BALANCE,
  Modifiers,
  calculateEconomyUpgradeCost,
  calculateIncomeForLevel,
  calculateRecruitCost,
  computeIncome,
  getModifiers,
  getRandomRange,
  resolveBattle,
  resolveDefense,
} from '../utils/formulas';
import { formatMoney } from '../utils/formatters';
import { SAVE_VERSION, StorageService } from '../services/storage';
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
  | 'victory'
  | null;

export interface NotificationState {
  id: string;
  message: string;
  type: 'success' | 'danger' | 'info';
}

interface GameStore {
  screen: ScreenType;
  playerCountryId: CountryId | null;
  money: number;
  militaryPower: number;
  countries: Record<CountryId, CountryRuntimeState>;
  selectedCountryId: CountryId | null;
  bonusIncomePerSecond: number;
  unlockedTechIds: string[];
  unlockedAchievementIds: string[];
  activeCrisisEvent: GeopoliticalEvent | null;
  currentNews: NewsItem;
  gameSpeed: GameSpeed;
  isPaused: boolean;
  eventTimer: number;
  newsTimer: number;
  rearmTimer: number;
  threatTimer: number;
  threat: Threat | null;
  strike: Strike | null;
  victoryShown: boolean;
  activeModal: ActiveModal;
  lastBattleResult: BattleResult | null;
  offlineProgress: OfflineProgressInfo | null;
  notification: NotificationState | null;
  soundEnabled: boolean;
  hasSavedGame: boolean;
  totalPlayTimeSeconds: number;

  // Derivados
  getModifiers: () => Modifiers;
  getTotalIncomePerSecond: () => number;
  getConqueredTerritoriesCount: () => number;
  getUnlockedTechs: () => TechNode[];
  isTechUnlocked: (techId: string) => boolean;
  getRecruitCost: () => number;
  getUpgradeCost: (countryId: CountryId) => number;

  // Ciclo de vida
  setScreen: (screen: ScreenType) => void;
  initFromStorage: () => void;
  startNewGame: (countryId: CountryId) => void;
  continueSavedGame: () => boolean;
  gameTick: (deltaSeconds?: number) => void;
  grantOfflineProgress: (seconds: number) => void;
  collectOfflineProgress: () => void;

  // Gameplay
  selectCountry: (countryId: CountryId | null) => void;
  upgradeCountryEconomy: (countryId: CountryId) => boolean;
  recruitMilitary: (batchCount?: number) => boolean;
  attackCountry: (targetCountryId: CountryId) => BattleResult | null;
  sabotageCountry: (targetCountryId: CountryId) => boolean;
  unlockTech: (techId: string) => boolean;
  resolveCrisisEvent: (choiceId: string) => void;
  setGameSpeed: (speed: GameSpeed) => void;
  togglePause: () => void;

  // Interface
  openModal: (modal: ActiveModal) => void;
  closeModal: () => void;
  saveGame: () => void;
  restartGame: () => void;
  returnToHome: () => void;
  toggleSound: () => void;
  showNotification: (message: string, type?: NotificationState['type']) => void;

  // Debug (apenas desenvolvimento)
  debugAddMoney: (amount: number) => void;
  debugAddMilitary: (amount: number) => void;
  debugConquerCountry: (countryId: CountryId) => void;
  debugAdvanceTime: (seconds: number) => void;
  debugTriggerEvent: () => void;
  debugTriggerThreat: () => void;
}

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const nextThreatDelay = () => getRandomRange(BALANCE.THREAT_MIN_INTERVAL_S, BALANCE.THREAT_MAX_INTERVAL_S);

function createInitialCountries(playerId?: CountryId): Record<CountryId, CountryRuntimeState> {
  const result = {} as Record<CountryId, CountryRuntimeState>;
  for (const id of INITIAL_COUNTRY_IDS) {
    const base = COUNTRIES_DATA[id];
    result[id] = {
      id,
      income: base.baseIncome,
      defense: base.baseDefense,
      economyLevel: 1,
      owner: id === playerId ? 'player' : null,
      sabotageSeconds: 0,
    };
  }
  return result;
}

/** Migração: saves antigos (10 países, campos diferentes) recebem os países/campos que faltam */
function mergeSavedCountries(saved: GameSaveData['countries']): Record<CountryId, CountryRuntimeState> {
  const result = createInitialCountries();
  for (const id of INITIAL_COUNTRY_IDS) {
    const s = saved[id];
    if (!s) continue;
    const level = Math.max(1, Number(s.economyLevel) || 1);
    result[id] = {
      ...result[id],
      economyLevel: level,
      income: calculateIncomeForLevel(COUNTRIES_DATA[id].baseIncome, level),
      defense: Number(s.defense) || result[id].defense,
      owner: s.owner === 'player' ? 'player' : null,
      sabotageSeconds: Number(s.sabotageSeconds) || 0,
    };
  }
  return result;
}

const freshSession = () => ({
  bonusIncomePerSecond: 0,
  unlockedTechIds: [] as string[],
  unlockedAchievementIds: [] as string[],
  activeCrisisEvent: null,
  currentNews: generateRandomNews(),
  gameSpeed: 1 as GameSpeed,
  isPaused: false,
  eventTimer: BALANCE.EVENT_FIRST_S,
  newsTimer: BALANCE.NEWS_INTERVAL_S,
  rearmTimer: BALANCE.REARM_INTERVAL_S,
  threatTimer: nextThreatDelay(),
  threat: null,
  strike: null,
  victoryShown: false,
  activeModal: null as ActiveModal,
  lastBattleResult: null,
  offlineProgress: null,
  totalPlayTimeSeconds: 0,
});

let notificationTimer: ReturnType<typeof setTimeout> | undefined;

export const useGameStore = create<GameStore>((set, get) => {
  const playerName = () => {
    const id = get().playerCountryId;
    return id ? COUNTRIES_DATA[id].name : 'Seu Império';
  };

  /** Dispara a animação de míssil e executa `onImpact` quando ele chega */
  const launchStrike = (fromId: CountryId, toId: CountryId, hostile: boolean, onImpact: () => void) => {
    const campaign = get().playerCountryId;
    set({ strike: { fromId, toId, hostile, key: Date.now() } });
    sound.playLaunch();
    setTimeout(() => {
      if (get().screen !== 'game' || get().playerCountryId !== campaign) return;
      sound.playImpact();
      onImpact();
      set({ strike: null });
    }, BALANCE.STRIKE_DURATION_MS);
  };

  const resolveThreat = (threat: Threat) => {
    const s = get();
    const attacker = s.countries[threat.attackerId];
    const target = s.countries[threat.targetId];
    // O alvo pode ter sido perdido ou o atacante conquistado durante o aviso
    if (!attacker || attacker.owner === 'player' || target?.owner !== 'player') {
      set({ threat: null });
      return;
    }
    const result = resolveDefense(s.militaryPower, attacker, target, s.getModifiers());
    set({ threat: null });

    launchStrike(threat.attackerId, threat.targetId, true, () => {
      const cur = get();
      const countries = { ...cur.countries };
      if (!result.won) countries[threat.targetId] = { ...countries[threat.targetId], owner: null };
      set({
        countries,
        militaryPower: Math.max(BALANCE.MIN_ATTACK_POWER, cur.militaryPower - result.playerCasualties),
        currentNews: generateDefenseNews(threat.attackerId, threat.targetId, result.won),
        lastBattleResult: result,
      });
      if (cur.activeModal === null) set({ activeModal: 'battle_result' });
      else {
        const t = COUNTRIES_DATA[threat.targetId].name;
        get().showNotification(result.won ? `${t} resistiu à invasão!` : `${t} foi perdido para os rebeldes!`, result.won ? 'success' : 'danger');
      }
      if (result.won) sound.playVictory();
      else sound.playDefeat();
      get().saveGame();
    });
  };

  return {
    screen: 'home',
    playerCountryId: null,
    money: BALANCE.STARTING_MONEY,
    militaryPower: 100,
    countries: createInitialCountries(),
    selectedCountryId: null,
    ...freshSession(),
    notification: null,
    soundEnabled: sound.enabled,
    hasSavedGame: StorageService.hasSave(),

    // ================= Derivados =================
    getModifiers: () => getModifiers(get().unlockedTechIds),
    getTotalIncomePerSecond: () => {
      const s = get();
      return computeIncome(s.countries, s.getModifiers(), s.bonusIncomePerSecond);
    },
    getConqueredTerritoriesCount: () => Object.values(get().countries).filter((c) => c.owner === 'player').length,
    getUnlockedTechs: () => TECHNOLOGIES.filter((t) => get().unlockedTechIds.includes(t.id)),
    isTechUnlocked: (techId) => get().unlockedTechIds.includes(techId),
    getRecruitCost: () => calculateRecruitCost(get().militaryPower, 1, get().getModifiers().recruitDiscount),
    getUpgradeCost: (countryId) => {
      const c = get().countries[countryId];
      return calculateEconomyUpgradeCost(COUNTRIES_DATA[countryId].baseIncome, c.economyLevel, get().getModifiers().upgradeDiscount);
    },

    // ================= Ciclo de vida =================
    setScreen: (screen) => set({ screen }),

    initFromStorage: () => set({ hasSavedGame: StorageService.hasSave() }),

    startNewGame: (selectedId) => {
      const base = COUNTRIES_DATA[selectedId];
      set({
        ...freshSession(),
        screen: 'game',
        playerCountryId: selectedId,
        money: BALANCE.STARTING_MONEY,
        militaryPower: base.initialMilitary,
        countries: createInitialCountries(selectedId),
        selectedCountryId: null,
      });
      get().saveGame();
      sound.playSonar();
      get().showNotification(`Comando Imperial estabelecido: ${base.flag} ${base.name}.`, 'info');
    },

    continueSavedGame: () => {
      const saved = StorageService.loadGame();
      if (!saved || !COUNTRIES_DATA[saved.playerCountryId]) {
        set({ hasSavedGame: false });
        return false;
      }
      const countries = mergeSavedCountries(saved.countries);
      countries[saved.playerCountryId].owner = 'player'; // a capital nunca é perdida

      set({
        ...freshSession(),
        screen: 'game',
        playerCountryId: saved.playerCountryId,
        money: Number(saved.money) || 0,
        militaryPower: Math.max(BALANCE.MIN_ATTACK_POWER, Number(saved.militaryPower) || 0),
        countries,
        selectedCountryId: null,
        unlockedTechIds: Array.isArray(saved.unlockedTechIds) ? saved.unlockedTechIds : [],
        unlockedAchievementIds: Array.isArray(saved.unlockedAchievementIds) ? saved.unlockedAchievementIds : [],
        gameSpeed: [1, 2, 5].includes(saved.gameSpeed) ? saved.gameSpeed : 1,
        bonusIncomePerSecond: Number(saved.bonusIncomePerSecond) || 0,
        victoryShown: !!saved.victoryShown,
        totalPlayTimeSeconds: Number(saved.totalPlayTimeSeconds) || 0,
      });

      if (saved.lastSaveTimestamp) get().grantOfflineProgress((Date.now() - saved.lastSaveTimestamp) / 1000);
      sound.playSonar();
      return true;
    },

    gameTick: (deltaSeconds = 1) => {
      const s = get();
      if (s.screen !== 'game' || s.isPaused || s.activeModal === 'pause_menu') return;

      const dt = deltaSeconds * s.gameSpeed;
      const mods = s.getModifiers();
      const income = computeIncome(s.countries, mods, s.bonusIncomePerSecond);
      let money = s.money + income * dt;
      let military = s.militaryPower;
      let countries = s.countries;
      const patch: Partial<GameStore> = {};

      // Sabotagens expiram e rivais se rearmam com o tempo
      const rearm = s.rearmTimer - dt <= 0;
      if (rearm || INITIAL_COUNTRY_IDS.some((id) => countries[id].sabotageSeconds > 0)) {
        countries = { ...countries };
        for (const id of INITIAL_COUNTRY_IDS) {
          const c = countries[id];
          const sabotageSeconds = Math.max(0, c.sabotageSeconds - dt);
          const defense = rearm && c.owner !== 'player' ? Math.max(c.defense + 1, Math.round(c.defense * BALANCE.REARM_FACTOR)) : c.defense;
          if (sabotageSeconds !== c.sabotageSeconds || defense !== c.defense) countries[id] = { ...c, sabotageSeconds, defense };
        }
        patch.countries = countries;
      }
      patch.rearmTimer = rearm ? s.rearmTimer - dt + BALANCE.REARM_INTERVAL_S : s.rearmTimer - dt;

      // Noticiário
      patch.newsTimer = s.newsTimer - dt;
      if (patch.newsTimer <= 0) {
        patch.currentNews = generateRandomNews();
        patch.newsTimer = BALANCE.NEWS_INTERVAL_S;
      }

      // Eventos de crise (somente quando o jogador não está em outra tela)
      patch.eventTimer = s.eventTimer - dt;
      if (patch.eventTimer <= 0 && s.activeModal === null && !s.strike) {
        patch.activeCrisisEvent = pick(GEOPOLITICAL_EVENTS);
        patch.activeModal = 'crisis_event';
        patch.eventTimer = BALANCE.EVENT_INTERVAL_S;
        sound.playCrisisAlert();
      }

      // Ameaças: rivais atacam territórios conquistados (nunca a capital)
      const exposed = INITIAL_COUNTRY_IDS.filter((id) => countries[id].owner === 'player' && id !== s.playerCountryId);
      const rivals = INITIAL_COUNTRY_IDS.filter((id) => countries[id].owner !== 'player');
      let threatToResolve: Threat | null = null;
      if (s.threat) {
        const secondsLeft = s.threat.secondsLeft - dt;
        if (secondsLeft <= 0 && !s.strike) threatToResolve = s.threat;
        else patch.threat = { ...s.threat, secondsLeft: Math.max(0, secondsLeft) };
      } else if (exposed.length > 0 && rivals.length > 0) {
        patch.threatTimer = s.threatTimer - dt;
        if (patch.threatTimer <= 0) {
          const threat: Threat = { attackerId: pick(rivals), targetId: pick(exposed), secondsLeft: BALANCE.THREAT_WARNING_S };
          patch.threat = threat;
          patch.threatTimer = nextThreatDelay();
          patch.currentNews = generateThreatNews(threat.attackerId, threat.targetId);
          sound.playCrisisAlert();
        }
      }

      // Conquistas (agora concedem as recompensas prometidas)
      const ownedCount = INITIAL_COUNTRY_IDS.filter((id) => countries[id].owner === 'player').length;
      const unlockedAch = [...s.unlockedAchievementIds];
      for (const ach of ACHIEVEMENTS) {
        if (unlockedAch.includes(ach.id)) continue;
        const done = ach.isCompleted({
          money,
          militaryPower: military,
          conqueredCount: ownedCount,
          incomePerSecond: income,
          unlockedTechsCount: s.unlockedTechIds.length,
        });
        if (!done) continue;
        unlockedAch.push(ach.id);
        money += ach.rewardMoney;
        military += ach.rewardMilitary;
        sound.playTechUnlocked();
        get().showNotification(`🏆 ${ach.title}: +${formatMoney(ach.rewardMoney)} e +${ach.rewardMilitary} tropas`, 'success');
      }
      if (unlockedAch.length !== s.unlockedAchievementIds.length) patch.unlockedAchievementIds = unlockedAch;

      set({ ...patch, money, militaryPower: military, totalPlayTimeSeconds: s.totalPlayTimeSeconds + dt });
      if (threatToResolve) resolveThreat(threatToResolve);
    },

    grantOfflineProgress: (seconds) => {
      if (get().isPaused || get().activeModal === 'pause_menu') return;
      const info = StorageService.buildOfflineProgress(seconds, get().getTotalIncomePerSecond());
      if (!info) return;
      if (get().activeModal === null) set({ offlineProgress: info, activeModal: 'offline_progress' });
      else {
        set((st) => ({ money: st.money + info.moneyEarned }));
        get().showNotification(`Produção durante a ausência: +${formatMoney(info.moneyEarned)}`, 'success');
      }
    },

    collectOfflineProgress: () => {
      const { offlineProgress } = get();
      if (!offlineProgress) return;
      sound.playBuy();
      set((st) => ({ money: st.money + offlineProgress.moneyEarned, offlineProgress: null, activeModal: null }));
      get().saveGame();
      get().showNotification(`+${formatMoney(offlineProgress.moneyEarned)} coletados do tesouro!`, 'success');
    },

    // ================= Gameplay =================
    selectCountry: (countryId) => {
      sound.playClick();
      set({ selectedCountryId: countryId, activeModal: countryId ? 'country_detail' : null });
    },

    upgradeCountryEconomy: (countryId) => {
      const s = get();
      const target = s.countries[countryId];
      if (!target || target.owner !== 'player') return false;
      const cost = s.getUpgradeCost(countryId);
      if (s.money < cost) {
        sound.playDefeat();
        s.showNotification('Fundos insuficientes para modernização.', 'danger');
        return false;
      }
      const level = target.economyLevel + 1;
      const income = calculateIncomeForLevel(COUNTRIES_DATA[countryId].baseIncome, level);
      sound.playBuy();
      set({ money: s.money - cost, countries: { ...s.countries, [countryId]: { ...target, economyLevel: level, income } } });
      get().saveGame();
      get().showNotification(`${COUNTRIES_DATA[countryId].name}: economia Nv. ${level} (+$${income}/s)`, 'success');
      return true;
    },

    recruitMilitary: (batchCount = 1) => {
      const s = get();
      const cost = calculateRecruitCost(s.militaryPower, batchCount, s.getModifiers().recruitDiscount);
      if (s.money < cost) {
        sound.playDefeat();
        s.showNotification('Tesouro insuficiente para mobilização militar.', 'danger');
        return false;
      }
      const troops = BALANCE.RECRUIT_BATCH_SIZE * batchCount;
      sound.playRecruit();
      set({ money: s.money - cost, militaryPower: s.militaryPower + troops });
      get().saveGame();
      get().showNotification(`+${troops} tropas de prontidão!`, 'success');
      return true;
    },

    attackCountry: (targetId) => {
      const s = get();
      const target = s.countries[targetId];
      if (!target || target.owner === 'player' || s.strike || !s.playerCountryId) return null;
      if (s.militaryPower < BALANCE.MIN_ATTACK_POWER) {
        sound.playDefeat();
        s.showNotification('Efetivo insuficiente para uma ofensiva!', 'danger');
        return null;
      }

      const result = resolveBattle(s.militaryPower, target, s.getModifiers());
      set({ activeModal: null });

      launchStrike(s.playerCountryId, targetId, false, () => {
        const cur = get();
        const countries = { ...cur.countries };
        if (result.won) {
          countries[targetId] = { ...countries[targetId], owner: 'player', sabotageSeconds: 0 };
          for (const id of INITIAL_COUNTRY_IDS) {
            const c = countries[id];
            if (c.owner !== 'player') countries[id] = { ...c, defense: Math.round(c.defense * BALANCE.MOBILIZATION_FACTOR) };
          }
        }
        const threatCancelled = result.won && cur.threat?.attackerId === targetId;
        set({
          countries,
          militaryPower: Math.max(BALANCE.MIN_ATTACK_POWER, cur.militaryPower - result.playerCasualties),
          lastBattleResult: result,
          activeModal: 'battle_result',
          ...(result.won ? { currentNews: generateConquestNews(targetId, playerName()) } : {}),
          ...(threatCancelled ? { threat: null } : {}),
        });
        if (result.won) sound.playVictory();
        else sound.playDefeat();
        get().saveGame();
      });
      return result;
    },

    sabotageCountry: (targetId) => {
      const s = get();
      const target = s.countries[targetId];
      if (!target || target.owner === 'player' || target.sabotageSeconds > 0) return false;
      if (s.money < BALANCE.SABOTAGE_COST) {
        sound.playDefeat();
        s.showNotification(`Fundos insuficientes para a operação (${formatMoney(BALANCE.SABOTAGE_COST)}).`, 'danger');
        return false;
      }
      const chance = Math.min(BALANCE.SABOTAGE_MAX_SUCCESS, BALANCE.SABOTAGE_BASE_SUCCESS + s.getModifiers().spyBonus);
      const success = Math.random() < chance;
      const name = COUNTRIES_DATA[targetId].name;
      set({
        money: s.money - BALANCE.SABOTAGE_COST,
        ...(success ? { countries: { ...s.countries, [targetId]: { ...target, sabotageSeconds: BALANCE.SABOTAGE_DURATION_S } } } : {}),
      });
      if (success) {
        sound.playSabotage();
        s.showNotification(`Operação concluída: defesas de ${name} reduzidas em 25% por ${BALANCE.SABOTAGE_DURATION_S}s!`, 'success');
      } else {
        sound.playDefeat();
        s.showNotification(`Agentes interceptados em ${name}. Operação fracassou.`, 'danger');
      }
      get().saveGame();
      return success;
    },

    unlockTech: (techId) => {
      const s = get();
      const tech = TECHNOLOGIES.find((t) => t.id === techId);
      if (!tech || s.unlockedTechIds.includes(techId)) return false;
      if (tech.requiredTechId && !s.unlockedTechIds.includes(tech.requiredTechId)) {
        s.showNotification('Requer a tecnologia anterior.', 'danger');
        return false;
      }
      if (s.money < tech.cost) {
        sound.playDefeat();
        s.showNotification('Orçamento insuficiente para a pesquisa.', 'danger');
        return false;
      }
      sound.playTechUnlocked();
      set({
        money: s.money - tech.cost,
        unlockedTechIds: [...s.unlockedTechIds, techId],
        currentNews: generateTechNews(tech.name, playerName()),
      });
      get().saveGame();
      get().showNotification(`Pesquisa concluída: ${tech.name}!`, 'success');
      return true;
    },

    resolveCrisisEvent: (choiceId) => {
      const s = get();
      const choice = s.activeCrisisEvent?.choices.find((c) => c.id === choiceId);
      if (!choice) return;
      if (choice.costMoney && s.money < choice.costMoney) {
        sound.playDefeat();
        s.showNotification('Recursos insuficientes para esta diretriz.', 'danger');
        return;
      }
      const effects = { buy: sound.playBuy, recruit: sound.playRecruit, sabotage: sound.playSabotage, victory: sound.playVictory };
      (effects[choice.soundEffect ?? 'buy'] ?? sound.playClick).call(sound);

      set({
        money: s.money - (choice.costMoney ?? 0) + (choice.rewardMoney ?? 0),
        militaryPower: Math.max(BALANCE.MIN_ATTACK_POWER, s.militaryPower - (choice.costMilitary ?? 0) + (choice.rewardMilitary ?? 0)),
        bonusIncomePerSecond: s.bonusIncomePerSecond + (choice.rewardIncomeBonus ?? 0),
        activeCrisisEvent: null,
        activeModal: null,
      });
      get().saveGame();
      get().showNotification(`Diretriz executada: ${choice.label}`, 'info');
    },

    setGameSpeed: (speed) => {
      sound.playClick();
      set({ gameSpeed: speed, isPaused: false });
    },

    togglePause: () => {
      sound.playClick();
      set((st) => ({ isPaused: !st.isPaused }));
    },

    // ================= Interface =================
    openModal: (modal) => {
      sound.playClick();
      set({ activeModal: modal });
    },

    closeModal: () => {
      const s = get();
      sound.playClick();
      if (s.activeModal === 'battle_result' && !s.victoryShown && s.getConqueredTerritoriesCount() === TOTAL_COUNTRIES) {
        set({ activeModal: 'victory', victoryShown: true });
        sound.playVictory();
        get().saveGame();
        return;
      }
      set({ activeModal: null });
    },

    saveGame: () => {
      const s = get();
      if (!s.playerCountryId) return;
      StorageService.saveGame({
        version: SAVE_VERSION,
        playerCountryId: s.playerCountryId,
        money: s.money,
        militaryPower: s.militaryPower,
        countries: s.countries,
        conqueredCount: s.getConqueredTerritoriesCount(),
        totalPlayTimeSeconds: s.totalPlayTimeSeconds,
        unlockedTechIds: s.unlockedTechIds,
        unlockedAchievementIds: s.unlockedAchievementIds,
        gameSpeed: s.gameSpeed,
        bonusIncomePerSecond: s.bonusIncomePerSecond,
        victoryShown: s.victoryShown,
      });
      set({ hasSavedGame: true });
    },

    restartGame: () => {
      StorageService.clearSave();
      set({ ...freshSession(), hasSavedGame: false, screen: 'country_select', selectedCountryId: null, playerCountryId: null });
    },

    returnToHome: () => {
      get().saveGame();
      set({ screen: 'home', activeModal: null, selectedCountryId: null, threat: null, strike: null });
    },

    toggleSound: () => {
      const enabled = !get().soundEnabled;
      sound.enabled = enabled;
      set({ soundEnabled: enabled });
    },

    showNotification: (message, type = 'info') => {
      const id = `${Date.now()}_${Math.random()}`;
      set({ notification: { id, message, type } });
      clearTimeout(notificationTimer);
      notificationTimer = setTimeout(() => {
        if (get().notification?.id === id) set({ notification: null });
      }, 3800);
    },

    // ================= Debug =================
    debugAddMoney: (amount) => set((st) => ({ money: st.money + amount })),
    debugAddMilitary: (amount) => set((st) => ({ militaryPower: st.militaryPower + amount })),
    debugConquerCountry: (countryId) => {
      set((st) => ({ countries: { ...st.countries, [countryId]: { ...st.countries[countryId], owner: 'player' } } }));
      get().saveGame();
    },
    debugAdvanceTime: (seconds) => set((st) => ({ money: st.money + st.getTotalIncomePerSecond() * seconds })),
    debugTriggerEvent: () => {
      set({ activeCrisisEvent: pick(GEOPOLITICAL_EVENTS), activeModal: 'crisis_event' });
      sound.playCrisisAlert();
    },
    debugTriggerThreat: () => {
      const s = get();
      const exposed = INITIAL_COUNTRY_IDS.filter((id) => s.countries[id].owner === 'player' && id !== s.playerCountryId);
      const rivals = INITIAL_COUNTRY_IDS.filter((id) => s.countries[id].owner !== 'player');
      if (!exposed.length || !rivals.length) {
        s.showNotification('Conquiste um território além da capital para testar ameaças.', 'info');
        return;
      }
      set({ threat: { attackerId: pick(rivals), targetId: pick(exposed), secondsLeft: BALANCE.THREAT_WARNING_S }, activeModal: null });
      sound.playCrisisAlert();
    },
  };
});
