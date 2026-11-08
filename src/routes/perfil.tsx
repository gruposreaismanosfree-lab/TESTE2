import { useEffect, useState, type FormEvent } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';
import { PlatformLayout } from '@/components/PlatformLayout';
import { useStudyPreferences } from '@/components/StudyPreferences';
import { Button } from '@/components/ui/button';

export const Route = createRoute({ getParentRoute: () => rootRoute, path: '/perfil', component: ProfilePage });

function ProfilePage() {
  const { preferences, ready, storageWarning, save } = useStudyPreferences();
  const [draft, setDraft] = useState(preferences);
  const [message, setMessage] = useState('');
  useEffect(() => { setDraft(preferences); }, [preferences]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const saved = save(draft);
    setMessage(saved ? 'Preferências salvas neste navegador.' : 'Preferências aplicadas apenas nesta visita.');
  }

  return <PlatformLayout active="profile">
    <header className="mb-8 max-w-2xl"><p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-primary">03 / Seu espaço, seu ritmo</p><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Feito para o seu<br /><span className="text-primary">jeito de estudar.</span></h1><p className="mt-4 leading-relaxed text-muted">Ajuste a aparência e a leitura. Estas preferências pertencem a este navegador, não a uma conta, e não são sincronizadas entre dispositivos.</p></header>
    <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
      <form onSubmit={submit} className="ws-panel space-y-6">
        <h2 className="border-b border-border pb-4 text-lg font-semibold">Preferências do espaço</h2>
        <fieldset disabled={!ready} className="space-y-6 disabled:opacity-50">
          <label className="block space-y-2 text-sm"><span>Como quer ser chamado?</span><input autoComplete="nickname" maxLength={80} placeholder="Seu nome de exibição" className="ws-field" value={draft.name} onChange={event => setDraft(value => ({ ...value, name: event.target.value }))} /><span className="block text-xs leading-relaxed text-muted">Usado na saudação inicial. Não altera seu cadastro.</span></label>
          <fieldset><legend className="mb-3 text-sm">Cor de destaque</legend><div className="grid gap-3 sm:grid-cols-3">{(['magenta', 'violet', 'cyan'] as const).map(color => <label key={color} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border bg-background p-3 text-sm ${draft.accent === color ? 'border-primary' : 'border-border'}`}><input type="radio" name="accent" checked={draft.accent === color} onChange={() => setDraft(value => ({ ...value, accent: color }))} className="h-4 w-4 accent-primary" /><span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-full ${color === 'magenta' ? 'bg-pink-400' : color === 'violet' ? 'bg-violet-300' : 'bg-cyan-300'}`} />{color === 'magenta' ? 'Magenta' : color === 'violet' ? 'Violeta' : 'Ciano'}</label>)}</div></fieldset>
          <label className="block space-y-2 text-sm"><span>Tamanho do texto</span><select className="ws-field" value={draft.textSize} onChange={event => setDraft(value => ({ ...value, textSize: event.target.value as typeof draft.textSize }))}><option value="normal">Padrão</option><option value="large">Grande</option><option value="extra">Extra grande</option></select></label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4"><input className="mt-1 h-4 w-4 shrink-0 accent-primary" type="checkbox" checked={draft.reduceMotion} onChange={event => setDraft(value => ({ ...value, reduceMotion: event.target.checked }))} /><span className="text-sm"><span className="block font-semibold">Reduzir animações</span><span className="mt-1 block leading-relaxed text-muted">Desative movimentos e transições. A preferência de acessibilidade do dispositivo também é respeitada.</span></span></label>
          <Button type="submit" className="w-full">Salvar preferências</Button>
        </fieldset>
        {!ready && <p role="status" className="text-sm text-muted">Carregando preferências…</p>}
        {message && <p role="status" className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">{message}</p>}
        {storageWarning && <p role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm text-amber-100">{storageWarning}</p>}
      </form>
      <aside className="space-y-4">
        <section className="ws-panel"><p className="font-mono text-xs uppercase tracking-widest text-primary">Privacidade por padrão</p><h2 className="mt-3 text-lg font-semibold">Personalização sem credenciais</h2><p className="mt-3 text-sm leading-relaxed text-muted">A aparência é salva localmente. Nenhuma senha ou chave de IA é armazenada por estas preferências. Em um dispositivo compartilhado, outras pessoas podem ver seu nome de exibição.</p></section>
        <section className="ws-panel"><h2 className="text-lg font-semibold">Conta e saída rápida</h2><p className="mt-3 text-sm leading-relaxed text-muted">Login, cadastro e o atalho F8/F9 permanecem no assistente. As opções do atalho aparecem após a autenticação.</p><a href="/#assistente" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4">Ir para conta e assistente</a></section>
      </aside>
    </div>
  </PlatformLayout>;
}
