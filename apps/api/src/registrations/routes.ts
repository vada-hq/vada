import { Hono, type Context } from 'hono'
import {
  CreateFormSchema,
  PauseFormSchema,
  ResumeFormSchema,
  UpdateFormSchema,
  type RegistrationFormResponse,
  type RegistrationFormsResponse,
} from '@vada/contracts'
import { authorize, councilIdOf, inCouncilChange, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { createRateLimiter, type RateLimiter } from '../http/rate-limit.js'
import { json } from '../http/validate.js'
import { purgeFormIfDue } from './purge.js'
import { formDetailOf, formListOf } from './queries.js'
import { createForm, setPaused, updateForm } from './service.js'

const root = '/organizations/:councilId'
const CREATED = 201

// 운영진 쓰기는 계정마다 10초에 20번이다(행사, 계좌와 같은 값).
const REGISTRATION_WRITE_LIMIT = { limit: 20, windowMs: 10_000 }

// 읽기는 한 시점의 모습이다(행사와 같다).
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

// 번호 형식은 운영진인지 본 뒤에 본다: 운영진이 아니면 대상이 있는지 드러내지 않고 403이다.
const eventIdOf = (c: Context<SessionEnv>) => recordIdOf(c.req.param('eventId'))
const formIdOf = (c: Context<SessionEnv>) => recordIdOf(c.req.param('formId'))

type WriteKit = {
  routes: Hono<SessionEnv>
  auth: ReturnType<typeof requireSession>
  writeLimiter: RateLimiter
  clock: () => Date
  db: Db
}

function addWriteRoutes({ routes, auth, writeLimiter, clock, db }: WriteKit) {
  const changing = (c: Context<SessionEnv>) => ({
    userId: c.get('userId'),
    councilId: c.req.param('councilId'),
    action: 'council.view' as const,
    now: clock(),
  })
  // 로그인한 사람만 세므로 인증 뒤에 둔다.
  const limited = (c: Context<SessionEnv>) => {
    if (!writeLimiter.take(c.get('userId'), clock())) throw new ApiError('TOO_MANY_REQUESTS')
  }
  routes.post(
    `${root}/events/:eventId/registration-forms`,
    json(CreateFormSchema),
    auth,
    async c => {
      limited(c)
      const input = c.req.valid('json')
      const asked = changing(c)
      const form = await inCouncilChange(db, asked, (tx, actor) =>
        createForm(tx, actor, { eventId: eventIdOf(c), now: asked.now }, input),
      )
      return c.json({ form } satisfies RegistrationFormResponse, CREATED)
    },
  )
  routes.post(`${root}/registration-forms/:formId`, json(UpdateFormSchema), auth, async c => {
    limited(c)
    const input = c.req.valid('json')
    const asked = changing(c)
    const form = await inCouncilChange(db, asked, (tx, actor) =>
      updateForm(tx, actor, { formId: formIdOf(c), now: asked.now }, input),
    )
    return c.json({ form } satisfies RegistrationFormResponse)
  })
  for (const [path, schema, paused] of [
    ['pause', PauseFormSchema, true],
    ['resume', ResumeFormSchema, false],
  ] as const)
    routes.post(`${root}/registration-forms/:formId/${path}`, json(schema), auth, async c => {
      limited(c)
      const asked = changing(c)
      const form = await inCouncilChange(db, asked, (tx, actor) =>
        setPaused(tx, actor, { formId: formIdOf(c), now: asked.now, paused }),
      )
      return c.json({ form } satisfies RegistrationFormResponse)
    })
}

// 신청 양식: 목록과 하나 읽기는 모든 운영진이 본다(신청 수는 PRIN-5). 만들기, 고치기, 멈추기는 관리 권한자(책임자, 담당 부서, 회장단)다.
export function createRegistrationRoutes(
  db: Db,
  getSession: SessionReader,
  options: { clock?: () => Date; writeLimiter?: RateLimiter } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  const asked = (c: Context<SessionEnv>) => ({
    userId: c.get('userId'),
    councilId: councilIdOf(c.req.param('councilId')),
    action: 'council.view' as const,
    now: clock(),
  })
  routes.get(`${root}/events/:eventId/registration-forms`, auth, async c => {
    const request = asked(c)
    const list = await db.transaction(
      async tx => formListOf(tx, await authorize(tx, request), eventIdOf(c), request.now),
      snapshot,
    )
    return c.json(list satisfies RegistrationFormsResponse)
  })
  routes.get(`${root}/registration-forms/:formId`, auth, async c => {
    const request = asked(c)
    // 운영진인지 먼저 본 뒤(403), 읽기 전에 이 양식의 기한이 지난 신청자 정보를 지운다. 읽기 거래는 쓰지 못해 따로 한다.
    await db.transaction(tx => authorize(tx, request), snapshot)
    await purgeFormIfDue(db, request.councilId, formIdOf(c), request.now)
    const form = await db.transaction(
      async tx => formDetailOf(tx, await authorize(tx, request), formIdOf(c), request.now),
      snapshot,
    )
    return c.json({ form } satisfies RegistrationFormResponse)
  })
  addWriteRoutes({
    routes,
    auth,
    clock,
    db,
    writeLimiter: options.writeLimiter ?? createRateLimiter(REGISTRATION_WRITE_LIMIT),
  })
  return routes
}
