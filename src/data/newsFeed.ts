import { NewsItem, CountryId } from '../types/game';
import { COUNTRIES_DATA } from './countries';

const BASE_NEWS_TEMPLATES = [
  { text: 'RELATÓRIO ORBITAL: Satélites espiões detectam manobras táticas na fronteira.', category: 'intel' as const },
  { text: 'MERCADO: Bolsas asiáticas operam em alta com exportações industriais.', category: 'market' as const },
  { text: 'DEFESA: Gabinetes de segurança nacional elevam nível de alerta estratégico.', category: 'war' as const },
  { text: 'ENERGIA: Tensões no estreito de Malaca pressionam preço do barril de petróleo.', category: 'market' as const },
  { text: 'DIPLOMACIA: Cúpula de potências discute tratados de não-proliferação e soberania.', category: 'breaking' as const },
  { text: 'CIBERGUERRA: Agências alertam para ofensivas cibernéticas contra infraestrutura crítica.', category: 'intel' as const },
  { text: 'INDÚSTRIA: Fábricas expandem produção de ligas de titânio e blindagens modernas.', category: 'war' as const },
];

export function generateRandomNews(): NewsItem {
  const tpl = BASE_NEWS_TEMPLATES[Math.floor(Math.random() * BASE_NEWS_TEMPLATES.length)];
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  
  return {
    id: `news_${Date.now()}_${Math.random()}`,
    text: tpl.text,
    timestamp: timeStr,
    category: tpl.category,
  };
}

export function generateConquestNews(countryId: CountryId, playerName: string): NewsItem {
  const target = COUNTRIES_DATA[countryId];
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  return {
    id: `news_conquest_${Date.now()}`,
    text: `URGENTE: Forças do ${playerName} assumem o controle de ${target.name} (${target.flag}). O mapa geopolítico foi redesenhado!`,
    timestamp: timeStr,
    category: 'breaking',
  };
}

export function generateTechNews(techName: string, playerName: string): NewsItem {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  return {
    id: `news_tech_${Date.now()}`,
    text: `AVANÇO CIENTÍFICO: ${playerName} mobiliza com sucesso a tecnologia "${techName}".`,
    timestamp: timeStr,
    category: 'intel',
  };
}
