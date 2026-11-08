import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Preferences = {
  name: string;
  accent: 'magenta' | 'violet' | 'cyan';
  textSize: 'normal' | 'large' | 'extra';
  reduceMotion: boolean;
};
const defaults: Preferences = { name: '', accent: 'magenta', textSize: 'normal', reduceMotion: false };
const storageKey = 'ws-study:appearance:v1';
const colors = { magenta: '245 112 209', violet: '181 156 255', cyan: '103 232 249' };
const sizes = { normal: '16px', large: '18px', extra: '20px' };

function normalize(value: unknown): Preferences {
  if (!value || typeof value !== 'object') return { ...defaults };
  const input = value as Record<string, unknown>;
  return {
    name: typeof input.name === 'string' ? input.name.trim().slice(0, 80) : '',
    accent: input.accent === 'violet' || input.accent === 'cyan' ? input.accent : 'magenta',
    textSize: input.textSize === 'large' || input.textSize === 'extra' ? input.textSize : 'normal',
    reduceMotion: input.reduceMotion === true,
  };
}

const PreferencesContext = createContext<{
  preferences: Preferences;
  ready: boolean;
  storageWarning: string;
  save: (value: Preferences) => boolean;
} | null>(null);

export function StudyPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState('');

  useEffect(() => {
    function read() {
      try {
        const raw = localStorage.getItem(storageKey);
        setPreferences(raw ? normalize(JSON.parse(raw)) : { ...defaults });
        setStorageWarning('');
      } catch {
        setStorageWarning('Não foi possível ler as preferências salvas neste navegador.');
      }
      setReady(true);
    }
    read();
    function sync(event: StorageEvent) { if (event.key === storageKey || event.key === null) read(); }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--ws-accent', colors[preferences.accent]);
    document.documentElement.style.fontSize = sizes[preferences.textSize];
    document.documentElement.dataset.wsReduceMotion = String(preferences.reduceMotion);
  }, [preferences]);

  function save(value: Preferences) {
    const next = normalize(value);
    setPreferences(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setStorageWarning('');
      return true;
    } catch {
      setStorageWarning('As preferências foram aplicadas, mas não puderam ser salvas. Elas podem ser perdidas ao sair.');
      return false;
    }
  }

  return <PreferencesContext.Provider value={{ preferences, ready, storageWarning, save }}>{children}</PreferencesContext.Provider>;
}

export function useStudyPreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('Preferências precisam do StudyPreferencesProvider.');
  return context;
}
