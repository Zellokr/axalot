import type { AuditSource } from '../helpers/validators'

export const DEMO_ADMIN_ID = 'demo-admin'

export function resolveDemoActor(source: AuditSource) {
  return {
    actorId: DEMO_ADMIN_ID,
    source
  } as const
}
