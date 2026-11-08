import { createRouter } from '@tanstack/react-router';
import { Route as rootRoute } from '@/routes/__root';
import { Route as indexRoute } from '@/routes/index';

export const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]) });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
