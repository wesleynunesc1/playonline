import React from 'react';
import {
  Anchor, AlertTriangle, Antenna, Atom, Award, BadgeDollarSign, BookOpen, Bomb, Bot, Brain, Building, Building2, Castle, Church, CloudFog, CloudRain, Coins, Cpu, Crosshair, Crown, Dices, Dna, Eye, Factory, Fish, Flag,
  Flame, FlaskConical, Fuel, Gem, Globe2, GraduationCap, HandCoins, Handshake, Headphones, Heart, HeartCrack, Home, Hospital, Landmark, Leaf, Map as MapIcon, Megaphone, Moon, Mountain, Package, Plane, PlugZap, Radar, Radiation,
  Rocket, Sailboat, Satellite, Scale, Shield, ShieldCheck, Ship, Skull, Sparkles, Sprout, Star, Sun, Sunset, Swords, Target, Telescope, Timer, Trophy, TrendingUp, Truck, Users, WalletCards, Wheat, Wind, Wrench, Zap,
} from 'lucide-react';

/** Ícones de traço no lugar dos emojis do catálogo */
const MAP: Record<string, React.ElementType> = {
  '🏗️': Wrench, '🌆': Building2, '🤝': Handshake, '🏙️': Building, '📦': Package, '🪖': Users, '🗺️': MapIcon, '🔬': FlaskConical, '🏭': Factory, '🌃': Building2, '👑': Crown, '🛰️': Satellite, '☢️': Radiation, '🏆': Trophy, '🏡': Home,
  '🌎': Globe2, '💀': Skull, '🤖': Bot, '⚔️': Swords, '💰': Coins, '⏩': Timer, '⚡': Zap, '👁️': Eye, '🚫': Plane, '🕊️': Leaf, '🙅': Shield, '🛩️': Plane, '🏚️': HeartCrack, '🏰': Castle, '📈': TrendingUp, '🎲': Dices,
  '🛢️': Fuel, '🌬️': Wind, '🌧️': CloudRain, '🌫️': CloudFog, '🚩': Flag, '🏷️': BadgeDollarSign, '📣': Megaphone, '🔌': PlugZap, '🌽': Wheat, '☀️': Sun, '💻': Cpu, '💼': WalletCards,
  '🧠': Brain, '🦾': ShieldCheck, '💳': HandCoins, '🌱': Sprout, '⚙️': Truck, '🔭': Telescope, '🎧': Headphones, '🧬': Dna, '🚀': Rocket, '🌋': Atom, '🔰': ShieldCheck, '💥': Bomb,
  '🌐': Globe2, '🚢': Ship, '⛪': Church, '🎓': GraduationCap, '🏄': Sailboat, '🌅': Sunset, '🦖': BookOpen, '🪂': Mountain, '🙏': Heart, '⛰️': Mountain, '🎢': Star, '🪁': Wind, '🚡': Mountain, '🎣': Fish, '🌾': Wheat,
  '🎖️': Award, '💸': HandCoins, '🚜': Truck, '✈️': Plane, '☄️': Flame, '🕯️': Moon, '🧱': Anchor, '🎯': Target, '⚠️': AlertTriangle, '📡': Antenna, '🏥': Hospital, '🏦': Landmark, '✅': Star, '⚖️': Scale, '✨': Sparkles, '💎': Gem, '🎛️': Radar, '🔫': Crosshair,
};
export const Ico: React.FC<{ e: string; size?: number; className?: string }> = ({ e, size = 16, className }) => {
  const I = MAP[e];
  return I ? <I size={size} className={`ico ${className ?? ''}`} aria-hidden="true" /> : <span className={className}>{e}</span>;
};
/** Texto com emojis conhecidos trocados por ícones */
export const Rich: React.FC<{ t: string; size?: number }> = ({ t, size = 14 }) => (
  <>{t.split(/(\p{Extended_Pictographic}️?)/u).map((x, i) => (MAP[x] ? <Ico key={i} e={x} size={size} /> : x))}</>
);
