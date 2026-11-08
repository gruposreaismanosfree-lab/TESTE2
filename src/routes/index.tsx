import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createRoute } from '@tanstack/react-router';
import type { Session } from '@supabase/supabase-js';
import { Route as rootRoute } from './__root';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ExitShortcutSettings } from '@/components/ExitShortcut';
import { PlatformLayout } from '@/components/PlatformLayout';
import { useStudyPreferences } from '@/components/StudyPreferences';
import { researchDraftKey } from '@/lib/research';

export const Route = createRoute({ getParentRoute: () => rootRoute, path: '/', component: StudyPage });

type Result = { answer: string; saved: boolean; warning?: string };
const fieldClass = 'w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted';

function StudyPage() {
  const { preferences } = useStudyPreferences();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const account = useRef<string | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    let authEventReceived = false;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      authEventReceived = true;
      if (active) { setSession(next); setLoading(false); }
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || authEventReceived) return;
      setSession(data.session);
      setLoading(false);
      if (error) setMessage('Não foi possível recuperar sua sessão. Entre novamente.');
    }).catch(() => {
      if (active) { setLoading(false); setMessage('Falha ao recuperar a sessão. Atualize a página.'); }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    account.current = session?.user.id ?? null;
    setResult(null);
    setQuestion('');
    try {
      const draft = sessionStorage.getItem(researchDraftKey);
      if (draft && draft.length <= 12000) setQuestion(draft);
    } catch {
      setMessage('Não foi possível recuperar o rascunho de pesquisa desta aba. Você pode colar a pergunta no assistente.');
    }
  }, [session?.user.id]);

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    if (!supabase || pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() } } });
        if (error) throw error;
        if (!data.session) setMessage('Confira seu e-mail para confirmar o cadastro e depois entre na sua conta.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      setPassword('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível entrar. Tente novamente.');
    } finally { pending.current = false; setBusy(false); }
  }

  async function analyze(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !session || pending.current || !question.trim()) return;
    const userId = session.user.id;
    pending.current = true;
    setBusy(true);
    setMessage('');
    setResult(null);
    try {
      const { data: current, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !current.session || current.session.user.id !== userId) {
        throw new Error('Sua sessão não está mais ativa. Entre novamente para analisar.');
      }
      let accessToken = current.session.access_token;
      if ((current.session.expires_at ?? 0) * 1000 <= Date.now() + 60000) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshed.session || refreshed.session.user.id !== userId) {
          throw new Error('Não foi possível renovar sua sessão. Entre novamente para analisar.');
        }
        accessToken = refreshed.session.access_token;
      }
      if (account.current !== userId) return;
      const { data, error } = await supabase.functions.invoke('study-ai', {
        body: { question: question.trim() },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) {
        let detail = 'Não foi possível conectar ao serviço de análise. Verifique sua conexão e tente novamente.';
        if (error.context instanceof Response) {
          const response = error.context;
          const body = await response.json().catch(() => null);
          if (typeof body?.error === 'string' && body.error.trim()) {
            detail = body.error;
          } else if (response.status === 401) {
            detail = 'Sua sessão não foi aceita pelo serviço. Entre novamente para analisar.';
          } else if (response.status === 403) {
            detail = 'O serviço não autorizou esta análise para sua conta.';
          } else if (response.status === 429) {
            detail = 'O serviço informou um limite de uso. Aguarde antes de tentar novamente.';
          } else if (response.status === 504) {
            detail = 'A análise excedeu o tempo de espera. Aguarde antes de tentar novamente.';
          } else {
            detail = `O serviço de análise retornou uma falha (HTTP ${response.status}). Tente novamente mais tarde.`;
          }
          if (typeof body?.request_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.request_id)) {
            detail += ` Referência: ${body.request_id}.`;
          }
        }
        throw new Error(detail);
      }
      if (typeof data?.error === 'string') throw new Error(data.error);
      if (!data || typeof data.answer !== 'string' || !data.answer.trim()) throw new Error('O serviço retornou uma resposta vazia. Tente novamente mais tarde.');
      if (account.current === userId) {
        setResult({ answer: data.answer, saved: data.saved === true, warning: typeof data.warning === 'string' ? data.warning : undefined });
        try { sessionStorage.removeItem(researchDraftKey); } catch { /* A resposta continua disponível mesmo sem acesso ao armazenamento local. */ }
      }
    } catch (error) {
      if (account.current === userId) setMessage(error instanceof Error ? error.message : 'Falha na análise. Tente novamente.');
    } finally { pending.current = false; setBusy(false); }
  }

  async function logout() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    setMessage(error ? 'Não foi possível sair. Tente novamente.' : '');
  }

  return (
    <PlatformLayout active="home">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{preferences.name ? `Olá, ${preferences.name}. Vamos explorar uma ideia?` : 'Seu próximo aprendizado começa aqui.'}</p>
        {session && <Button className="border border-border bg-card text-foreground" disabled={busy} onClick={() => void logout()}>Sair da conta</Button>}
      </div>
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-primary/25 bg-card p-6 sm:p-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_200px]">
          <div>
            <p className="mb-5 font-mono text-xs uppercase tracking-[0.2em] text-primary">Inteligência que acompanha sua curiosidade</p>
            <h1 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Menos dúvidas.<br /><span className="text-primary">Mais possibilidades.</span></h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted sm:text-base">Seu espaço para investigar assuntos, organizar pesquisas e entender cada etapa de uma questão. Estudar é mais do que encontrar uma resposta.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#assistente" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background transition-colors hover:bg-primary/90">Abrir assistente <span aria-hidden="true" className="ml-4">↗</span></a>
              <a href="/pesquisas" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-background/50 px-5 py-3 text-sm font-medium transition-colors hover:border-primary/50">Planejar uma pesquisa</a>
            </div>
          </div>
          <div aria-hidden="true" className="hidden aspect-square items-center justify-center rounded-full border border-primary/20 bg-background/40 p-5 lg:flex"><div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-dashed border-primary/40"><span className="font-mono text-5xl font-black text-primary">W.</span><span className="mt-3 font-mono text-[9px] tracking-[0.25em] text-muted">STUDY CORE</span></div></div>
        </div>
      </section>
      <section aria-label="Estado do espaço de estudo" className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card/90 p-4"><p className="font-mono text-[10px] uppercase tracking-widest text-muted">Conta</p><p className="mt-2 text-sm font-semibold">{loading ? 'Verificando sessão…' : session ? 'Sessão autenticada' : 'Sem sessão iniciada'}</p></div>
        <div className="rounded-2xl border border-border bg-card/90 p-4"><p className="font-mono text-[10px] uppercase tracking-widest text-muted">Assistente</p><p className="mt-2 text-sm font-semibold">{supabase ? 'Análise por texto' : 'Aguardando ativação'}</p></div>
        <div className="rounded-2xl border border-border bg-card/90 p-4"><p className="font-mono text-[10px] uppercase tracking-widest text-muted">Utilização diária</p><p className="mt-2 text-sm font-semibold">Contagem ainda indisponível</p></div>
      </section>
      <section id="assistente" aria-labelledby="assistant-heading" className="mb-5 scroll-mt-40">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-primary">01 / Assistente de estudos</p>
        <h2 id="assistant-heading" className="text-2xl font-bold tracking-tight">Entenda o porquê. Não só a resposta.</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">Inclua o enunciado completo e as alternativas. Anexos e conversas com contexto serão adicionados nas próximas etapas.</p>
      </section>
      {!supabase ? <div role="status" className="rounded-2xl border border-border bg-card p-6 leading-relaxed"><h2 className="mb-2 text-lg font-semibold text-foreground">O assistente ainda não está ativo</h2><p className="text-sm text-muted">Login e respostas por IA dependem da ativação dos serviços da plataforma. Enquanto isso, você já pode organizar suas pesquisas e personalizar seu espaço. Nenhuma pergunta é enviada enquanto o serviço não está configurado.</p>{question && <div className="mt-4"><p className="mb-2 text-sm font-semibold text-primary">Seu rascunho de pesquisa está nesta aba</p><textarea aria-label="Rascunho de pesquisa" readOnly value={question} className={`${fieldClass} min-h-48 text-sm`} /></div>}<a href="/pesquisas" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4">Abrir planejador de pesquisas</a></div> : loading ? <p role="status" className="rounded-2xl bg-card p-6 text-muted">Carregando sua sessão…</p> : !session ? (
        <form onSubmit={authenticate} className="mx-auto w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">{signup ? 'Crie sua conta' : 'Entre para estudar'}</h2>
          {signup && <label className="block space-y-2 text-sm"><span>Nome</span><input className={fieldClass} autoComplete="name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>}
          <label className="block space-y-2 text-sm"><span>E-mail</span><input className={fieldClass} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label className="block space-y-2 text-sm"><span>Senha</span><input className={fieldClass} type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 8 : undefined} required value={password} onChange={e => setPassword(e.target.value)} /></label>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Aguarde…' : signup ? 'Cadastrar' : 'Entrar'}</Button>
          <button type="button" className="min-h-11 w-full rounded-lg text-sm text-primary underline underline-offset-4 disabled:opacity-50" disabled={busy} onClick={() => { setSignup(!signup); setMessage(''); }}>{signup ? 'Já tenho uma conta' : 'Criar uma conta'}</button>
        </form>
      ) : (
        <form onSubmit={analyze} className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-7">
          <label htmlFor="question" className="block text-lg font-semibold">Qual é a sua dúvida?</label>
          <textarea id="question" className={`${fieldClass} min-h-52 resize-y leading-relaxed`} required maxLength={12000} disabled={busy} placeholder="Cole aqui o enunciado completo…" value={question} onChange={e => setQuestion(e.target.value)} />
          <div className="flex flex-wrap items-center justify-between gap-4"><p className="text-xs text-muted">Até 12.000 caracteres · análise por texto</p><Button type="submit" disabled={busy || !question.trim()}>{busy ? 'Analisando…' : 'Analisar questão'}</Button></div>
          {busy && <p role="status" className="text-sm text-muted">A resposta pode levar até um minuto. Não é necessário enviar novamente.</p>}
        </form>
      )}
      {message && <div role="alert" className="mt-6 break-words rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm leading-relaxed text-amber-100">{message}</div>}
      {result && <section aria-live="polite" className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-7"><h2 className="mb-5 text-xl font-semibold text-primary">Explicação</h2><div className="whitespace-pre-wrap break-words leading-relaxed">{result.answer}</div><p className="mt-6 border-t border-border pt-4 text-sm text-muted">{result.saved ? 'Análise salva na sua conta.' : result.warning || 'Resposta recebida, mas não foi possível salvar a análise.'}</p></section>}
      {session && <ExitShortcutSettings />}
    </PlatformLayout>
  );
}
