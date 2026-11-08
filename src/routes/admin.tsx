import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createRoute } from '@tanstack/react-router';
import type { Session } from '@supabase/supabase-js';
import { Route as rootRoute } from './__root';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export const Route = createRoute({ getParentRoute: () => rootRoute, path: '/admin', component: AdminPage });

const fieldClass = 'w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted';
const panelClass = 'rounded-2xl border border-border bg-card p-5 sm:p-6';
type Account = { id: string; email: string | null; display_name: string | null; created_at: string; daily_limit: number | null; blocked: boolean; used_today: number };
type ErrorEntry = { id: string; created_at: string; context: string; message: string; code: string | null; request_id: string | null; user_id: string | null };
type AuditEntry = { id: string; created_at: string; action: string; actor_id: string | null; target_id: string | null; details: unknown };
type Dashboard = {
  settings: { default_daily_limit: number; updated_at: string } | null;
  users: Account[];
  total_users: number;
  usage_today: number;
  errors: ErrorEntry[];
  audit: AuditEntry[];
};

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR');
}

function readLimit(form: HTMLFormElement) {
  const value = String(new FormData(form).get('daily_limit') ?? '').trim();
  const limit = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(limit) || limit < 0 || limit > 2147483647) {
    throw new Error('Informe um limite inteiro entre 0 e 2.147.483.647.');
  }
  return limit;
}

function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    let received = false;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      received = true;
      if (active) { setSession(next); setLoading(false); }
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || received) return;
      setSession(data.session);
      setLoading(false);
      if (error) setMessage('Não foi possível recuperar sua sessão. Entre novamente.');
    }).catch(() => {
      if (active && !received) { setLoading(false); setMessage('Falha ao recuperar sua sessão. Atualize a página.'); }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  async function logout() {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setMessage('');
    } catch { setMessage('Não foi possível sair. Tente novamente.'); }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 bg-background px-4 py-8 text-foreground sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div><a href="/" className="text-sm text-primary hover:underline">Voltar aos estudos</a><h1 className="mt-2 text-3xl font-bold tracking-tight">Administração</h1></div>
        {session && <Button className="border border-border bg-card text-foreground" onClick={() => void logout()}>Sair</Button>}
      </header>
      {message && <p role="alert" className={`${panelClass} text-amber-100`}>{message}</p>}
      {!supabase ? <p role="alert" className={panelClass}>A conexão existente não está disponível nesta versão da aplicação.</p> : loading ? <p role="status" className={`${panelClass} text-muted`}>Verificando sua sessão…</p> : !session ? (
        <section className={`${panelClass} flex flex-col items-center gap-4 py-12 text-center`}><h2 className="text-xl font-semibold">Entre com sua conta administrativa</h2><p className="max-w-lg text-muted">O painel exige uma conta com o papel admin. Uma conta comum não tem acesso aos dados administrativos.</p><a href="/" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 py-3 font-semibold text-background">Ir para o login</a></section>
      ) : <AdminPanel key={session.user.id} />}
    </main>
  );
}

function AdminPanel() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const saving = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    setLoading(true);
    setLoadError('');
    setDashboard(null);
    void (async () => {
      try {
        const { data, error } = await client.rpc('ws_admin_dashboard', { p_page: page, p_search: filter });
        if (error) throw error;
        if (!data || !Array.isArray(data.users) || !Array.isArray(data.errors) || !Array.isArray(data.audit)) throw new Error('O painel recebeu dados inválidos.');
        if (active) setDashboard(data as Dashboard);
      } catch (error) {
        if (!active) return;
        const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
        setLoadError(code === '42501' ? 'Acesso negado. Sua conta não possui o papel admin.' : code === 'PGRST202' || code === '42883' ? 'As operações administrativas ainda não foram publicadas no banco. Aplique a migração do painel.' : 'Não foi possível carregar o painel. Verifique sua sessão e tente atualizar.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [page, filter, revision]);

  async function save(operation: 'ws_admin_set_default_limit' | 'ws_admin_set_user_limit', params: Record<string, unknown>) {
    if (!supabase || saving.current) return;
    saving.current = true;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.rpc(operation, params);
      if (error) throw error;
      if (mounted.current) { setMessage('Alteração salva e registrada na auditoria.'); setRevision(value => value + 1); }
    } catch (error) {
      if (mounted.current) {
        const detail = error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Tente novamente.';
        setMessage(`Não foi possível salvar. ${detail}`);
      }
    } finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function saveDefault(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const limit = readLimit(event.currentTarget);
      if (!window.confirm(`Definir o limite padrão como ${limit} usos por dia? Contas com limite individual não serão alteradas.`)) return;
      void save('ws_admin_set_default_limit', { p_daily_limit: limit });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Limite inválido.'); }
  }

  function saveUser(event: FormEvent<HTMLFormElement>, user: Account) {
    event.preventDefault();
    try {
      const form = event.currentTarget;
      const inherit = new FormData(form).get('inherit') === 'on';
      const limit = inherit ? null : readLimit(form);
      const blocked = new FormData(form).get('blocked') === 'on';
      if (!window.confirm(`Salvar as regras de ${user.email || user.display_name || user.id}? ${blocked ? 'O uso de IA ficará bloqueado.' : 'O uso de IA seguirá o limite escolhido.'}`)) return;
      void save('ws_admin_set_user_limit', { p_user_id: user.id, p_daily_limit: limit, p_blocked: blocked });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Limite inválido.'); }
  }

  return (
    <>
      <section className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-sm leading-relaxed text-muted">Controle de uso da aplicação. Os números abaixo não representam créditos ou saldo do provedor de IA. O dia de consumo é contado em UTC.</p>
        <Button disabled={busy || loading} onClick={() => setRevision(value => value + 1)}>Atualizar painel</Button>
      </section>
      {message && <p role="status" className={`${panelClass} break-words text-sm`}>{message}</p>}
      {loadError && <p role="alert" className={`${panelClass} text-amber-100`}>{loadError}</p>}
      {loading && <p role="status" className={`${panelClass} text-muted`}>Carregando dados administrativos…</p>}
      {dashboard && <>
        <section aria-label="Resumo" className="grid gap-4 sm:grid-cols-3">
          <div className={panelClass}><p className="text-sm text-muted">Perfis encontrados</p><p className="mt-2 text-3xl font-bold">{dashboard.total_users}</p></div>
          <div className={panelClass}><p className="text-sm text-muted">Eventos de uso hoje · todas as contas</p><p className="mt-2 text-3xl font-bold">{dashboard.usage_today}</p></div>
          <div className={panelClass}><p className="text-sm text-muted">Limite padrão diário</p><p className="mt-2 text-3xl font-bold">{dashboard.settings?.default_daily_limit ?? 'Não definido'}</p></div>
        </section>
        <section className={panelClass}>
          <h2 className="text-xl font-semibold">Limite padrão</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">Aplica-se somente a contas sem limite individual. Zero impede novas análises. Salvar não apaga o consumo já registrado.</p>
          <form onSubmit={saveDefault} className="mt-4 flex flex-wrap items-end gap-4">
            <label className="block w-full space-y-2 text-sm sm:w-64"><span>Usos por dia</span><input name="daily_limit" type="number" min="0" max="2147483647" step="1" required disabled={busy} defaultValue={dashboard.settings?.default_daily_limit ?? ''} className={fieldClass} /></label>
            <Button type="submit" disabled={busy}>{busy ? 'Aguarde…' : 'Salvar limite padrão'}</Button>
          </form>
        </section>
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-xl font-semibold">Usuários e limites</h2><span className="text-sm text-muted">Página {page + 1} de {Math.max(1, Math.ceil(dashboard.total_users / 20))}</span></div>
          <form onSubmit={event => { event.preventDefault(); setPage(0); setFilter(search.trim()); }} className="flex flex-col gap-3 sm:flex-row">
            <label className="flex-1"><span className="sr-only">Buscar por nome, e-mail ou ID</span><input maxLength={120} value={search} onChange={event => setSearch(event.target.value)} disabled={busy} placeholder="Buscar por nome, e-mail ou ID" className={fieldClass} /></label>
            <Button type="submit" disabled={busy}>Buscar</Button>
          </form>
          {!dashboard.users.length && <p className={`${panelClass} text-muted`}>Nenhum perfil encontrado para esta busca.</p>}
          <div className="grid gap-4 lg:grid-cols-2">
            {dashboard.users.map(user => <article key={user.id} className={panelClass}>
              <h3 className="break-words text-lg font-semibold">{user.display_name || 'Sem nome informado'}</h3>
              <p className="mt-1 break-words text-sm text-muted">{user.email || 'Sem e-mail no perfil'}</p>
              <p className="mt-2 break-all text-xs text-muted">ID: {user.id}</p>
              <p className="mt-3 text-sm">Hoje: {user.used_today} usos · {user.blocked ? 'IA bloqueada' : 'IA não bloqueada'} · Limite efetivo: {user.daily_limit ?? dashboard.settings?.default_daily_limit ?? 'indisponível'}</p>
              <form onSubmit={event => saveUser(event, user)} className="mt-4 space-y-4">
                <label className="block space-y-2 text-sm"><span>Limite individual diário</span><input name="daily_limit" type="number" min="0" max="2147483647" step="1" disabled={busy} defaultValue={user.daily_limit ?? dashboard.settings?.default_daily_limit ?? ''} className={fieldClass} /></label>
                <label className="flex min-h-11 items-center gap-3 text-sm"><input name="inherit" type="checkbox" disabled={busy} defaultChecked={user.daily_limit === null} className="h-4 w-4 accent-primary" />Usar limite padrão (ignora o campo acima)</label>
                <label className="flex min-h-11 items-center gap-3 text-sm"><input name="blocked" type="checkbox" disabled={busy} defaultChecked={user.blocked} className="h-4 w-4 accent-primary" />Bloquear uso da IA</label>
                <Button type="submit" disabled={busy} className="w-full">Salvar regras da conta</Button>
              </form>
            </article>)}
          </div>
          <div className="flex justify-between gap-3"><Button disabled={busy || page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}>Anterior</Button><Button disabled={busy || (page + 1) * 20 >= dashboard.total_users} onClick={() => setPage(value => value + 1)}>Próxima</Button></div>
        </section>
        <section className={panelClass}>
          <h2 className="text-xl font-semibold">Últimos erros registrados</h2>
          <p className="mt-2 text-sm text-muted">Até 20 registros. A ausência de erros não comprova que o provedor de IA esteja funcionando.</p>
          <div className="mt-4 space-y-4">{dashboard.errors.length ? dashboard.errors.map(entry => <article key={entry.id} className="rounded-xl border border-border bg-background p-4">
            <p className="break-words text-sm font-semibold">{entry.context} · {entry.code || 'Sem código'}</p><p className="mt-1 text-xs text-muted">{dateLabel(entry.created_at)}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm">{entry.message}</p><p className="mt-3 break-all text-xs text-muted">Conta: {entry.user_id || 'Não informada'} · Solicitação: {entry.request_id || 'Não informada'}</p>
          </article>) : <p className="text-sm text-muted">Nenhum erro registrado.</p>}</div>
        </section>
        <section className={panelClass}>
          <h2 className="text-xl font-semibold">Auditoria administrativa</h2>
          <p className="mt-2 text-sm text-muted">Últimas 20 ações. Toda alteração de limite ou bloqueio feita por este painel registra responsável, alvo e valores anteriores e novos.</p>
          <div className="mt-4 space-y-4">{dashboard.audit.length ? dashboard.audit.map(entry => <article key={entry.id} className="rounded-xl border border-border bg-background p-4">
            <p className="break-words text-sm font-semibold">{entry.action}</p><p className="mt-1 text-xs text-muted">{dateLabel(entry.created_at)}</p><p className="mt-2 break-all text-xs text-muted">Responsável: {entry.actor_id || 'Não informado'} · Alvo: {entry.target_id || 'Configuração geral'}</p><details className="mt-3 text-sm"><summary className="min-h-8 cursor-pointer text-primary">Ver detalhes</summary><pre className="mt-2 whitespace-pre-wrap break-all rounded-lg bg-card p-3 text-xs">{JSON.stringify(entry.details, null, 2)}</pre></details>
          </article>) : <p className="text-sm text-muted">Nenhuma ação registrada.</p>}</div>
        </section>
      </>}
    </>
  );
}
