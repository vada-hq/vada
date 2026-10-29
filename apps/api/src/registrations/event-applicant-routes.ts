import { eq } from 'drizzle-orm'
import { BulkApplicantsSchema, EventApplicantsQuerySchema } from '@vada/contracts'
import { authorize, councilIdOf } from '../access/authorize.js'
import { registrationForm } from '../db/schema.js'
import { eventRowOf } from '../events/queries.js'
import { clientIpOf } from '../http/client-ip.js'
import { logUnexpectedError } from '../http/on-error.js'
import { parseQuery } from '../http/query.js'
import { json } from '../http/validate.js'
import { bulkApplicants } from './bulk-applicants.js'
import { eventApplicantsOf } from './event-applicants.js'
import { purgeFormIfDue } from './purge.js'
import { eventIdOf, kitHelpers, root, type RouteKit } from './route-kit.js'

export function addEventApplicantRoutes(kit: RouteKit) {
  const { routes, auth, db, clock } = kit
  routes.get(`${root}/events/:eventId/applicants`, auth, async c => {
    const request = {
      userId: c.get('userId'),
      councilId: councilIdOf(c.req.param('councilId')),
      action: 'council.view' as const,
      now: clock(),
    }
    // 질의 값은 받지 않는다(모르는 키는 400). 거르기·쪽 넘김은 화면이 한다.
    parseQuery(EventApplicantsQuerySchema, c.req.queries())
    const eventId = eventIdOf(c)
    const forms = await db.transaction(async tx => {
      const actor = await authorize(tx, request)
      await eventRowOf(tx, actor, eventId)
      return tx
        .select({ id: registrationForm.id })
        .from(registrationForm)
        .where(eq(registrationForm.eventId, eventId))
    })
    for (const form of forms) await purgeFormIfDue(db, request.councilId, form.id, request.now)
    const body = await db.transaction(async tx => {
      const actor = await authorize(tx, request)
      return eventApplicantsOf(tx, actor, { eventId, now: request.now, ip: clientIpOf(c) })
    })
    return c.json(body)
  })
  addBulkRoutes(kit)
}

function addBulkRoutes(kit: RouteKit) {
  const { routes, auth, db } = kit
  const { changing, limited } = kitHelpers(kit)
  for (const action of ['deposit', 'attendance', 'absence'] as const)
    routes.post(
      `${root}/events/:eventId/applicants/${action}`,
      json(BulkApplicantsSchema),
      auth,
      async c => {
        limited(c)
        const request = { ...changing(c), councilId: councilIdOf(c.req.param('councilId')) }
        const body = await bulkApplicants(
          db,
          request,
          {
            eventId: eventIdOf(c),
            registrationIds: c.req.valid('json').registrationIds,
            action,
            ip: clientIpOf(c),
          },
          error => logUnexpectedError(c, error instanceof Error ? error : new Error('BulkFailure')),
        )
        return c.json(body)
      },
    )
}
