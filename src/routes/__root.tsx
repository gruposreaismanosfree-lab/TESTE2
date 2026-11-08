import { createRootRoute, Outlet } from '@tanstack/react-router';
import { ExitShortcutProvider } from '@/components/ExitShortcut';

export const Route = createRootRoute({
  component: () => <ExitShortcutProvider><div className="min-h-screen bg-background text-foreground"><Outlet /></div></ExitShortcutProvider>,
  notFoundComponent: () => <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6"><h1 className="text-2xl font-bold">Página não encontrada</h1><a href="/" className="text-primary underline">Voltar ao início</a></main>,
});
