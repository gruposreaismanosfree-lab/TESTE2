import { createRootRoute, Outlet } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: () => <div className="min-h-screen bg-background text-foreground"><Outlet /></div>,
  notFoundComponent: () => <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6"><h1 className="text-2xl font-bold">Página não encontrada</h1><a href="/" className="text-primary underline">Voltar ao início</a></main>,
});
