import type { Services } from '@/services/container';
import { routes } from '@/lib/routes';

/** Opens the session and decides where to land: face enrolment first when face verification needs it. */
export async function finishLogin(services: Services, instituteId: string, staffId: string): Promise<string> {
  await services.auth.startSession(instituteId, staffId);
  const ctx = await services.session.load();
  if (!ctx) return routes.login;
  return ctx.journey.faceEnrolmentRequired ? routes.face(routes.home) : routes.home;
}
