import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';

type Area = 'home' | 'research' | 'profile';
const navigation = [
  { id: 'home', to: '/', label: 'Início / IA', path: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z' },
  { id: 'research', to: '/pesquisas', label: 'Pesquisas', path: 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm6-2 6 6' },
  { id: 'profile', to: '/perfil', label: 'Perfil', path: 'M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 22v-3a8 8 0 0 1 16 0v3' },
] as const;

export function PlatformLayout({ active, children }: { active: Area; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground md:flex">
      <a href="#conteudo" className="sr-only z-50 rounded-xl bg-primary px-4 py-3 text-background focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Pular para o conteúdo</a>
      <aside className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-4 md:px-6 md:py-8">
          <Link to="/" aria-label="WS Study AI, início" className="flex items-center gap-3 rounded-lg">
            <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 font-mono text-lg font-black text-primary">W.</span>
            <span className="text-sm font-extrabold tracking-wider">WS STUDY <span className="text-primary">AI</span><span className="mt-1 hidden font-mono text-[10px] font-normal tracking-[0.2em] text-muted md:block">LEARNING WORKSPACE</span></span>
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted md:hidden">Estude melhor</span>
        </div>
        <div className="px-3 pb-3 md:px-4">
          <p className="mb-3 hidden px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted md:block">Seu espaço</p>
          <nav aria-label="Navegação principal" className="grid grid-cols-3 gap-1 md:grid-cols-1 md:gap-2">
            {navigation.map(item => <Link key={item.id} to={item.to} aria-current={active === item.id ? 'page' : undefined} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs font-medium transition-colors md:justify-start md:px-3 md:text-sm ${active === item.id ? 'border-primary/30 bg-primary/10 text-primary' : 'border-transparent text-muted hover:bg-card hover:text-foreground'}`}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0"><path d={item.path} /></svg>{item.label}
            </Link>)}
          </nav>
        </div>
        <div className="absolute bottom-6 left-5 right-5 hidden rounded-xl border border-border bg-card p-4 md:block">
          <p className="font-mono text-xs text-primary">APRENDA. QUESTIONE. EVOLUA.</p>
          <p className="mt-3 text-xs leading-relaxed text-muted">Tecnologia para explorar ideias. Pensamento crítico para ir além.</p>
        </div>
      </aside>
      <div className="ws-grid min-w-0 flex-1">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border/60 px-4 sm:px-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Workspace <span className="mx-2 text-primary">/</span> {active === 'home' ? 'Estudos' : active === 'research' ? 'Pesquisas' : 'Preferências'}</p>
          <Link to="/perfil" className="flex min-h-11 items-center rounded-lg px-2 text-xs text-muted transition-colors hover:text-primary">Personalizar</Link>
        </header>
        <main id="conteudo" tabIndex={-1} className="ws-enter mx-auto w-full max-w-6xl px-4 py-6 outline-none sm:px-8 sm:py-10">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 pt-6 text-xs leading-relaxed text-muted sm:px-8"><div className="flex flex-wrap justify-between gap-3 border-t border-border pt-5"><span className="font-mono tracking-wider">WS STUDY AI</span><span>A IA pode cometer erros. Confira fontes, cálculos e conclusões.</span></div></footer>
      </div>
    </div>
  );
}
