import type { Context } from 'hono'
import {
  ApplicantsQuerySchema,
  CancelAttendanceSchema,
  CheckInSchema,
  EmptyRequestSchema,
  type ApplicantsResponse,
  type CheckInResult,
  type StaffCancelResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { authorize, councilIdOf, inCouncilChange } from '../access/authorize.js'
import type { SessionEnv } from '../auth/require-session.js'
import type { Tx } from '../db/types.js'
import { clientIpOf } from '../http/client-ip.js'
import { parseQuery } from '../http/query.js'
import { json } from '../http/validate.js'
import { purgeFormIfDue } from './purge.js'
import { applicantsOf } from './applicants.js'
import { cancelAttendance, checkInByQr, checkInManually } from './attendance.js'
import { cancelByStaff } from './cancel-by-staff.js'
import { applicantChangeOf } from './staff-registration.js'
import {
  eventIdOf,
  formIdOf,
  kitHelpers,
  registrationIdOf,
  root,
  type RouteKit,
} from './route-kit.js'

// 신청자 목록, 운영진 취소, 출석. 신청자 정보를 담는 응답(목록, 출석 결과)은 열람 기록을 같은 거래에서 쓴다.
// 목록은 기록을 쓰므로 읽기 전용 거래가 아니다.
export function addApplicantRoutes(kit: RouteKit) {
  const { routes, auth, db, clock } = kit
  const { changing, limited } = kitHelpers(kit)
  routes.get(`${root}/registration-forms/:formId/applicants`, auth, async c => {
    const request = {
      userId: c.get('userId'),
      councilId: councilIdOf(c.req.param('councilId')),
      action: 'council.view' as const,
      now: clock(),
    }
    const ip = clientIpOf(c)
    const filter = parseQuery(ApplicantsQuerySchema, c.req.queries())
    // 운영진인지 먼저 본 뒤(403), 읽기 전에 이 양식의 기한이 지난 신청자 정보를 지운다. 열람 권한은 목록 안에서 본다.
    await db.transaction(tx => authorize(tx, request))
    await purgeFormIfDue(db, request.councilId, formIdOf(c), request.now)
    const list = await db.transaction(async tx =>
      applicantsOf(tx, await authorize(tx, request), {
        formId: formIdOf(c),
        ip,
        ...filter,
      }),
    )
    return c.json(list satisfies ApplicantsResponse)
  })
  routes.post(`${root}/events/:eventId/check-in`, json(CheckInSchema), auth, async c => {
    limited(c)
    const { tokenHash } = c.req.valid('json')
    const ip = clientIpOf(c)
    const result = await inCouncilChange(db, changing(c), (tx, actor) =>
      checkInByQr(tx, actor, { eventId: eventIdOf(c), tokenHash: tokenHash.toLowerCase(), ip }),
    )
    return c.json(result satisfies CheckInResult)
  })
  routes.post(
    `${root}/registrations/:registrationId/attendance`,
    json(EmptyRequestSchema),
    auth,
    async c => {
      limited(c)
      const ip = clientIpOf(c)
      const result = await inCouncilChange(db, changing(c), (tx, actor) =>
        checkInManually(tx, actor, { registrationId: registrationIdOf(c), ip }),
      )
      return c.json(result satisfies CheckInResult)
    },
  )
  addCancelRoutes(kit)
}

// 출석 취소와 신청 취소: 성공하면 cancelled다. 신청자 정보를 담지 않아 열람 기록이 없다.
// 신청 취소는 본문이 없고, 출석 취소는 [입장 안 함]이 보내는 출석 번호만 받을 수 있다.
function addCancelRoutes(kit: RouteKit) {
  const { routes, auth, db } = kit
  const { changing, limited } = kitHelpers(kit)
  async function cancelled(
    c: Context<SessionEnv>,
    run: (tx: Tx, actor: Actor, registrationId: string) => Promise<void>,
  ) {
    limited(c)
    const applicant = await inCouncilChange(db, changing(c), async (tx, actor) => {
      await run(tx, actor, registrationIdOf(c))
      return applicantChangeOf(tx, actor, registrationIdOf(c))
    })
    return c.json({ cancelled: true, applicant } satisfies StaffCancelResponse)
  }
  routes.post(
    `${root}/registrations/:registrationId/attendance/cancel`,
    json(CancelAttendanceSchema),
    auth,
    c => {
      const { attendanceId } = c.req.valid('json')
      return cancelled(c, (tx, actor, registrationId) =>
        cancelAttendance(tx, actor, { registrationId, attendanceId }),
      )
    },
  )
  routes.post(`${root}/registrations/:registrationId/cancel`, json(EmptyRequestSchema), auth, c =>
    cancelled(c, cancelByStaff),
  )
}
