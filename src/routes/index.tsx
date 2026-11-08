import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createRoute } from '@tanstack/react-router';
import type { Session } from '@supabase/supabase-js';
import { Route as rootRoute } from './__root';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export const Route = createRoute({ getParentRoute: () => rootRoute, path: '/', component: StudyPage });

type Result = { answer: string; saved: boolean; warning?: string };
const fieldClass = 'w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted';

function StudyPage() {
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
    if (!session || !supabase) return;
    let active = true;
    const user = session.user;
    void supabase.from('profiles').upsert({
      id: user.id,
      email: user.email ?? null,
      display_name: typeof user.user_metadata.display_name === 'string' ? user.user_metadata.display_name : null,
    }, { onConflict: 'id', ignoreDuplicates: true }).then(({ error }) => {
      if (active && error) setMessage('Sua sessão está ativa, mas não foi possível registrar o perfil. Verifique as permissões da tabela profiles.');
    });
    return () => { active = false; };
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
        if (!data.session) setMessage('Confira seu e-mail para confirmar o cadastro. O perfil será registrado após a confirmação e o login.');
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
      if (account.current === userId) setResult({ answer: data.answer, saved: data.saved === true, warning: typeof data.warning === 'string' ? data.warning : undefined });
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
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-8 sm:px-8 sm:py-12">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <a href="/" className="text-xl font-extrabold tracking-tight">WS STUDY <span className="text-primary">AI</span></a>
        {session && <div className="flex flex-wrap items-center gap-3"><a href="/admin" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm text-primary underline-offset-4 hover:underline">Administração</a><Button className="border border-border bg-card text-foreground" disabled={busy} onClick={() => void logout()}>Sair</Button></div>}
      </header>
      <section className="mb-8">
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">Seu espaço de estudo</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Entenda a questão, passo a passo.</h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted">Escreva uma dúvida ou cole o enunciado completo, incluindo as alternativas. Confira sempre o raciocínio apresentado.</p>
      </section>
      {!supabase ? <div role="alert" className="rounded-2xl border border-border bg-card p-6 leading-relaxed">Os valores públicos da conexão Supabase existente não foram encontrados nesta versão do projeto. A análise permanece desativada para evitar envios sem autenticação.</div> : loading ? <p role="status" className="rounded-2xl bg-card p-6 text-muted">Carregando sua sessão…</p> : !session ? (
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
      <footer className="mt-auto pt-12 text-center text-xs leading-relaxed text-muted">A IA pode cometer erros. Revise as respostas antes de utilizá-las.</footer>
    </main>
  );
}
