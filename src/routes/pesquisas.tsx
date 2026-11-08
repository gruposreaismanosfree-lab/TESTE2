import { useState, type FormEvent } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';
import { PlatformLayout } from '@/components/PlatformLayout';
import { Button } from '@/components/ui/button';
import { buildResearchPrompt, depths, formats, researchDraftKey, type ResearchInput } from '@/lib/research';

export const Route = createRoute({ getParentRoute: () => rootRoute, path: '/pesquisas', component: ResearchPage });

function ResearchPage() {
  const [input, setInput] = useState<ResearchInput>({ topic: '', subject: '', depth: 'balanced', format: 'topics', notes: '' });
  const [prompt, setPrompt] = useState('');
  const [message, setMessage] = useState('');

  function update<K extends keyof ResearchInput>(key: K, value: ResearchInput[K]) {
    setInput(current => ({ ...current, [key]: value }));
    setPrompt('');
    setMessage('');
  }

  function prepare(event: FormEvent) {
    event.preventDefault();
    try { setPrompt(buildResearchPrompt(input)); setMessage('Instruções preparadas. Revise o texto antes de enviá-lo ao assistente.'); }
    catch (error) { setPrompt(''); setMessage(error instanceof Error ? error.message : 'Confira os campos da pesquisa.'); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(prompt); setMessage('Instruções copiadas.'); }
    catch { setMessage('Não foi possível copiar automaticamente. Selecione o texto das instruções e copie manualmente.'); }
  }

  function openAssistant() {
    if (!prompt.trim() || prompt.length > 12000) { setMessage('As instruções precisam ter entre 1 e 12.000 caracteres.'); return; }
    try { sessionStorage.setItem(researchDraftKey, prompt.trim()); window.location.assign('/#assistente'); }
    catch { setMessage('Não foi possível transferir o rascunho. Copie as instruções e cole no assistente.'); }
  }

  return <PlatformLayout active="research">
    <header className="mb-8 max-w-2xl"><p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-primary">02 / Laboratório de ideias</p><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Uma boa pesquisa começa<br /><span className="text-primary">com uma boa pergunta.</span></h1><p className="mt-4 leading-relaxed text-muted">Transforme seu tema em instruções claras para estudar, organizar tópicos ou desenvolver um texto.</p></header>
    <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_1fr]">
      <form onSubmit={prepare} className="ws-panel space-y-5">
        <div className="flex items-center gap-3 border-b border-border pb-4"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 font-mono text-sm text-primary">01</span><h2 className="text-lg font-semibold">Defina sua pesquisa</h2></div>
        <label className="block space-y-2 text-sm"><span>Tema</span><input className="ws-field" required maxLength={240} placeholder="Ex.: impactos da urbanização no clima" value={input.topic} onChange={event => update('topic', event.target.value)} /></label>
        <label className="block space-y-2 text-sm"><span>Matéria <span className="text-muted">· opcional</span></span><input className="ws-field" maxLength={80} placeholder="Ex.: Geografia" value={input.subject} onChange={event => update('subject', event.target.value)} /></label>
        <label className="block space-y-2 text-sm"><span>O que você quer produzir?</span><select className="ws-field" value={input.format} onChange={event => update('format', event.target.value as ResearchInput['format'])}>{Object.entries(formats).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <fieldset><legend className="mb-2 text-sm">Profundidade da explicação</legend><div className="grid gap-2 sm:grid-cols-3">{Object.keys(depths).map(value => <label key={value} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm transition-colors ${input.depth === value ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-background text-muted'}`}><input className="h-4 w-4 accent-primary" type="radio" name="depth" value={value} checked={input.depth === value} onChange={() => update('depth', value as ResearchInput['depth'])} />{value === 'brief' ? 'Essencial' : value === 'balanced' ? 'Equilibrada' : 'Profunda'}</label>)}</div></fieldset>
        <label className="block space-y-2 text-sm"><span>Material de apoio e orientações {input.format === 'conclusion' ? '· obrigatório' : '· opcional'}</span><textarea className="ws-field min-h-40 resize-y leading-relaxed" maxLength={6000} required={input.format === 'conclusion'} placeholder="Cole trechos do trabalho, resultados ou orientações do professor. Não inclua dados pessoais sensíveis." value={input.notes} onChange={event => update('notes', event.target.value)} /><span className="block text-right text-xs text-muted">{input.notes.length} / 6.000</span></label>
        <Button type="submit" className="w-full">Preparar instruções</Button>
      </form>
      <section className="ws-panel xl:sticky xl:top-6" aria-labelledby="research-result">
        <div className="mb-4 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 font-mono text-sm text-primary">02</span><h2 id="research-result" className="text-lg font-semibold">Roteiro para o assistente</h2></div>
        <p className="mb-5 text-sm leading-relaxed text-muted">Este planejador organiza suas instruções localmente. Ele não realiza buscas na internet nem gera uma resposta de IA.</p>
        {prompt ? <><label className="block space-y-2 text-sm"><span>Instruções editáveis</span><textarea className="ws-field min-h-80 resize-y leading-relaxed" value={prompt} maxLength={12000} onChange={event => { setPrompt(event.target.value); setMessage(''); }} /></label><div className="mt-4 flex flex-wrap gap-3"><Button type="button" disabled={!prompt.trim()} onClick={openAssistant}>Usar no assistente</Button><Button type="button" disabled={!prompt.trim()} className="border border-border bg-background text-foreground" onClick={() => void copy()}>Copiar</Button></div><p className="mt-4 text-xs leading-relaxed text-muted">O envio ao provedor só acontece após entrar na conta e confirmar a análise no assistente. O rascunho fica nesta aba até a análise ser concluída.</p></> : <div className="rounded-xl border border-dashed border-border bg-background p-6"><p className="font-mono text-xs text-primary">TEMA → ESTRUTURA → EXPLORAÇÃO</p><h3 className="mt-4 text-base font-semibold">Dê direção à sua curiosidade.</h3><p className="mt-2 text-sm leading-relaxed text-muted">Preencha o formulário e prepare um roteiro com o formato, a profundidade e o material de apoio da sua pesquisa.</p></div>}
        {message && <p role="status" className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed">{message}</p>}
      </section>
    </div>
  </PlatformLayout>;
}
