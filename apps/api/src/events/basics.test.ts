import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import Ajv from 'ajv'
import { eq } from 'drizzle-orm'
import openapi from '../../../../specs/figma/vada-wireframe/openapi.json' with { type: 'json' }
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import { departments, eventCapacityType, eventFeeType, events, members, organizations } from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import type { Viewer } from '../permissions.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'
import { routeOf } from '../routes.ts'
import { CAPACITY_TYPES, FEE_TYPES } from './basics.ts'

// 행사 기본정보를 **고치는** 자리(EVT-02B).
//
// 이 파일이 재는 것은 셋이다.
//
// 1. **칸으로 나가고 칸으로 들어온다.** 화면이 '미정' 같은 말을 칸에 받으면 사람이
//    그것을 지우지 않고 저장한다 — 없는 칸은 아예 오지 않아야 한다.
// 2. **시각이 한국 시간이다.** 이 검사는 UTC에서 돈다(vitest.config.ts). 기계의
//    시간대로 읽거나 쓰면 아홉 시간 어긋난 채 아무 오류 없이 통과한다.
// 3. **울타리가 서 있다.** 남의 학생회 행사에는 읽기도 쓰기도 닿지 않는다.

let db: Db
let close: () => Promise<void>

// 저장한 때가 '수정 시각'으로 남는지 보려고 못 박는다.
const NOW = new Date('2026-07-18T09:00:00+09:00')

function viewer(role: 'chair' | 'head' | 'member'): Viewer {
  return {
    userId: 'U-01',
    membership: {
      orgId: 'ORG-01',
      memberId: 'M-01',
      role,
      departmentId: 'D-01',
      inFinanceDepartment: false,
    },
  }
}

function harness(who: Viewer | null = viewer('chair')) {
  const deps: Deps = {
    audit: { async write() {} },
    db,
    who: async () => who,
    lookups: {
      // 행사 운영 조직 표가 아직 없다. 없다고 답한다 — 있다고 지어내면 조건부 권한이
      // 전부 열린다.
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
    },
    // 검사는 밖으로 나가지 않는다. 열려 있다고만 답하고, 부르면 어디로 갈지 말해 준다.
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    newId: () => 'E-new',
  }
  return createApp(deps)
}

const draftOf = (app: ReturnType<typeof harness>, eventId = 'E-01') =>
  app.request(`/api/ops/events/${eventId}/basics/draft`)

const save = (
  app: ReturnType<typeof harness>,
  body: Record<string, unknown>,
  eventId = 'E-01',
) =>
  app.request(`/api/ops/events/${eventId}/basics`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close
}, 60_000)

beforeEach(async () => {
  await db.delete(events)
  await db.delete(members)
  await db.delete(departments)
  await db.delete(organizations)

  await db.insert(organizations).values({ id: 'ORG-01', name: '제12대 학생회' })
  await db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '학술체육부' },
    { id: 'D-02', orgId: 'ORG-01', name: '기획부' },
  ])
  await db.insert(members).values({
    id: 'M-01',
    orgId: 'ORG-01',
    name: '김바다',
    role: 'chair',
    departmentId: 'D-01',
  })
  await db.insert(events).values([
    {
      id: 'E-01',
      orgId: 'ORG-01',
      title: '2026 소프트웨어융합대학 체육대회',
      status: 'inProgress',
      startAt: new Date('2026-08-20T10:00:00+09:00'),
      place: 'ERICA 체육관',
      audience: '소프트웨어융합대학 전체',
      hostDepartmentId: 'D-01',
      hostMemberId: 'M-01',
      updatedAt: NOW,
    },
    // 행사명 하나만 있는 행사. **비어 있는 것이 정상이다.**
    { id: 'E-02', orgId: 'ORG-01', title: '가칭 신입생 환영회', updatedAt: NOW },
  ])
})

afterAll(async () => {
  await close()
})

describe('고칠 칸을 준다', () => {
  // **빈 칸에 말을 넣지 않는다.** `event.basics`는 '장소 미정'을 주지만 이쪽은
  // 사람이 고칠 칸이라, 그 말을 넣으면 지우지 않고 저장한 사람의 장소가 '장소 미정'이
  // 된다. 카탈로그가 그 조각들을 optional로 적어 둔 것이 이 뜻이다.
  it('아직 안 채운 칸은 아예 오지 않는다', async () => {
    const body = (await (await draftOf(harness(), 'E-02')).json()) as Record<string, unknown>
    expect(body.title).toBe('가칭 신입생 환영회')
    for (const key of ['intro', 'purpose', 'startAt', 'place', 'capacity', 'hostPerson']) {
      expect(body).not.toHaveProperty(key)
    }
  })

  // 계약이 required로 든 셋은 늘 온다. 아직 고른 적이 없으면 '미정'이 그 값이다 —
  // 선택지에 실제로 있는 값이라 지어낸 것이 아니다.
  it('계약이 늘 오라고 한 칸은 안 채웠어도 온다', async () => {
    const body = (await (await draftOf(harness(), 'E-02')).json()) as Record<string, unknown>
    expect(body).toMatchObject({
      feeType: 'undecided',
      capacityType: 'undecided',
      endUnset: false,
      placeUnset: false,
    })
  })

  // **이 검사는 UTC에서 돈다.** 기계의 시간대로 찍으면 '2026-08-20T01:00'이 되고,
  // 화면의 칸에는 아무 오류 없이 새벽 한 시가 그려진다.
  it('시작 일시가 한국 시간의 칸 값으로 온다', async () => {
    const body = (await (await draftOf(harness())).json()) as Record<string, unknown>
    expect(body.startAt).toBe('2026-08-20T10:00')
  })

  // 표는 '이 조직의 그 부서'를 가리키는데 그림의 그 자리는 글 칸이다.
  it('담당 부서와 담당자가 이름으로 온다', async () => {
    const body = (await (await draftOf(harness())).json()) as Record<string, unknown>
    expect(body).toMatchObject({ hostDepartment: '학술체육부', hostPerson: '김바다' })
  })
})

describe('고친 것이 남는다', () => {
  // 편집 패널이 실제로 하는 한 바퀴다. 나간 값이 그대로 돌아오지 않으면 사람은
  // 다시 열 때마다 자기가 적은 것이 사라진 것을 본다.
  it('저장한 값이 그대로 다시 온다', async () => {
    const app = harness()
    expect(
      (
        await save(app, {
          title: '2026 체육대회',
          intro: '한 해에 한 번 여는 자리입니다',
          startAt: '2026-08-20T10:00',
          endAt: '2026-08-20T17:30',
          place: 'ERICA 체육관',
          address: '경기도 안산시 상록구',
          feeType: 'duesConditional',
          paidAmount: 0,
          unpaidAmount: 5000,
          capacityType: 'limited',
          capacity: 200,
          hostDepartment: '기획부',
          hostPerson: '김바다',
          notice: '실내화를 챙겨 오세요',
        })
      ).status,
    ).toBe(200)

    const body = (await (await draftOf(app)).json()) as Record<string, unknown>
    expect(body).toMatchObject({
      title: '2026 체육대회',
      intro: '한 해에 한 번 여는 자리입니다',
      startAt: '2026-08-20T10:00',
      endAt: '2026-08-20T17:30',
      address: '경기도 안산시 상록구',
      feeType: 'duesConditional',
      // 카탈로그가 이 셋을 글로 적었다 — 칸에 들어가는 값이기 때문이다.
      paidAmount: '0',
      unpaidAmount: '5000',
      capacityType: 'limited',
      capacity: '200',
      hostDepartment: '기획부',
      notice: '실내화를 챙겨 오세요',
    })
  })

  // **칸에 적힌 10시는 한국의 10시다.** 기계 시간대로 읽으면 UTC 서버가 19시로
  // 저장하고, 목록에도 QR에도 그 19시가 그대로 번진다.
  it('칸에 적은 시각을 한국 시간으로 읽는다', async () => {
    await save(harness(), { startAt: '2026-08-20T10:00' })
    const row = (await db.select().from(events).where(eq(events.id, 'E-01')))[0]!
    expect(row.startAt?.toISOString()).toBe('2026-08-20T01:00:00.000Z')
  })

  // 같은 표를 EVT-02가 읽는다. 고쳤는데 개요가 옛 값을 그리면 사람은 저장이 안 된
  // 줄 안다.
  it('고친 값이 행사 개요에도 그대로 나타난다', async () => {
    const app = harness()
    await save(app, { title: '이름을 바꾼 행사', place: '학생회관 대강당' })
    const basics = (await (
      await app.request('/api/ops/event/basics?eventId=E-01')
    ).json()) as Record<string, unknown>
    expect(basics).toMatchObject({ title: '이름을 바꾼 행사', place: '학생회관 대강당' })
  })

  // 목록의 '오늘 10:00 수정'이 이 값에서 나온다. 고쳐 놓고 두면 그 줄이 거짓말을 한다.
  it('저장한 때가 수정 시각으로 남는다', async () => {
    await db.update(events).set({ updatedAt: new Date('2020-01-01T00:00:00Z') })
    await save(harness(), { notice: '무엇이든' })
    const row = (await db.select().from(events).where(eq(events.id, 'E-01')))[0]!
    expect(row.updatedAt.toISOString()).toBe(NOW.toISOString())
  })

  // **빠진 칸은 '건드리지 말라'로 읽는다.** 지운 값은 되돌릴 수 없으므로 갈리는
  // 자리에서 지우지 않는 쪽을 골랐다.
  it('보내지 않은 칸은 그대로 둔다', async () => {
    const app = harness()
    await save(app, { intro: '남아 있어야 하는 소개' })
    await save(app, { title: '이름만 고친다' })
    const body = (await (await draftOf(app)).json()) as Record<string, unknown>
    expect(body).toMatchObject({ title: '이름만 고친다', intro: '남아 있어야 하는 소개' })
  })

  // 반대로 보낸 칸이 비어 있으면 사람이 화면에서 지운 것이다.
  it('보낸 칸을 비우면 지운다', async () => {
    const app = harness()
    await save(app, { intro: '지워질 소개' })
    await save(app, { intro: '' })
    expect((await (await draftOf(app)).json()) as Record<string, unknown>).not.toHaveProperty(
      'intro',
    )
  })

  // 종료 시각이 비어 있는 것과 '안 정하기로 했다'는 다른 사실이다. 표가 그 둘을
  // 다른 칸으로 들고 있어야 화면이 체크상자를 되그릴 수 있다.
  it('종료 미정 표시는 종료 일시가 비어 있는 것과 다른 값이다', async () => {
    const app = harness()
    await save(app, { endUnset: true })
    const body = (await (await draftOf(app)).json()) as Record<string, unknown>
    expect(body.endUnset).toBe(true)
    expect(body).not.toHaveProperty('endAt')
  })
})

describe('받을 수 없는 값을 조용히 삼키지 않는다', () => {
  it('명세에 없는 참가비 유형은 막는다', async () => {
    const res = await save(harness(), { feeType: '무료' })
    expect(res.status).toBe(422)
    expect(((await res.json()) as { message: string }).message).toContain('참가비 유형')
  })

  it('명세에 없는 정원 유형은 막는다', async () => {
    expect((await save(harness(), { capacityType: 'huge' })).status).toBe(422)
  })

  // '0원 가능'이라고 적혀 있으므로 0은 받고, 음수는 신청 폼에 '-5000원'으로 나간다.
  it('금액은 0 이상의 정수만 받는다', async () => {
    expect((await save(harness(), { paidAmount: 0 })).status).toBe(200)
    expect((await save(harness(), { paidAmount: -5000 })).status).toBe(422)
    expect((await save(harness(), { paidAmount: '5000' })).status).toBe(422)
    expect((await save(harness(), { capacity: 1.5 })).status).toBe(422)
  })

  // 읽지 못한 때를 지금 시각으로 대신하면 행사가 조용히 옮겨진다.
  it('읽을 수 없는 일시는 막는다', async () => {
    expect((await save(harness(), { startAt: '2026년 8월 20일' })).status).toBe(422)
    // 없는 날은 3월 3일로 굴러간다 — 굴러간 채 저장되면 아무도 못 본다.
    expect((await save(harness(), { startAt: '2026-02-31T10:00' })).status).toBe(422)
  })

  it('행사명을 비우면 막는다', async () => {
    expect((await save(harness(), { title: '   ' })).status).toBe(422)
  })

  // 조용히 비우면 사람은 담당을 적었다고 믿고 목록에는 '담당 미정'이 그려진다.
  it('이 학생회에 없는 부서를 담당으로 적으면 막는다', async () => {
    expect((await save(harness(), { hostDepartment: '없는부서' })).status).toBe(422)
    expect((await save(harness(), { hostDepartment: '기획부' })).status).toBe(200)
  })
})

describe('아무나 고치지 못한다', () => {
  // 정책이 '회장은 늘, 부서장·부원은 행사 조직만'이라 했고 행사 조직 표가 아직 없다.
  it('부원은 고칠 수 없다', async () => {
    expect((await save(harness(viewer('member')), { title: '몰래 고치기' })).status).toBe(403)
  })

  // 읽는 자리의 권한은 '구성원이면 된다'다 — 계약이 두 자리에 다르게 적어 두었다.
  it('부원도 초안은 볼 수 있다', async () => {
    expect((await draftOf(harness(viewer('member')))).status).toBe(200)
  })

  it('로그인하지 않은 사람은 아예 막힌다', async () => {
    expect((await draftOf(harness(null))).status).toBe(401)
    expect((await save(harness(null), { title: '아무개' })).status).toBe(401)
  })

  // **울타리를 이음매마다 세운다.** 회장은 자기 학생회에서 '늘 가능'이라 권한
  // 미들웨어를 그대로 지나간다 — 남의 행사를 막는 것은 여기뿐이다.
  it('남의 학생회 행사는 읽지도 고치지도 못한다', async () => {
    await db.insert(organizations).values({ id: 'ORG-02', name: '남의 학생회' })
    await db.insert(events).values({
      id: 'E-99',
      orgId: 'ORG-02',
      title: '남의 행사',
      updatedAt: NOW,
    })

    expect((await draftOf(harness(), 'E-99')).status).toBe(404)
    expect((await save(harness(), { title: '남의 것을 고친다' }, 'E-99')).status).toBe(404)

    const row = (await db.select().from(events).where(eq(events.id, 'E-99')))[0]!
    expect(row.title).toBe('남의 행사')
  })

  // 남의 조직의 부서 이름을 적어도 붙지 않는다. 이름은 학생회마다 겹친다.
  it('남의 학생회 부서를 담당으로 붙이지 못한다', async () => {
    await db.insert(organizations).values({ id: 'ORG-02', name: '남의 학생회' })
    await db.insert(departments).values({ id: 'D-99', orgId: 'ORG-02', name: '남의부서' })
    expect((await save(harness(), { hostDepartment: '남의부서' })).status).toBe(422)
  })
})

describe('답이 계약의 모양을 지킨다', () => {
  it('event.basicsDraft의 답이 계약대로다', async () => {
    const res = await draftOf(harness())
    const at = routeOf('event.basicsDraft')!
    const paths = openapi.paths as unknown as Record<string, Record<string, unknown>>
    const operation = paths[at.path]![at.method] as {
      responses: { 200: { content: { 'application/json': { schema: object } } } }
    }
    const validate = new Ajv({ strict: false }).compile(
      operation.responses[200].content['application/json'].schema,
    )
    const body = await res.json()
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true)
  })

  // 선택지는 명세가 갖고 있는데 표의 enum은 옮김 파일이라 글자 그대로를 다시 적는다.
  // **두 벌은 갈린다** — 갈리면 명세가 받은 값을 표가 거절해 500이 된다.
  it('표의 선택지가 명세의 선택지와 같다', () => {
    expect([...eventFeeType.enumValues]).toEqual(FEE_TYPES)
    expect([...eventCapacityType.enumValues]).toEqual(CAPACITY_TYPES)
  })
})
