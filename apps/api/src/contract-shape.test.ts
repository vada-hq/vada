import Ajv from 'ajv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import openapi from '../../../specs/figma/vada-wireframe/openapi.json' with { type: 'json' }
import { createApp, type Deps } from './app.ts'
import type { Db } from './db/client.ts'
import {
  attendanceQrs,
  departments,
  documents,
  educationColleges,
  educationSchools,
  events,
  invites,
  meetingAgendas,
  meetingParticipants,
  meetings,
  members,
  organizations,
  students,
  surveyApplications,
  surveys,
  tasks,
  users,
} from './db/schema.ts'
import { freshDb } from './db/testing.ts'
import { HANDLERS } from './handlers/index.ts'
import { inMemoryAttempts } from './idempotency.ts'
import { meetingLookups } from './meetings/lookups.ts'
import { hashToken } from './public/tokens.ts'
import { inMemoryCounter } from './public/rate-limit.ts'
import { answeredOperationIds } from './routes.ts'

// **답한다고 센 자리마다 계약의 모양을 통과한 증거가 있어야 한다.**
//
// 계약은 자리마다 답의 모양을 적어 두었다(`responses.200`의 스키마). 그런데 답을
// 놓는 층은 무엇을 돌려주든 **그대로 JSON으로 내보낸다** — 조각 하나를 빠뜨려도
// 아무도 안 보고, 화면은 그 자리에 조용히 빈칸을 그린다.
//
// 한동안 이 검사가 **손으로 고른 다섯 자리**에만 있었다(`events/events.test.ts`).
// 고르는 사람이 안 보는 자리는 목록에도 없다 — 교차검토가 짚었다(2026-09-05).
//
// 여기서는 **답하는 읽기 자리 전부**를 걷는다. 하나를 새로 붙이면 그 자리도
// 저절로 이 그물에 든다.
//
// ## 인자는 계약이 말하고 값은 여기가 심는다
//
// 자리마다 필요한 인자가 다르다(`{eventId}` · `status` · `scope`). 이름은 계약에서
// 읽고 값은 아래 씨앗이 심어 둔 것을 준다 — 없는 것을 물으면 서버가 없다고 답하고,
// 그것도 계약이 적어 둔 모양이라 이 검사는 그 자리를 못 잰다.

const ajv = new Ajv({ strict: false, allErrors: true })
const NOW = new Date('2026-09-05T09:00:00+09:00')
const QR = 'AAAAAAAAAAAAAAAAAAAAAA'
const LINK = 'SSSSSSSSSSSSSSSSSSSSSS'

let db: Db
let close: () => Promise<void>

/** 계약이 이름을 대고 여기가 값을 준다. **지어낸 값은 없다** — 전부 아래에 심는다. */
const GIVEN: Record<string, string> = {
  eventId: 'E-01',
  meetingId: 'MTG-01',
  memberId: 'M-01',
  taskId: 'T-01',
  schoolId: 'SCH-HYU-ERICA',
  collegeId: 'COL-HYU-ERICA-SW',
  inviteCode: 'AB12CD34',
  checkInToken: QR,
  surveyToken: LINK,
  receiptToken: 'RCPT-없는것',
  status: 'planned',
  scope: 'all',
  tab: 'todo',
}

/**
 * 같은 이름이 자리마다 다른 뜻인 인자.
 *
 * `status`가 그렇다 — 행사에서는 진행 단계고(`event.status`), 업무에서는 칸반의
 * 열이고(`planned`), 문서에서는 작성 단계다. 이름 하나로 값을 주면 서버가 422로
 * 막는다. **막는 것이 옳다** — 자리마다 든 목록이 다르기 때문이다.
 */
const INSTEAD: Record<string, Record<string, string>> = {
  'event.list': { status: 'all' },
  'event.documents': { status: 'all' },
}

function harness() {
  const deps: Deps = {
    audit: { async write() {} },
    db,
    who: async () => ({
      userId: 'U-01',
      membership: {
        orgId: 'ORG-01',
        memberId: 'M-01',
        role: 'chair',
        departmentId: 'D-01',
        inFinanceDepartment: true,
      },
    }),
    lookups: {
      isEventStaff: async () => true,
      isEventStaffManager: async () => true,
      ...meetingLookups(db),
    },
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    newId: () => `X-${Math.random().toString(36).slice(2, 10)}`,
  }
  return createApp(deps)
}

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(educationSchools).values({ id: 'SCH-HYU-ERICA', name: '한양대학교 ERICA' }).onConflictDoNothing()
  await db
    .insert(educationColleges)
    .values({ id: 'COL-HYU-ERICA-SW', schoolId: 'SCH-HYU-ERICA', name: '소프트웨어융합대학' })
    .onConflictDoNothing()

  await db.insert(organizations).values({
    id: 'ORG-01',
    name: '제12대 학생회',
    term: '2026',
    repSchoolId: 'SCH-HYU-ERICA',
    repCollegeId: 'COL-HYU-ERICA-SW',
  })
  await db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '기획부' },
    { id: 'D-02', orgId: 'ORG-01', name: '재정부', handlesFinance: true },
  ])
  await db.insert(users).values({ id: 'U-01', email: 'bada@example.ac.kr' })
  await db.insert(members).values({
    id: 'M-01',
    orgId: 'ORG-01',
    name: '김바다',
    role: 'chair',
    departmentId: 'D-01',
    userId: 'U-01',
  })
  await db.insert(invites).values({ orgId: 'ORG-01', code: 'AB12CD34', active: true })
  await db.insert(students).values({
    id: 'S-01',
    orgId: 'ORG-01',
    name: '최바람',
    studentNumber: '2021567890',
    college: '소프트웨어융합대학',
    department: '컴퓨터학부',
    grade: '3학년',
    duesStatus: 'paid',
  })
  await db.insert(events).values({
    id: 'E-01',
    orgId: 'ORG-01',
    title: '2026 체육대회',
    status: 'inProgress',
    startAt: NOW,
    place: 'ERICA 체육관',
    hostDepartmentId: 'D-01',
    updatedAt: NOW,
  })
  await db.insert(attendanceQrs).values({
    id: 'QR-01',
    orgId: 'ORG-01',
    eventId: 'E-01',
    tokenHash: hashToken(QR),
    active: true,
  })
  await db.insert(surveys).values({
    id: 'SV-01',
    orgId: 'ORG-01',
    eventId: 'E-01',
    linkToken: LINK,
    active: true,
    opensAt: new Date('2026-09-01T00:00:00+09:00'),
    closesAt: new Date('2026-09-30T23:59:00+09:00'),
    completionTitle: '접수되었습니다',
  })
  await db.insert(surveyApplications).values({
    id: 'SA-01',
    surveyId: 'SV-01',
    name: '최바람',
    studentNumber: '2021567890',
    college: '소프트웨어융합대학',
    department: '컴퓨터학부',
    receiptHash: hashToken('RRRRRRRRRRRRRRRRRRRRRR'),
    receiptExpiresAt: new Date('2026-10-01T00:00:00+09:00'),
    privacyConsentAt: NOW,
  })
  await db.insert(meetings).values({
    id: 'MTG-01',
    orgId: 'ORG-01',
    title: '정기회의',
    status: 'inProgress',
    scheduledAt: NOW,
    startedAt: NOW,
    creatorMemberId: 'M-01',
    departmentId: 'D-01',
  })
  await db.insert(meetingAgendas).values({
    id: 'AG-01',
    orgId: 'ORG-01',
    meetingId: 'MTG-01',
    sortOrder: 0,
    title: '첫 안건',
    status: 'current',
  })
  await db.insert(meetingParticipants).values({
    id: 'MP-01',
    orgId: 'ORG-01',
    meetingId: 'MTG-01',
    memberId: 'M-01',
    isHost: true,
  })
  await db.insert(tasks).values({
    id: 'T-01',
    orgId: 'ORG-01',
    eventId: 'E-01',
    title: '포스터 시안',
    status: 'planned',
    departmentId: 'D-01',
    assigneeMemberId: 'M-01',
  })
  await db.insert(documents).values({
    id: 'DOC-01',
    orgId: 'ORG-01',
    eventId: 'E-01',
    meetingId: 'MTG-01',
    title: '회의 자료.docx',
    status: 'confirmed',
  })
}, 60_000)

afterAll(async () => {
  await close()
})

interface Seat {
  operationId: string
  url: string
  schema: object
}

/** 답하는 읽기 자리와 그것을 부를 주소. 이름은 계약이 대고 값은 씨앗이 준다. */
function readSeats(): Seat[] {
  const found: Seat[] = []
  const paths = openapi.paths as unknown as Record<string, Record<string, never>>
  for (const [path, item] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (method !== 'get') continue
      const op = operation as unknown as {
        operationId: string
        parameters?: Array<{ name: string; in: string; required?: boolean }>
        responses: Record<string, { content?: { 'application/json': { schema: object } } }>
      }
      if (!(op.operationId in HANDLERS)) continue
      const schema = op.responses['200']?.content?.['application/json']?.schema
      if (schema === undefined) continue

      let url = path
      const query: string[] = []
      for (const found2 of path.matchAll(/\{([^}]+)\}/g)) {
        const name = found2[1]!
        url = url.replace(`{${name}}`, encodeURIComponent(GIVEN[name] ?? ''))
      }
      for (const param of op.parameters ?? []) {
        if (param.in !== 'query') continue
        const value = INSTEAD[op.operationId]?.[param.name] ?? GIVEN[param.name]
        if (value === undefined) continue
        query.push(`${param.name}=${encodeURIComponent(value)}`)
      }
      found.push({
        operationId: op.operationId,
        url: query.length === 0 ? url : `${url}?${query.join('&')}`,
        schema,
      })
    }
  }
  return found
}

describe('답하는 자리가 계약의 모양대로 답한다', () => {
  const seats = readSeats()

  it('잴 것이 있다 — 답하는 읽기 자리를 전부 걷는다', () => {
    expect(seats.length).toBeGreaterThan(50)
  })

  it.each(seats)('$operationId', async ({ url, schema }) => {
    const res = await harness().request(url)
    // **없다고 답하는 것도 계약이 적어 둔 답이다.** 씨앗이 못 심는 자리가 있고
    // (남의 영수증 같은 것) 그때는 모양을 잴 것이 없다.
    if (res.status === 404) return
    expect(res.status, `${url}가 ${res.status}로 답했다`).toBe(200)
    const validate = ajv.compile(schema)
    const body = await res.json()
    expect(validate(body), `${url}\n${JSON.stringify(validate.errors, null, 1)}`).toBe(true)
  })

  // **센 것과 잰 것이 같아야 한다.** 쓰기는 여기서 안 재므로 읽기만 견준다.
  it('답한다고 센 읽기 자리가 전부 이 그물에 든다', () => {
    const walked = new Set(seats.map((one) => one.operationId))
    const paths = openapi.paths as unknown as Record<string, Record<string, never>>
    const readsAnswered = answeredOperationIds().filter((operationId) => {
      for (const item of Object.values(paths)) {
        const op = item.get as unknown as { operationId?: string } | undefined
        if (op?.operationId === operationId) return true
      }
      return false
    })
    expect(readsAnswered.filter((operationId) => !walked.has(operationId))).toEqual([])
  })
})
