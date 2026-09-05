import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import { events, organizations, surveyQuestions, surveys } from '../db/schema.ts'
import { harness, matchesContract } from '../events/testing.ts'

// 참여 설문을 세우는 자리(EVT-05)가 읽는 넷.
//
// **막는 것은 서버다.** 화면은 '설문 링크 활성화'를 그리지만 무엇이 모자란지를 세지
// 않는다 — 세면 조직의 규칙이 화면에 적히고, 규칙이 바뀔 때마다 화면을 고쳐야 한다.
// 그래서 조건 목록과 못 채운 수가 **한 함수에서** 나와야 한다. 두 곳에서 세면
// 목록에는 빨간 줄이 둘인데 딱지는 '미충족 3개'라고 말하는 날이 온다.
//
// **조건 목록은 그림이 든다.** 명세의 조각은 모양만 말하는데(묶음·줄·색), 무엇을
// 채워야 하는지는 EVT-05가 열여섯 줄로 그려 두었다. 그중 셋은 여기서 짓지 못한다 —
// '이름 필수 문항'·'학번 필수 문항'·'학생회비 대조용 식별 문항'은 **어느 문항이
// 그것인지를 표가 모른다**(`survey_questions`에 구실을 적는 열이 없다). 지어내지
// 않고 그 줄을 빼 둔다.

let db: Db
let close: () => Promise<void>

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(events).values([
    // 다 채운 행사. 아홉 줄이 전부 초록이어야 한다.
    {
      id: 'E-01',
      orgId: 'ORG-01',
      title: '2026 소프트웨어융합대학 체육대회',
      startAt: new Date('2026-08-20T10:00:00+09:00'),
      endAt: new Date('2026-08-20T17:00:00+09:00'),
      place: 'ERICA 체육관',
      audience: '소프트웨어융합대학 전체',
      feeType: 'duesConditional',
      paidAmount: 0,
      unpaidAmount: 5000,
      payGuide: '농협 123-456 (예금주 학생회)',
      capacityType: 'limited',
      capacityCount: 200,
    },
    // 설문을 아직 안 만든 행사.
    { id: 'E-02', orgId: 'ORG-01', title: '2026 신입생 환영회' },
    // 행사명 말고는 아무것도 안 채운 행사.
    { id: 'E-03', orgId: 'ORG-01', title: '2026 학술제' },
    // **안 정하기로 한 행사.** 비어 있는 것과 다른 사실이라 표가 그 둘을 갈라 둔다.
    {
      id: 'E-04',
      orgId: 'ORG-01',
      title: '2026 동아리 박람회',
      startAt: new Date('2026-09-01T13:00:00+09:00'),
      endUnset: true,
      placeUnset: true,
    },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사' },
  ])
  await db.insert(surveys).values([
    {
      id: 'S-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      linkToken: 'TOKEN-E01',
      active: false,
      opensAt: new Date('2026-08-01T09:00:00+09:00'),
      closesAt: new Date('2026-08-15T18:00:00+09:00'),
      completionTitle: '신청이 완료되었습니다.',
      duesCheck: true,
      waitlist: true,
      applyMethod: 'approval',
    },
    // 아무것도 안 정한 설문. **빈 한 줄이지 없는 것이 아니다.**
    { id: 'S-03', orgId: 'ORG-01', eventId: 'E-03', linkToken: 'TOKEN-E03' },
    { id: 'S-04', orgId: 'ORG-01', eventId: 'E-04', linkToken: 'TOKEN-E04' },
    { id: 'S-99', orgId: 'ORG-02', eventId: 'E-99', linkToken: 'TOKEN-E99' },
  ])
  await db.insert(surveyQuestions).values([
    {
      id: 'SQ-01',
      orgId: 'ORG-01',
      surveyId: 'S-01',
      sortOrder: 0,
      title: '이름',
      type: 'short',
      required: true,
      locked: true,
    },
    {
      id: 'SQ-02',
      orgId: 'ORG-01',
      surveyId: 'S-01',
      sortOrder: 1,
      title: '학년',
      type: 'choice',
      required: true,
    },
    // 안 물어도 되는 문항. 딱지가 하나도 안 붙는다.
    {
      id: 'SQ-03',
      orgId: 'ORG-01',
      surveyId: 'S-01',
      sortOrder: 2,
      title: '참여 동기',
      type: 'checkbox',
    },
    {
      id: 'SQ-04',
      orgId: 'ORG-01',
      surveyId: 'S-01',
      sortOrder: 3,
      title: '개인정보 수집·이용 동의',
      type: 'privacy',
      required: true,
      locked: true,
    },
  ])
})

afterAll(async () => {
  await close()
})

type Row = Record<string, unknown>

const at = (eventId: string, tail: string) =>
  harness(db).request(`/api/ops/events/${eventId}/survey${tail}`)

const settings = (eventId = 'E-01') => at(eventId, '/settings')
const activation = (eventId = 'E-01') => at(eventId, '/activation')
const conditions = (eventId = 'E-01') => at(eventId, '/activation/conditions')
const questions = (eventId = 'E-01') => at(eventId, '/questions')

/** 묶음을 펼친 줄 전부. 못 채운 수를 딱지와 견주는 데 쓴다. */
function allRows(groups: Row[]): Row[] {
  return groups.flatMap((group) => group.rows as Row[])
}

describe('모집 설정(event.surveySettingsDraft)', () => {
  // **칸은 칸으로 준다**(EVT-02B의 초안과 같은 규칙). 빈 칸에 '미정' 같은 말을
  // 넣으면 사람이 그것을 지우지 않고 저장한다.
  it('고칠 칸을 그 칸이 읽는 꼴로 준다', async () => {
    expect(await (await settings()).json()).toEqual({
      applyStart: '2026-08-01T09:00',
      applyEnd: '2026-08-15T18:00',
      applyMethod: 'approval',
      waitlist: true,
      duesCheck: 'y',
      completionNote: '신청이 완료되었습니다.',
    })
  })

  // 표가 참거짓으로 아는 둘은 늘 오고, 나머지는 값이 있을 때만 붙는다.
  it('아무것도 안 정한 설문은 빈 칸이 아예 안 온다', async () => {
    expect(await (await settings('E-03')).json()).toEqual({
      applyMethod: 'firstCome',
      waitlist: false,
    })
  })

  // **없는 것은 없다고 한다.** 빈 초안을 주면 '아직 안 만들었다'와 '비워 두었다'가
  // 같아진다(`event.survey`가 이미 같은 답을 한다).
  it('설문이 없으면 없다고 한다', async () => {
    expect((await settings('E-02')).status).toBe(404)
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await settings('E-99')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(matchesContract('event.surveySettingsDraft', await (await settings()).json())).toBe(true)
  })
})

describe('활성화 조건(event.surveyActivationConditions)', () => {
  // 행사 기본정보에서 채울 것과 설문 설정에서 채울 것이 갈린다.
  it('묶음 둘로 온다', async () => {
    const groups = (await (await conditions()).json()) as Row[]
    expect(groups.map((group) => group.groupLabel)).toEqual(['행사 기본정보', '참여 설문 설정'])
  })

  it('다 채운 행사는 모든 줄이 초록이다', async () => {
    const rows = allRows((await (await conditions()).json()) as Row[])
    expect(rows.filter((row) => row.tone !== 'green')).toEqual([])
    expect(rows.map((row) => row.key)).toEqual([
      'title',
      'startAt',
      'endAt',
      'place',
      'audience',
      'feeType',
      'feeAmounts',
      'capacityType',
      'capacity',
      'applyEnd',
      'applyOrder',
      'applyMethod',
      'privacyConsent',
    ])
  })

  // **어디서 채우는지를 서버가 말한다.** 화면이 갈 곳을 정하면 조건이 늘 때마다
  // 화면을 고쳐야 한다 — 명세는 targetKind를 화면 id가 아니라고 못 박았다.
  it('못 채운 줄은 어디서 채우는지까지 안고 온다', async () => {
    const rows = allRows((await (await conditions('E-03')).json()) as Row[])
    const place = rows.find((row) => row.key === 'place')!
    expect(place).toMatchObject({
      label: '장소',
      met: '',
      tone: 'red',
      locationNote: '입력 위치: 행사 기본정보 → 장소',
      actionLabel: '기본정보에서 수정 →',
      targetKind: 'basics',
    })
    const applyEnd = rows.find((row) => row.key === 'applyEnd')!
    expect(applyEnd).toMatchObject({
      label: '신청 마감 일시',
      met: '',
      tone: 'red',
      locationNote: '입력 위치: 모집 설정',
      actionLabel: '모집 설정에서 입력 →',
      targetKind: 'surveySettings',
    })
  })

  // 채워진 줄은 갈 곳도 까닭도 안 붙는다 — 계약이 '갈 곳이 없으면 오지 않는다'고 적었다.
  it('채운 줄에는 갈 곳이 안 붙는다', async () => {
    const rows = allRows((await (await conditions()).json()) as Row[])
    const title = rows.find((row) => row.key === 'title')!
    expect(title).toEqual({ key: 'title', label: '행사명', met: 'y', tone: 'green' })
  })

  // **종료 일시를 안 적은 것과 안 정하기로 한 것은 다른 사실이다**(표가 그 둘을 갈라 둔다).
  it('안 정하기로 한 것은 못 채운 것이 아니다', async () => {
    const rows = allRows((await (await conditions('E-04')).json()) as Row[])
    for (const key of ['endAt', 'place']) {
      expect(rows.find((row) => row.key === key)).toMatchObject({ met: 'y', tone: 'green' })
    }
  })

  it('설문이 없으면 없다고 한다', async () => {
    expect((await conditions('E-02')).status).toBe(404)
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await conditions('E-99')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(
      matchesContract('event.surveyActivationConditions', await (await conditions()).json()),
    ).toBe(true)
  })
})

describe('켤 수 있는가(event.surveyActivation)', () => {
  it('다 채웠으면 켤 수 있다', async () => {
    expect(await (await activation()).json()).toEqual({
      unmetCountNote: '미충족 0개',
      unmetCount: 0,
      canActivate: true,
    })
  })

  // **딱지의 수와 목록의 빨간 줄이 같은 셈에서 나온다.** 두 곳에서 세면 언젠가 갈린다.
  it('못 채운 수가 조건 목록과 같다', async () => {
    const badge = (await (await activation('E-03')).json()) as Row
    const rows = allRows((await (await conditions('E-03')).json()) as Row[])
    const unmet = rows.filter((row) => row.tone === 'red').length
    expect(badge.unmetCount).toBe(unmet)
    expect(badge.unmetCountNote).toBe(`미충족 ${unmet}개`)
    expect(badge.canActivate).toBe(false)
    expect(badge.blockedNote).toBe(`아직 채우지 않은 활성화 조건이 ${unmet}개 있습니다.`)
  })

  it('설문이 없으면 없다고 한다', async () => {
    expect((await activation('E-02')).status).toBe(404)
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await activation('E-99')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(matchesContract('event.surveyActivation', await (await activation()).json())).toBe(true)
  })
})

describe('설문 문항(event.surveyQuestions)', () => {
  // 갈래의 말은 **명세가 든다**(`event.surveyQuestionTypes`). 여기 다시 적으면 두 벌이 갈린다.
  it('적어 둔 차례로 오고 갈래를 말로 옮겨 준다', async () => {
    const rows = (await (await questions()).json()) as Row[]
    expect(rows.map((row) => row.title)).toEqual([
      '이름',
      '학년',
      '참여 동기',
      '개인정보 수집·이용 동의',
    ])
    expect(rows.map((row) => row.typeLabel)).toEqual([
      '단답형',
      '객관식',
      '체크박스',
      '개인정보 동의',
    ])
  })

  // 딱지의 개수가 데이터에 달렸다 — 안 물어도 되는 문항에는 하나도 안 붙는다.
  it('필수와 잠김이 딱지가 된다', async () => {
    const rows = (await (await questions()).json()) as Row[]
    expect(rows[0]).toMatchObject({
      badges: [{ label: '필수 · 삭제 불가', tone: 'gray' }],
      locked: 'y',
    })
    expect(rows[1]!.badges).toEqual([{ label: '필수', tone: 'blue' }])
    expect(rows[1]!.locked).toBeUndefined()
    expect(rows[2]!.badges).toEqual([])
  })

  it('문항이 하나도 없으면 빈 목록이다', async () => {
    expect(await (await questions('E-03')).json()).toEqual([])
  })

  it('설문이 없으면 없다고 한다', async () => {
    expect((await questions('E-02')).status).toBe(404)
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await questions('E-99')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(matchesContract('event.surveyQuestions', await (await questions()).json())).toBe(true)
  })
})
