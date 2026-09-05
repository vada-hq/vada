import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import { events, organizations, surveyApplications, surveys } from '../db/schema.ts'
import { harness, matchesContract } from './testing.ts'

// 참여 설문 한 건과 그것을 갈아 끼울 때의 여파(EVT-05 · EVT-05B).
//
// **설문의 상태는 행사의 상태와 다른 축이다.** 명세가 그렇게 못 박았다 — 회의의
// status와 minutesStatus가 갈린 것과 같은 자리다.
//
// **응답자 수는 서버가 센다.** 화면이 응답 목록을 받아 세면 '몇 명인가'의 답이
// 화면마다 갈리고, 애초에 이 화면은 응답 목록을 받지 않는다.

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
    { id: 'E-02', orgId: 'ORG-01', title: '2026 신입생 환영회' },
    // 설문을 아직 안 만든 행사.
    { id: 'E-03', orgId: 'ORG-01', title: '2026 가을 축제' },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사' },
  ])
  await db.insert(surveys).values([
    {
      id: 'S-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      linkToken: 'TOKEN-01',
      active: true,
      createdAt: new Date('2026-07-01T00:00:00+09:00'),
    },
    // 아직 안 연 설문. **'활성'과 다른 사실이다.**
    {
      id: 'S-02',
      orgId: 'ORG-01',
      eventId: 'E-02',
      linkToken: 'TOKEN-02',
      active: false,
      createdAt: new Date('2026-07-01T00:00:00+09:00'),
    },
  ])
  await db.insert(surveyApplications).values(
    ['A-01', 'A-02', 'A-03'].map((id, at) => ({
      id,
      surveyId: 'S-01',
      name: `신청자${at}`,
      studentNumber: `20260${at}`,
      receiptHash: `HASH-${id}`,
      receiptExpiresAt: NOW,
      privacyConsentAt: NOW,
    })),
  )
  // 다른 설문의 응답은 이 설문의 셈에 들지 않는다.
  await db.insert(surveyApplications).values({
    id: 'A-99',
    surveyId: 'S-02',
    name: '남의 신청자',
    studentNumber: '209999',
    receiptHash: 'HASH-A-99',
    receiptExpiresAt: NOW,
    privacyConsentAt: NOW,
  })
})

afterAll(async () => {
  await close()
})

const survey = (eventId = 'E-01') => harness(db).request(`/api/ops/events/${eventId}/survey`)
const impact = (eventId = 'E-01') =>
  harness(db).request(`/api/ops/events/${eventId}/survey/replace-impact`)

describe('참여 설문 한 건(event.survey)', () => {
  it('열려 있는 설문은 활성으로 온다', async () => {
    const body = (await (await survey()).json()) as Record<string, unknown>
    expect(body).toMatchObject({ statusLabel: '활성', statusTone: 'green' })
  })

  it('아직 안 연 설문은 초안으로 온다', async () => {
    const body = (await (await survey('E-02')).json()) as Record<string, unknown>
    expect(body).toMatchObject({ statusLabel: '초안', statusTone: 'gray' })
  })

  // **미리 볼 주소를 지어내지 않는다.** 설문 링크가 어디에 놓이는지를 배포가 아직
  // 말해 주지 않는다(초대 링크의 자리만 있다) — optional이므로 아예 오지 않는다.
  it('미리 볼 주소는 아직 오지 않는다', async () => {
    const body = (await (await survey()).json()) as Record<string, unknown>
    expect(body).not.toHaveProperty('previewUrl')
  })

  // **없는 것은 없다고 한다.** 빈 딱지를 그리면 '초안'과 '아직 안 만들었다'가 같아진다.
  it('설문이 없으면 없다고 한다', async () => {
    expect((await survey('E-03')).status).toBe(404)
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await survey('E-99')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(matchesContract('event.survey', await (await survey()).json())).toBe(true)
  })
})

describe('설문을 갈아 끼울 때의 여파(event.surveyReplaceImpact)', () => {
  it('응답자를 세어 준다', async () => {
    const body = (await (await impact()).json()) as Record<string, unknown>
    expect(body.currentRespondents).toBe('3명')
    // 응답은 남지만 새 설문에는 다시 내야 한다 — 그래서 전부가 영향을 받는다.
    expect(body.affectedRespondents).toBe('3명 (재응답 필요)')
  })

  it('되돌릴 수 없다는 것과 함께 알아야 할 것을 말한다', async () => {
    const body = (await (await impact()).json()) as Record<string, unknown>
    expect(body.title).toBe('새 설문으로 교체하시겠어요?')
    expect(body.warning).toBe('응답이 존재하는 설문은 직접 수정할 수 없습니다.')
    expect((body.notes as Array<{ text: string }>).map((one) => one.text)).toEqual([
      "기존 설문은 '교체됨' 상태로 변경됩니다.",
      '기존 응답자 데이터는 삭제되지 않고 보관됩니다.',
      '기존 응답자는 새 설문에 다시 응답해야 합니다.',
      '기존 링크에서는 새 설문으로 이동 버튼이 표시됩니다.',
    ])
  })

  it('설문이 없으면 없다고 한다', async () => {
    expect((await impact('E-03')).status).toBe(404)
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await impact('E-99')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(matchesContract('event.surveyReplaceImpact', await (await impact()).json())).toBe(true)
  })
})
