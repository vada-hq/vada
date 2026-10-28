import type { Hono, Context } from 'hono'
import {
  AddAgendaSchema,
  UpdateAgendaSchema,
  AddDecisionSchema,
  UpdateDecisionSchema,
  EmptyRequestSchema,
  type MeetingResponse,
} from '@vada/contracts'
import { inCouncilChange, recordIdOf, type AccessRequest } from '../access/authorize.js'
import type { requireSession, SessionEnv } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { json } from '../http/validate.js'
import {
  addAgenda,
  updateAgenda,
  cancelAgenda,
  addDecision,
  updateDecision,
  cancelDecision,
} from './minutes-service.js'

const root = '/organizations/:councilId/meetings/:meetingId'
const CREATED = 201
type Asked = (c: Context<SessionEnv>) => AccessRequest
const targetOf = (c: Context<SessionEnv>, now: Date) => ({
  id: recordIdOf(c.req.param('meetingId')),
  itemId:
    c.req.param('agendaId') || c.req.param('decisionId')
      ? recordIdOf(c.req.param('agendaId') ?? c.req.param('decisionId'))
      : '',
  now,
})
type Dependencies = { db: Db; auth: ReturnType<typeof requireSession>; asked: Asked }

function agendaWrites(routes: Hono<SessionEnv>, { db, auth, asked }: Dependencies) {
  routes.post(`${root}/agenda`, json(AddAgendaSchema), auth, async c => {
    const request = asked(c)
    const input = c.req.valid('json')
    const meeting = await inCouncilChange(db, request, (tx, actor) =>
      addAgenda(tx, actor, targetOf(c, request.now), input),
    )
    return c.json({ meeting } satisfies MeetingResponse, CREATED)
  })
  routes.post(`${root}/agenda/:agendaId`, json(UpdateAgendaSchema), auth, async c => {
    const request = asked(c)
    const input = c.req.valid('json')
    const meeting = await inCouncilChange(db, request, (tx, actor) =>
      updateAgenda(tx, actor, targetOf(c, request.now), input),
    )
    return c.json({ meeting } satisfies MeetingResponse)
  })
  routes.post(`${root}/agenda/:agendaId/cancel`, json(EmptyRequestSchema), auth, async c => {
    const request = asked(c)
    const meeting = await inCouncilChange(db, request, (tx, actor) =>
      cancelAgenda(tx, actor, targetOf(c, request.now)),
    )
    return c.json({ meeting } satisfies MeetingResponse)
  })
}
function decisionWrites(routes: Hono<SessionEnv>, { db, auth, asked }: Dependencies) {
  routes.post(`${root}/agenda/:agendaId/decisions`, json(AddDecisionSchema), auth, async c => {
    const request = asked(c)
    const input = c.req.valid('json')
    const meeting = await inCouncilChange(db, request, (tx, actor) =>
      addDecision(tx, actor, targetOf(c, request.now), input),
    )
    return c.json({ meeting } satisfies MeetingResponse, CREATED)
  })
  routes.post(`${root}/decisions/:decisionId`, json(UpdateDecisionSchema), auth, async c => {
    const request = asked(c)
    const input = c.req.valid('json')
    const meeting = await inCouncilChange(db, request, (tx, actor) =>
      updateDecision(tx, actor, targetOf(c, request.now), input),
    )
    return c.json({ meeting } satisfies MeetingResponse)
  })
  routes.post(`${root}/decisions/:decisionId/cancel`, json(EmptyRequestSchema), auth, async c => {
    const request = asked(c)
    const meeting = await inCouncilChange(db, request, (tx, actor) =>
      cancelDecision(tx, actor, targetOf(c, request.now)),
    )
    return c.json({ meeting } satisfies MeetingResponse)
  })
}
export function addMinutesWrites(routes: Hono<SessionEnv>, dependencies: Dependencies) {
  agendaWrites(routes, dependencies)
  decisionWrites(routes, dependencies)
}
