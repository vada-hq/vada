import { eq } from 'drizzle-orm'
import { BulkApplicantsSchema, EventApplicantsQuerySchema } from '@vada/contracts'
import { authorize, councilIdOf } from '../access/authorize.js'
import { registrationForm } from '../db/schema.js'
import { eventRowOf } from '../events/queries.js'
import { clientIpOf } from '../http/client-ip.js'
import { ApiError } from '../http/errors.js'
import { logUnexpectedError } from '../http/on-error.js'
import { parseQuery } from '../http/query.js'
import { json } from '../http/validate.js'
import { bulkApplicants } from './bulk-applicants.js'
import { eventApplicantsOf } from './event-applicants.js'
import { createListAccess } from './list-access.js'
import { purgeFormIfDue } from './purge.js'
import { eventIdOf, kitHelpers, root, type RouteKit } from './route-kit.js'

export function addEventApplicantRoutes(kit: RouteKit) {
  const { routes, auth, db, clock } = kit
  const accessOf = createListAccess()
  routes.get(`${root}/events/:eventId/applicants`, auth, async c => {
    const request = {
      userId: c.get('userId'),
      councilId: councilIdOf(c.req.param('councilId')),
      action: 'council.view' as const,
      now: clock(),
    }
    const query = parseQuery(EventApplicantsQuerySchema, c.req.queries())
    if (query.page > 1 && !query.accessToken) throw new ApiError('INVALID_INPUT')
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
      return eventApplicantsOf(tx, actor, {
        eventId,
        now: request.now,
        ip: clientIpOf(c),
        query,
        access: () =>
          accessOf({
            actor,
            eventId,
            now: request.now,
            token: query.accessToken,
            session: JSON.stringify([
              request.userId,
              c.req.header('cookie') ?? '',
              c.req.header('authorization') ?? '',
            ]),
          }),
      })
    })
    return c.json(body)
  })
  addBulkRoutes(kit)
}

function addBulkRoutes(kit: RouteKit) {
  const { routes, auth, db } = kit
  const { changing, limited } = kitHelpers(kit)
  for (const action of ['deposit', 'attendance'] as const)
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
