import { NewsItem, CountryId } from '../types/game';
import { COUNTRIES_DATA } from './countries';

const BASE_NEWS: Pick<NewsItem, 'text' | 'category'>[] = [
  { text: 'RELATÓRIO ORBITAL: Satélites detectam manobras táticas em fronteiras do hemisfério sul.', category: 'intel' },
  { text: 'MERCADO: Bolsas asiáticas operam em alta com exportações industriais.', category: 'market' },
  { text: 'DEFESA: Gabinetes de segurança elevam nível de alerta estratégico.', category: 'war' },
  { text: 'ENERGIA: Tensões no estreito de Malaca pressionam o preço do petróleo.', category: 'market' },
  { text: 'DIPLOMACIA: Cúpula de potências discute tratados de soberania territorial.', category: 'breaking' },
  { text: 'CIBERGUERRA: Agências alertam para ataques contra infraestrutura crítica.', category: 'intel' },
  { text: 'INDÚSTRIA: Fábricas ampliam produção de blindagens e drones táticos.', category: 'war' },
  { text: 'COMMODITIES: Lítio e cobre atingem máxima histórica nos mercados globais.', category: 'market' },
  { text: 'INTELIGÊNCIA: Rivais independentes ampliam orçamentos de defesa.', category: 'intel' },
];

function now(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour12: false });
}

function make(text: string, category: NewsItem['category']): NewsItem {
  return { id: `news_${Date.now()}_${Math.random()}`, text, timestamp: now(), category };
}

export function generateRandomNews(): NewsItem {
  const n = BASE_NEWS[Math.floor(Math.random() * BASE_NEWS.length)];
  return make(n.text, n.category);
}

export function generateConquestNews(countryId: CountryId, playerName: string): NewsItem {
  const t = COUNTRIES_DATA[countryId];
  return make(`URGENTE: Forças de ${playerName} assumem o controle de ${t.name} ${t.flag}. O mapa mundial foi redesenhado!`, 'breaking');
}

export function generateTechNews(techName: string, playerName: string): NewsItem {
  return make(`AVANÇO CIENTÍFICO: ${playerName} mobiliza com sucesso a tecnologia "${techName}".`, 'intel');
}

export function generateThreatNews(attackerId: CountryId, targetId: CountryId): NewsItem {
  const a = COUNTRIES_DATA[attackerId];
  const t = COUNTRIES_DATA[targetId];
  return make(`ALERTA: ${a.name} ${a.flag} concentra tropas na fronteira de ${t.name} ${t.flag}.`, 'war');
}

export function generateDefenseNews(attackerId: CountryId, targetId: CountryId, held: boolean): NewsItem {
  const a = COUNTRIES_DATA[attackerId];
  const t = COUNTRIES_DATA[targetId];
  return held
    ? make(`VITÓRIA DEFENSIVA: Ofensiva de ${a.name} é repelida em ${t.name}.`, 'breaking')
    : make(`REVÉS: ${t.name} se liberta do império após ofensiva de ${a.name}.`, 'breaking');
}
