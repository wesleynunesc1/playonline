import React, { useEffect, useState } from 'react';
import { ChevronDown, CircleHelp, Search } from 'lucide-react';
import { GLOSSARY, HELP, HelpTopic } from '../../data/help';
import { useApp } from '../../ui';
import { Modal } from '../common/Modal';

const SEEN_KEY = 'PLAY_ONLINE_HELP_SEEN';
const wasSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
};
const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Botão de interrogação; pisca até ser aberto pela primeira vez */
export const HelpButton: React.FC<{ className?: string; label?: string }> = ({ className = 'glass-btn w-11 h-11', label }) => {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(wasSeen);
  const show = () => {
    setOpen(true);
    setSeen(true);
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch { /* armazenamento indisponível */ }
  };
  return (
    <>
      <button onClick={show} aria-label="Como jogar" title="Como jogar" className={`${className} ${seen ? '' : 'help-pulse'}`}>
        <CircleHelp size={20} />{label && <span className="ml-2">{label}</span>}
      </button>
      {open && <HelpModal onClose={() => setOpen(false)} />}
    </>
  );
};

const HelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  // O mundo espera enquanto a pessoa lê (menos no Wi-Fi)
  useEffect(() => {
    useApp.setState({ help: true });
    return () => useApp.setState({ help: false });
  }, []);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(HELP[0].topics[1].title);
  const q = plain(query.trim());
  const match = (t: HelpTopic) => !q || plain([t.title, t.short, ...t.lines, t.tip ?? ''].join(' ')).includes(q);
  const groups = HELP.map((g) => ({ ...g, topics: g.topics.filter(match) })).filter((g) => g.topics.length);
  const words = GLOSSARY.filter(([w, m]) => !q || plain(w + m).includes(q));

  return (
    <Modal isOpen onClose={onClose} maxWidth="lg" title="❓ Como jogar" subtitle="Explicado bem fácil. Toque em uma pergunta para abrir.">
      <label className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3">
        <Search size={16} className="text-slate-400 shrink-0" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Qual é a sua dúvida?" className="flex-1 min-w-0 bg-transparent py-2.5 text-base outline-none" />
      </label>
      {groups.map((g) => (
        <section key={g.title} className="space-y-1.5">
          <h4 className="font-bold text-amber-300 pt-2">{g.title}</h4>
          {g.topics.map((t) => {
            const isOpen = open === t.title || (!!q && groups.length === 1 && g.topics.length === 1);
            return (
              <div key={t.title} className={`rounded-xl border ${isOpen ? 'border-blue-500 bg-slate-950' : 'border-slate-800 bg-slate-950/60'}`}>
                <button aria-expanded={isOpen} onClick={() => setOpen(isOpen ? '' : t.title)} className="w-full flex items-center gap-3 p-3 text-left">
                  <span className="text-2xl shrink-0">{t.icon}</span>
                  <span className="flex-1 min-w-0">
                    <b className="block text-sm text-white">{t.title}</b>
                    <span className="block text-xs text-slate-300">{t.short}</span>
                  </span>
                  <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 space-y-2 text-sm leading-relaxed text-slate-100 animate-in">
                    {t.lines.map((l) => <p key={l}>{l}</p>)}
                    {t.tip && <p className="rounded-lg bg-amber-950/60 border border-amber-700 p-2.5 text-amber-100">💡 {t.tip}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}
      {words.length > 0 && (
        <section className="space-y-1 text-sm">
          <h4 className="font-bold text-amber-300 pt-2">📚 Palavras difíceis</h4>
          {words.map(([w, m]) => <p key={w}><b className="text-white">{w}:</b> <span className="text-slate-300">{m}</span></p>)}
        </section>
      )}
      {!groups.length && !words.length && <p className="text-sm text-slate-400">Nada encontrado. Tente outra palavra, como "atacar" ou "dinheiro".</p>}
    </Modal>
  );
};
