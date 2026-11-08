import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { EXIT_SHORTCUT_METADATA_KEY, EXIT_SHORTCUT_REFRESH_MS, isEditingTarget, matchesExitShortcut, readExitShortcut, type ExitShortcutPreference } from '@/lib/exit-shortcut';

type ShortcutContextValue = {
  userId: string | null;
  preference: ExitShortcutPreference;
  ready: boolean;
  saving: boolean;
  error: string;
  save: (preference: ExitShortcutPreference) => Promise<boolean>;
};

const ShortcutContext = createContext<ShortcutContextValue | null>(null);

export function ExitShortcutProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [preference, setPreference] = useState<ExitShortcutPreference>(() => readExitShortcut(null));
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [exitState, setExitState] = useState<'idle' | 'leaving' | 'closed' | 'error'>('idle');
  const currentAccount = useRef<string | null>(null);
  const version = useRef(0);
  const savingRef = useRef(false);
  const closingRef = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const client = supabase;
    if (!client) return () => { mounted.current = false; };
    let active = true;
    let authEventReceived = false;
    function receive(session: Session | null) {
      if (!active) return;
      const nextId = session?.user.id ?? null;
      if (currentAccount.current !== nextId) {
        version.current += 1;
        currentAccount.current = nextId;
        setUserId(nextId);
        setPreference(readExitShortcut(null));
        setReady(false);
        setError('');
      }
      setRevision(value => value + 1);
    }
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      authEventReceived = true;
      receive(session);
    });
    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active || authEventReceived) return;
      if (sessionError) setError('Não foi possível recuperar as configurações da conta.');
      receive(data.session);
    }).catch(() => {
      if (active && !authEventReceived) setError('Não foi possível recuperar as configurações da conta.');
    });
    return () => {
      active = false;
      mounted.current = false;
      version.current += 1;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client || !userId) return;
    let active = true;
    let fetching = false;
    async function refresh() {
      if (!client || !active || fetching || savingRef.current || closingRef.current || document.visibilityState === 'hidden') return;
      fetching = true;
      const requestVersion = ++version.current;
      try {
        const { data, error: authError } = await client.auth.getUser();
        if (!active || requestVersion !== version.current || currentAccount.current !== userId) return;
        if (authError || data.user?.id !== userId) throw new Error('Conta indisponível');
        setPreference(readExitShortcut(data.user.user_metadata[EXIT_SHORTCUT_METADATA_KEY]));
        setReady(true);
        setError('');
      } catch {
        if (active && requestVersion === version.current && currentAccount.current === userId) {
          setReady(false);
          setError('Não foi possível confirmar o atalho salvo. Ele permanece desativado até a conexão ser recuperada.');
        }
      } finally { fetching = false; }
    }
    const refreshVisible = () => { void refresh(); };
    void refresh();
    window.addEventListener('focus', refreshVisible);
    window.addEventListener('online', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    const timer = window.setInterval(refreshVisible, EXIT_SHORTCUT_REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshVisible);
      window.removeEventListener('online', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [userId, revision]);

  async function save(next: ExitShortcutPreference): Promise<boolean> {
    const client = supabase;
    const owner = currentAccount.current;
    if (!client || !owner || savingRef.current || closingRef.current) return false;
    savingRef.current = true;
    version.current += 1;
    setSaving(true);
    setError('');
    try {
      const { data: verified, error: verifyError } = await client.auth.getUser();
      if (verifyError || verified.user?.id !== owner || currentAccount.current !== owner) throw new Error('Sessão alterada');
      const normalized = readExitShortcut(next);
      // O Auth mescla esta chave com os demais metadados: nome e outras preferências são preservados.
      const { data, error: saveError } = await client.auth.updateUser({
        data: { [EXIT_SHORTCUT_METADATA_KEY]: normalized },
      });
      if (saveError || data.user?.id !== owner) throw new Error('Gravação não confirmada');
      if (!mounted.current || currentAccount.current !== owner) return false;
      const persisted = readExitShortcut(data.user.user_metadata[EXIT_SHORTCUT_METADATA_KEY]);
      if (persisted.enabled !== normalized.enabled || persisted.key !== normalized.key) throw new Error('Preferência não confirmada');
      setPreference(persisted);
      setReady(true);
      return true;
    } catch {
      if (mounted.current && currentAccount.current === owner) setError('Não foi possível salvar o atalho na sua conta. Verifique sua conexão e tente novamente.');
      return false;
    } finally {
      savingRef.current = false;
      if (mounted.current) {
        setSaving(false);
        setRevision(value => value + 1);
      }
    }
  }

  const leave = useCallback(async () => {
    const client = supabase;
    if (!client || closingRef.current || savingRef.current || !currentAccount.current) return;
    closingRef.current = true;
    setExitState('leaving');
    try {
      // Encerra apenas esta sessão; outros dispositivos continuam conectados.
      const { error: logoutError } = await client.auth.signOut({ scope: 'local' });
      if (logoutError) throw logoutError;
      if (!mounted.current) return;
      try { window.close(); } catch { /* O navegador pode impedir o fechamento. */ }
      setExitState('closed');
    } catch {
      if (mounted.current) setExitState('error');
    } finally { closingRef.current = false; }
  }, []);

  useEffect(() => {
    if (!userId || !ready || !preference.enabled || exitState !== 'idle') return;
    function onKeyDown(event: KeyboardEvent) {
      const editing = event.composedPath().some(isEditingTarget) || isEditingTarget(document.activeElement);
      if (savingRef.current || !matchesExitShortcut(event, preference, editing)) return;
      event.preventDefault();
      void leave();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [userId, ready, preference.enabled, preference.key, exitState, leave]);

  return (
    <ShortcutContext.Provider value={{ userId, preference, ready, saving, error, save }}>
      {exitState === 'idle' ? children : (
        <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
          <section aria-live="polite" className="w-full max-w-lg space-y-5 rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
            <p className="font-mono text-sm uppercase tracking-widest text-primary">WS STUDY AI · Saída</p>
            <h1 className="text-2xl font-bold">{exitState === 'leaving' ? 'Encerrando sua sessão…' : exitState === 'closed' ? 'Sessão encerrada' : 'Não foi possível encerrar a sessão'}</h1>
            <p className="text-sm leading-relaxed text-muted">{exitState === 'leaving' ? 'Aguarde a confirmação antes de fechar a aba.' : exitState === 'closed' ? 'Se esta janela continua aberta, o navegador não permitiu fechá-la automaticamente. Você pode fechar a aba manualmente com segurança.' : 'Sua saída não foi confirmada. Verifique a conexão e tente novamente antes de deixar este dispositivo.'}</p>
            {exitState === 'error' && <Button onClick={() => void leave()}>Tentar sair novamente</Button>}
            {exitState !== 'leaving' && <Button className="w-full border border-border bg-background text-foreground" onClick={() => setExitState('idle')}>Voltar ao site</Button>}
          </section>
        </main>
      )}
    </ShortcutContext.Provider>
  );
}

export function ExitShortcutSettings() {
  const context = useContext(ShortcutContext);
  if (!context) throw new Error('Configurações de saída exigem o provedor de preferências.');
  return context.userId ? <ShortcutForm key={context.userId} context={context} /> : null;
}

function ShortcutForm({ context }: { context: ShortcutContextValue }) {
  const { preference, ready, saving, error, save } = context;
  const [draft, setDraft] = useState(preference);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (!dirty) setDraft(preference);
  }, [preference.enabled, preference.key, dirty]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (await save(draft)) {
      if (!active.current) return;
      setDirty(false);
      setMessage('Atalho salvo na sua conta. Outros dispositivos recuperam a preferência ao abrir ou retornar ao site.');
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-7">
      <h2 className="text-xl font-semibold text-primary">Configurações do perfil</h2>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <fieldset disabled={!ready || saving} className="space-y-4 disabled:opacity-60">
          <legend className="mb-3 text-lg font-semibold">Atalho de saída</legend>
          <p className="text-sm leading-relaxed text-muted">Encerra a sessão neste dispositivo e tenta fechar a janela. Campos de texto, formulários e editores não acionam o atalho.</p>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={draft.enabled} onChange={event => { setDraft(value => ({ ...value, enabled: event.target.checked })); setDirty(true); setMessage(''); }} className="h-4 w-4 accent-primary" />Ativar atalho de saída</label>
          <label className="block max-w-xs space-y-2 text-sm"><span>Tecla de saída</span><select value={draft.key} onChange={event => { setDraft(value => ({ ...value, key: event.target.value === 'F9' ? 'F9' : 'F8' })); setDirty(true); setMessage(''); }} className="min-h-11 w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><option value="F8">F8</option><option value="F9">F9</option></select></label>
          <Button type="submit" disabled={!dirty || saving}>{saving ? 'Salvando…' : 'Salvar atalho'}</Button>
        </fieldset>
        <p className="text-xs leading-relaxed text-muted">{ready ? `Preferência salva: ${preference.enabled ? preference.key : 'desativado'}. ` : 'Confirmando a preferência salva. '}Use a tecla sozinha, sem Ctrl, Alt, Shift ou Command. O navegador ou sistema pode reservar essas teclas; nesse caso, utilize o botão Sair. Perguntas ainda não enviadas não são salvas ao sair.</p>
        {dirty && <p className="text-xs text-muted">Há alterações ainda não salvas. Até salvar, permanece valendo a preferência da conta.</p>}
        {error && <p role="alert" className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">{error}</p>}
        {message && !error && <p role="status" className="text-sm text-primary">{message}</p>}
      </form>
    </section>
  );
}
