import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  events,
  organizations,
  surveyApplications,
  surveyQuestions,
  surveys,
} from '../db/schema.ts'
import type { Viewer } from '../permissions.ts'
import { harness, matchesContract, viewer } from './testing.ts'

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
    // 갈아 끼울 설문이 걸린 행사 둘. **교체는 되돌릴 수 없으므로** 위의 것들과 갈라 둔다.
    { id: 'E-04', orgId: 'ORG-01', title: '2026 겨울 학술제' },
    { id: 'E-05', orgId: 'ORG-01', title: '2026 봄 소풍' },
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
    // 열려 있고 응답이 있는 설문. 링크는 **밖에서 열리는 모양**(22자)이라야 옛 링크의
    // 안내 화면을 잴 수 있다.
    {
      id: 'S-04',
      orgId: 'ORG-01',
      eventId: 'E-04',
      linkToken: 'BBBBBBBBBBBBBBBBBBBBBB',
      active: true,
      completionTitle: '신청이 완료되었습니다.',
      duesCheck: true,
      createdAt: new Date('2026-07-01T00:00:00+09:00'),
    },
    {
      id: 'S-05',
      orgId: 'ORG-01',
      eventId: 'E-05',
      linkToken: 'CCCCCCCCCCCCCCCCCCCCCC',
      active: true,
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
  // 갈아 끼울 설문의 응답 둘과 문항 둘. 응답은 남고 문항은 따라와야 한다.
  await db.insert(surveyApplications).values(
    ['A-41', 'A-42'].map((id, at) => ({
      id,
      surveyId: 'S-04',
      name: `응답자${at}`,
      studentNumber: `20264${at}`,
      receiptHash: `HASH-${id}`,
      receiptExpiresAt: NOW,
      privacyConsentAt: NOW,
    })),
  )
  await db.insert(surveyQuestions).values([
    {
      id: 'SQ-41',
      orgId: 'ORG-01',
      surveyId: 'S-04',
      sortOrder: 0,
      title: '참여 동기',
      type: 'short',
      required: true,
    },
    {
      id: 'SQ-42',
      orgId: 'ORG-01',
      surveyId: 'S-04',
      sortOrder: 1,
      title: '개인정보 수집·이용 동의',
      type: 'privacy',
      required: true,
      locked: true,
    },
    { id: 'SQ-51', orgId: 'ORG-01', surveyId: 'S-05', sortOrder: 0, title: '참여 동기', type: 'short' },
  ])
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

// ─── 설문을 갈아 끼운다(event.survey.replace) ──────────────────────────────────
//
// `surveyReplaceImpact`가 말한 넷이 **그대로 일어나야 한다**: 옛 설문은 '교체됨'이
// 되고, 낸 응답은 지워지지 않으며, 새 설문은 응답 없이 서고, 옛 링크는 새 설문을
// 가리킨다. 말과 동작이 다른 곳에서 나오면 언젠가 말만 남는다.
//
// **새 링크는 추측할 수 없어야 한다.** 밖에서 오는 사람의 문은 그 열쇠 하나라, 옛
// 것에서 유도되는 값이면 옛 링크를 가진 사람이 새 것을 만들 수 있다.

let made = 0
const replace = (eventId: string, body: unknown, who?: Viewer) =>
  harness(db, {
    newId: () => `NEW-${(made += 1)}`,
    ...(who === undefined ? {} : { who }),
  }).request(`/api/ops/events/${eventId}/survey/replace`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const surveysOf = (eventId: string) =>
  db
    .select({
      id: surveys.id,
      active: surveys.active,
      replacedById: surveys.replacedById,
      linkToken: surveys.linkToken,
    })
    .from(surveys)
    .where(and(eq(surveys.orgId, 'ORG-01'), eq(surveys.eventId, eventId)))
    .orderBy(surveys.createdAt)

const questionsOf = (surveyId: string) =>
  db
    .select({
      title: surveyQuestions.title,
      type: surveyQuestions.type,
      required: surveyQuestions.required,
      locked: surveyQuestions.locked,
    })
    .from(surveyQuestions)
    .where(eq(surveyQuestions.surveyId, surveyId))
    .orderBy(surveyQuestions.sortOrder)

const applicationCount = async (surveyId: string) =>
  (
    await db
      .select({ id: surveyApplications.id })
      .from(surveyApplications)
      .where(eq(surveyApplications.surveyId, surveyId))
  ).length

describe('설문을 갈아 끼운다(event.survey.replace)', () => {
  it('옛 설문은 교체됨이 되고 새 초안이 지금의 설문이 된다', async () => {
    const res = await replace('E-04', { replaceMode: 'copyQuestions' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({})

    const [old, fresh] = await surveysOf('E-04')
    expect(old).toMatchObject({ id: 'S-04', active: false })
    expect(fresh).toMatchObject({ active: false, replacedById: null })
    expect(old!.replacedById).toBe(fresh!.id)
    // 새 열쇠는 밖에서 열리는 모양이고 옛 것과 다르다.
    expect(fresh!.linkToken).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(fresh!.linkToken).not.toBe(old!.linkToken)

    // 화면이 보는 '지금의 설문'은 새 초안이다.
    expect(await (await survey('E-04')).json()).toMatchObject({
      statusLabel: '초안',
      statusTone: 'gray',
    })
    const after = (await (await impact('E-04')).json()) as Record<string, unknown>
    expect(after.currentRespondents).toBe('0명')
  })

  it('문항 구조만 따라오고 응답은 따라오지 않는다', async () => {
    const [old, fresh] = await surveysOf('E-04')
    expect(await questionsOf(fresh!.id)).toEqual([
      { title: '참여 동기', type: 'short', required: true, locked: false },
      { title: '개인정보 수집·이용 동의', type: 'privacy', required: true, locked: true },
    ])
    // 낸 것은 남는다 — 옛 설문에 그대로.
    expect(await applicationCount(old!.id)).toBe(2)
    expect(await applicationCount(fresh!.id)).toBe(0)
  })

  // 밖에서 오는 사람 쪽의 답이다. 옛 링크를 연 사람에게 '여기로 가세요'가 보인다.
  it('옛 링크는 새 설문으로 안내한다', async () => {
    const [, fresh] = await surveysOf('E-04')
    const res = await harness(db).request(
      '/api/public/surveys/link-state?surveyToken=BBBBBBBBBBBBBBBBBBBBBB',
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      label: '설문이 교체되었습니다',
      actionLabel: '새 신청 폼으로 가기',
      replacementToken: fresh!.linkToken,
    })
  })

  // 계약이 conflict라 적었다 — 두 번 누르면 방금 만든 새 초안이 또 갈린다.
  it('방금 만든 초안은 다시 갈 수 없다', async () => {
    expect((await replace('E-04', { replaceMode: 'copyQuestions' })).status).toBe(409)
    expect(await surveysOf('E-04')).toHaveLength(2)
  })

  it('빈 설문으로 시작하면 문항이 따라오지 않는다', async () => {
    expect((await replace('E-05', { replaceMode: 'blank' })).status).toBe(200)
    const [old, fresh] = await surveysOf('E-05')
    expect(old!.replacedById).toBe(fresh!.id)
    expect(await questionsOf(fresh!.id)).toEqual([])
  })

  // '기존 설문을 끝내고' — 열지 않은 설문은 끝낼 것이 없다.
  it('아직 열지 않은 설문은 끝낼 것이 없다', async () => {
    expect((await replace('E-02', { replaceMode: 'blank' })).status).toBe(409)
  })

  it('방식을 안 고르거나 없는 방식이면 막고 아무것도 바꾸지 않는다', async () => {
    expect((await replace('E-01', {})).status).toBe(422)
    expect((await replace('E-01', { replaceMode: '아무거나' })).status).toBe(422)
    expect(await surveysOf('E-01')).toMatchObject([{ id: 'S-01', active: true, replacedById: null }])
  })

  it('설문이 없으면 없다고 한다', async () => {
    expect((await replace('E-03', { replaceMode: 'blank' })).status).toBe(404)
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await replace('E-99', { replaceMode: 'blank' })).status).toBe(404)
  })

  it('행사를 맡은 사람이 아니면 막는다', async () => {
    expect((await replace('E-01', { replaceMode: 'blank' }, viewer('member'))).status).toBe(403)
  })
})
