import { createRouter } from '@tanstack/react-router';
import { Route as rootRoute } from '@/routes/__root';
import { Route as indexRoute } from '@/routes/index';
import { Route as adminRoute } from '@/routes/admin';
import { Route as researchRoute } from '@/routes/pesquisas';
import { Route as profileRoute } from '@/routes/perfil';

export const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute, adminRoute, researchRoute, profileRoute]) });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
