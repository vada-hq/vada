import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  attendanceCheckIns,
  attendanceQrs,
  events,
  organizations,
  surveyApplications,
  surveys,
} from '../db/schema.ts'
import { harness, matchesContract } from '../events/testing.ts'

// 행사 참가자 명단(EVT-04 · EVT-04B)이 읽는 것.
//
// **참가자는 학생회 구성원이 아니다.** 명세가 그렇게 못 박았다 — 조직 명단
// (`org.members`)과 다른 물건이고, 여기 오는 사람은 링크로 신청을 낸 사람
// (`survey_applications`)이다. 그래서 두 표를 잇지 않는다.
//
// 이 파일이 재는 것이 셋이다.
//
// 1. **거르는 일도 세는 일도 서버가 한다.** 명세가 '받아온 것을 화면에서 거르지도
//    자르지도 않는다'고 적었으므로, 검색어·거르개 넷·쪽 번호가 전부 여기까지 온다.
// 2. **딱지의 말과 색을 서버가 만든다.** 표에 든 것은 갈래(`applied`·`paid`)이고
//    '신청 완료'·'납부 확인'은 그 갈래를 사람의 말로 옮긴 것이다.
// 3. **고를 목록이 표를 따라간다.** 표는 진짜인데 고를 것이 가짜면 사람은 없는
//    소속을 고르고 빈 목록을 본다.

let db: Db
let close: () => Promise<void>

const NOW = new Date('2026-08-15T10:00:00+09:00')

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(events).values([
    { id: 'E-01', orgId: 'ORG-01', title: '2026 소프트웨어융합대학 체육대회' },
    // 설문을 아직 안 만든 행사. **신청자가 하나도 없는 것과 같은 자리다.**
    { id: 'E-02', orgId: 'ORG-01', title: '2026 신입생 환영회' },
    // 참가비를 안 받는 행사. 입금 상태로 거를 것이 없다.
    { id: 'E-03', orgId: 'ORG-01', title: '2026 학술제', feeType: 'free' },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사' },
  ])
  await db.insert(surveys).values([
    { id: 'S-01', orgId: 'ORG-01', eventId: 'E-01', linkToken: 'TOKEN-E01', active: true },
    { id: 'S-03', orgId: 'ORG-01', eventId: 'E-03', linkToken: 'TOKEN-E03', active: true },
    { id: 'S-99', orgId: 'ORG-02', eventId: 'E-99', linkToken: 'TOKEN-E99', active: true },
  ])
  await db.insert(surveyApplications).values([
    {
      id: 'SA-01',
      surveyId: 'S-01',
      name: '김바다',
      studentNumber: '2022111111',
      department: '컴퓨터학부',
      applyStatus: 'applied',
      payStatus: 'paid',
      receiptHash: 'H-01',
      receiptExpiresAt: NOW,
      privacyConsentAt: NOW,
      at: new Date('2026-08-01T10:00:00+09:00'),
    },
    {
      id: 'SA-02',
      surveyId: 'S-01',
      name: '이윤슬',
      studentNumber: '2023222222',
      department: 'ICT융합학부',
      applyStatus: 'applied',
      payStatus: 'unpaid',
      receiptHash: 'H-02',
      receiptExpiresAt: NOW,
      privacyConsentAt: NOW,
      at: new Date('2026-08-02T10:00:00+09:00'),
    },
    // 찍고 온 사람. 참석 딱지는 이 사람에게만 붙는다.
    {
      id: 'SA-03',
      surveyId: 'S-01',
      name: '박해랑',
      studentNumber: '2021333333',
      department: '인공지능학과',
      applyStatus: 'waitlisted',
      receiptHash: 'H-03',
      receiptExpiresAt: NOW,
      privacyConsentAt: NOW,
      at: new Date('2026-08-03T10:00:00+09:00'),
    },
    // **소속을 안 적은 사람.** 빈 글이 아니라 그 사실이 와야 한다.
    {
      id: 'SA-04',
      surveyId: 'S-01',
      name: '정하늘',
      studentNumber: '2024444444',
      receiptHash: 'H-04',
      receiptExpiresAt: NOW,
      privacyConsentAt: NOW,
      at: new Date('2026-08-04T10:00:00+09:00'),
    },
    // 남의 학생회의 신청. 이 명단에 오면 안 된다.
    {
      id: 'SA-99',
      surveyId: 'S-99',
      name: '남의 신청자',
      studentNumber: '2020999999',
      receiptHash: 'H-99',
      receiptExpiresAt: NOW,
      privacyConsentAt: NOW,
    },
  ])
  await db.insert(attendanceQrs).values({
    id: 'QR-01',
    orgId: 'ORG-01',
    eventId: 'E-01',
    tokenHash: 'QRHASH-01',
    active: true,
  })
  await db.insert(attendanceCheckIns).values({
    id: 'CI-01',
    qrId: 'QR-01',
    name: '박해랑',
    studentNumber: '2021333333',
    receiptHash: 'CIH-01',
    receiptExpiresAt: NOW,
    matched: true,
  })
})

afterAll(async () => {
  await close()
})

type Row = Record<string, unknown>

const list = (search = 'eventId=E-01') =>
  harness(db).request(`/api/ops/event/participants?${search}`)
const paging = (search = 'eventId=E-01') =>
  harness(db).request(`/api/ops/event/participants/paging?${search}`)
const options = (what: string, eventId = 'E-01') =>
  harness(db).request(`/api/ops/event/participants/${what}?eventId=${eventId}`)

describe('행사 참가자 명단(event.participants)', () => {
  it('신청한 차례로 그 행사의 신청자만 온다', async () => {
    const rows = (await (await list()).json()) as Row[]
    expect(rows.map((row) => row.name)).toEqual(['김바다', '이윤슬', '박해랑', '정하늘'])
    expect(rows.map((row) => row.studentNo)).toEqual([
      '2022111111',
      '2023222222',
      '2021333333',
      '2024444444',
    ])
  })

  // **딱지의 말과 색을 서버가 만든다.** 표에 든 것은 갈래뿐이다.
  it('상태 셋을 말과 색으로 옮겨 준다', async () => {
    const rows = (await (await list()).json()) as Row[]
    expect(rows[0]).toMatchObject({
      affiliation: '컴퓨터학부',
      applyStatus: '신청 완료',
      applyStatusTone: 'blue',
      payStatus: '납부 확인',
      payStatusTone: 'green',
      // 안 찍고 온 사람은 **불참이 아니라 미확인이다.**
      attendStatus: '미확인',
      attendStatusTone: 'gray',
    })
    expect(rows[1]).toMatchObject({ payStatus: '미납', payStatusTone: 'red' })
    expect(rows[2]).toMatchObject({
      applyStatus: '대기 중',
      applyStatusTone: 'gray',
      // 참가비를 아직 안 본 사람.
      payStatus: '미확인',
      payStatusTone: 'gray',
      // QR을 찍은 사람만 참석이다.
      attendStatus: '참석',
      attendStatusTone: 'green',
    })
  })

  // **없는 것을 빈 글로 대신하지 않는다**(조직도가 쓰는 규칙과 같다).
  it('소속을 안 적은 사람은 그 사실로 온다', async () => {
    const rows = (await (await list()).json()) as Row[]
    expect(rows[3]).toMatchObject({ name: '정하늘', affiliation: '소속 미등록' })
  })

  it('검색어는 이름과 학번을 함께 본다', async () => {
    const byName = (await (await list('eventId=E-01&query=윤슬')).json()) as Row[]
    expect(byName.map((row) => row.name)).toEqual(['이윤슬'])
    const byNumber = (await (await list('eventId=E-01&query=2021333')).json()) as Row[]
    expect(byNumber.map((row) => row.name)).toEqual(['박해랑'])
  })

  // 거르개 넷은 **그려지는 말 그대로** 온다. 값과 말이 갈리면 화면이 그 사이를
  // 다시 알아야 한다(선택지 목록이 값과 말을 같게 두는 것과 같은 까닭이다).
  it('거르개 넷이 서버에서 걸린다', async () => {
    const byAffiliation = (await (
      await list('eventId=E-01&affiliation=컴퓨터학부')
    ).json()) as Row[]
    expect(byAffiliation.map((row) => row.name)).toEqual(['김바다'])
    const byApply = (await (await list('eventId=E-01&applyStatus=대기 중')).json()) as Row[]
    expect(byApply.map((row) => row.name)).toEqual(['박해랑'])
    const byPay = (await (await list('eventId=E-01&payStatus=미납')).json()) as Row[]
    expect(byPay.map((row) => row.name)).toEqual(['이윤슬'])
    const byAttend = (await (await list('eventId=E-01&attendStatus=참석')).json()) as Row[]
    expect(byAttend.map((row) => row.name)).toEqual(['박해랑'])
  })

  // **설문이 없는 것과 신청자가 없는 것은 같은 모양으로 그려진다.** 명단이 비었다는
  // 사실은 하나이고, 왜 비었는지는 이 자리가 말하는 것이 아니다.
  it('설문을 아직 안 만든 행사는 빈 명단이다', async () => {
    expect(await (await list('eventId=E-02')).json()).toEqual([])
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await list('eventId=E-99')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(matchesContract('event.participants', await (await list()).json())).toBe(true)
  })
})

describe('명단이 몇 쪽인가(event.participantPaging)', () => {
  // **화면이 수에 '명'을 붙이지 않는다.** 무엇을 세어 뭐라 부르는지는 서버가 안다.
  it('센 것을 완성된 문구로 준다', async () => {
    expect(await (await paging()).json()).toEqual({ totalNote: '총 4명', pageCount: 1 })
  })

  // 쪽 번호만 빼고 목록과 같은 인자를 받는다 — 거르는 조건이 같아야 같은 수가 나온다.
  it('거른 뒤의 수를 센다', async () => {
    expect(await (await paging('eventId=E-01&query=윤슬')).json()).toMatchObject({
      totalNote: '총 1명',
    })
  })

  // **빈 명단도 한 쪽이다.** 쪽이 0개면 화면의 '다음'이 열린 채로 남는다.
  it('신청자가 없어도 한 쪽이다', async () => {
    expect(await (await paging('eventId=E-02')).json()).toEqual({
      totalNote: '총 0명',
      pageCount: 1,
    })
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await paging('eventId=E-99')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(matchesContract('event.participantPaging', await (await paging()).json())).toBe(true)
  })
})

describe('거르는 선택지 넷', () => {
  // **어느 학부·학과가 오는지는 신청한 사람이 정한다.** 명세가 목록을 들 수 없다.
  it('소속은 그 행사에 실제로 온 것만 준다', async () => {
    expect(await (await options('affiliations')).json()).toEqual([
      { value: 'ICT융합학부', label: 'ICT융합학부' },
      { value: '소속 미등록', label: '소속 미등록' },
      { value: '인공지능학과', label: '인공지능학과' },
      { value: '컴퓨터학부', label: '컴퓨터학부' },
    ])
  })

  // 표의 딱지에 그려지는 말과 같은 목록이다.
  it('신청 상태는 딱지의 말 그대로다', async () => {
    expect(await (await options('apply-status')).json()).toEqual([
      { value: '신청 완료', label: '신청 완료' },
      { value: '대기 중', label: '대기 중' },
    ])
  })

  it('입금 상태는 셋이다', async () => {
    expect(await (await options('pay-status')).json()).toEqual([
      { value: '납부 확인', label: '납부 확인' },
      { value: '미납', label: '미납' },
      { value: '미확인', label: '미확인' },
    ])
  })

  // **참가비를 받지 않는 행사도 있어 목록이 비어 올 수 있다**(계약이 그렇게 적었다).
  it('참가비를 안 받는 행사는 입금 상태로 거를 것이 없다', async () => {
    expect(await (await options('pay-status', 'E-03')).json()).toEqual([])
  })

  // **행사 전에는 미확인뿐이고 당일에 늘어난다**(계약이 그렇게 적었다).
  it('참석 상태는 실제로 그려진 것만 준다', async () => {
    expect(await (await options('attend-status')).json()).toEqual([
      { value: '참석', label: '참석' },
      { value: '미확인', label: '미확인' },
    ])
    expect(await (await options('attend-status', 'E-02')).json()).toEqual([])
  })

  it('울타리를 넘지 않는다', async () => {
    for (const what of ['affiliations', 'apply-status', 'pay-status', 'attend-status']) {
      expect((await options(what, 'E-99')).status).toBe(404)
    }
  })

  it('답이 계약의 모양을 지킨다', async () => {
    for (const [what, id] of [
      ['affiliations', 'event.participantAffiliations.options'],
      ['apply-status', 'event.participantApplyStatus.options'],
      ['pay-status', 'event.participantPayStatus.options'],
      ['attend-status', 'event.participantAttendStatus.options'],
    ] as const) {
      expect(matchesContract(id, await (await options(what)).json())).toBe(true)
    }
  })
})
