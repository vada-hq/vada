import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  attendanceQrs,
  departments,
  documents,
  events,
  meetings,
  members,
  organizations,
  students,
  surveyApplications,
  surveys,
  tasks,
} from '../db/schema.ts'
import { hashToken } from '../public/tokens.ts'
import { harness, matchesContract, NOW, viewer } from './testing.ts'

// 행사 개요(EVT-02)가 읽는 여섯 자리.
//
// **여기 있는 것은 전부 세어서 만든 말이다.** 표에 '모집 마감까지 3일'이라는 열은
// 없고, 있는 것은 설문의 마감 시각과 지금뿐이다 — 오늘이 언제인지는 서버만 안다.
//
// **'확인이 필요한 신청자'가 무엇인지가 이 파일이 지키는 규칙이다.** 명세가 그
// 까닭을 '학번·이름 불일치 또는 명단 외 학생'이라고 적었으므로, 학생 명단
// (`students`)과 대조해 어긋난 신청만 센다 — 납부 미확인은 여기 들지 않는다.
// 납부 상태는 기본이 '모름'이라, 그것을 섞으면 아무 일도 없는 행사에서 신청자
// 전원이 '확인 필요'가 된다.

let db: Db
let close: () => Promise<void>

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    // 울타리를 재려면 넘어갈 담이 있어야 한다.
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '학술체육부' },
    { id: 'D-02', orgId: 'ORG-01', name: '기획부' },
  ])
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '김바다', role: 'chair' },
    { id: 'M-02', orgId: 'ORG-01', name: '이윤슬', role: 'head', departmentId: 'D-02' },
  ])

  // **학생 명단.** 신청자가 이 명단과 어긋나는지가 '확인 필요'의 유일한 근거다.
  await db.insert(students).values([
    { id: 'ST-01', orgId: 'ORG-01', name: '김학생', studentNumber: '2026001' },
    { id: 'ST-02', orgId: 'ORG-01', name: '이학생', studentNumber: '2026002' },
  ])

  await db.insert(events).values([
    {
      id: 'E-01',
      orgId: 'ORG-01',
      title: '2026 소프트웨어융합대학 체육대회',
      status: 'planning',
      startAt: new Date('2026-08-20T10:00:00+09:00'),
      place: 'ERICA 체육관',
      capacityType: 'limited',
      capacityCount: 200,
      hostDepartmentId: 'D-01',
      hostMemberId: 'M-01',
      createdAt: new Date('2026-08-01T09:00:00+09:00'),
      updatedAt: new Date('2026-08-15T09:30:00+09:00'),
    },
    // **아무것도 안 채운 행사.** 없는 것이 아니라 비어 있다 — 그 사실이 말로 와야 한다.
    {
      id: 'E-02',
      orgId: 'ORG-01',
      title: '2026 신입생 환영회',
      status: 'planning',
      createdAt: new Date('2026-08-02T09:00:00+09:00'),
      updatedAt: new Date('2026-08-02T09:00:00+09:00'),
    },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사' },
  ])

  // 설문 하나와 낸 신청 셋. 하나는 명단과 맞고 둘은 어긋난다.
  await db.insert(surveys).values({
    id: 'S-01',
    orgId: 'ORG-01',
    eventId: 'E-01',
    linkToken: 'SURVEY-TOKEN',
    active: true,
    closesAt: new Date('2026-08-18T23:59:00+09:00'),
    applyMethod: 'firstCome',
    createdAt: new Date('2026-08-05T09:00:00+09:00'),
  })
  await db.insert(surveyApplications).values([
    {
      id: 'SA-01',
      surveyId: 'S-01',
      name: '김학생',
      studentNumber: '2026001',
      payStatus: 'paid',
      receiptHash: 'HASH-SA-01',
      receiptExpiresAt: NOW,
      privacyConsentAt: NOW,
      at: new Date('2026-08-15T10:30:00+09:00'),
    },
    // 학번은 명단에 있는데 **이름이 다르다.**
    {
      id: 'SA-02',
      surveyId: 'S-01',
      name: '박다름',
      studentNumber: '2026002',
      payStatus: 'unpaid',
      receiptHash: 'HASH-SA-02',
      receiptExpiresAt: NOW,
      privacyConsentAt: NOW,
      at: new Date('2026-08-15T10:40:00+09:00'),
    },
    // 명단에 아예 없는 학번.
    {
      id: 'SA-03',
      surveyId: 'S-01',
      name: '최나래',
      studentNumber: '2026999',
      receiptHash: 'HASH-SA-03',
      receiptExpiresAt: NOW,
      privacyConsentAt: NOW,
      at: new Date('2026-08-14T16:20:00+09:00'),
    },
  ])

  await db.insert(tasks).values([
    {
      id: 'T-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '참가자 모집 공지 작성',
      status: 'inProgress',
      departmentId: 'D-02',
      assigneeMemberId: 'M-02',
      dueDate: new Date('2026-08-20T18:00:00+09:00'),
      createdAt: new Date('2026-08-10T09:00:00+09:00'),
      updatedAt: new Date('2026-08-13T09:00:00+09:00'),
    },
    // 담당자가 없다. 개요의 강조 카드가 이것을 센다.
    {
      id: 'T-02',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '행사장 안전 점검',
      status: 'planned',
      departmentId: 'D-01',
      dueDate: new Date('2026-08-18T18:00:00+09:00'),
      createdAt: new Date('2026-08-11T09:00:00+09:00'),
      updatedAt: new Date('2026-08-11T09:00:00+09:00'),
    },
    {
      id: 'T-03',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '참가자 명단 최종 확정',
      status: 'planned',
      createdAt: new Date('2026-08-12T09:00:00+09:00'),
      updatedAt: new Date('2026-08-12T09:00:00+09:00'),
    },
    // 끝난 업무는 '담당자 없는 업무'도 '남은 업무'도 아니다.
    {
      id: 'T-04',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '운영 계획 확정',
      status: 'done',
      createdAt: new Date('2026-08-03T09:00:00+09:00'),
      updatedAt: new Date('2026-08-04T09:00:00+09:00'),
    },
  ])

  await db.insert(documents).values({
    id: 'DOC-01',
    orgId: 'ORG-01',
    eventId: 'E-01',
    title: '행사 운영 계획서',
    status: 'confirmed',
    createdAt: new Date('2026-08-06T09:00:00+09:00'),
    updatedAt: new Date('2026-08-06T09:00:00+09:00'),
  })

  await db.insert(meetings).values({
    id: 'MTG-01',
    orgId: 'ORG-01',
    eventId: 'E-01',
    kind: 'event',
    title: '체육대회 운영 점검 회의',
    status: 'scheduled',
    scheduledAt: new Date('2026-08-19T10:00:00+09:00'),
    creatorMemberId: 'M-02',
    createdAt: new Date('2026-08-07T09:00:00+09:00'),
    updatedAt: new Date('2026-08-07T09:00:00+09:00'),
  })

  await db.insert(attendanceQrs).values({
    id: 'QR-01',
    orgId: 'ORG-01',
    eventId: 'E-01',
    tokenHash: hashToken('AAAAAAAAAAAAAAAAAAAAAA'),
    active: true,
    opensAt: new Date('2026-08-20T09:00:00+09:00'),
    closesAt: new Date('2026-08-20T18:00:00+09:00'),
  })
})

afterAll(async () => {
  await close()
})

const get = (path: string, eventId = 'E-01', who = viewer()) =>
  harness(db, { who }).request(`${path}?eventId=${encodeURIComponent(eventId)}`)

const read = async (path: string, eventId = 'E-01') =>
  (await (await get(path, eventId)).json()) as Record<string, string>

const readList = async (path: string, eventId = 'E-01') =>
  (await (await get(path, eventId)).json()) as Array<Record<string, string>>

const BRIEFING = '/api/ops/event/overview/briefing'
const HIGHLIGHTS = '/api/ops/event/overview/highlights'
const STATS = '/api/ops/event/participant-stats'
const RECRUIT = '/api/ops/event/recruit-settings'
const CHECKLIST = '/api/ops/event/checklist'
const CHANGES = '/api/ops/event/recent-changes'

describe('개요 맨 위의 안내(event.overviewBriefing)', () => {
  it('지금 봐야 할 것을 완성된 문장으로 잇는다', async () => {
    const body = await read(BRIEFING)
    expect(body.headline).toBe(
      '모집 마감까지 3일 남았습니다. 정원 200명 중 3명이 신청했습니다. 명단 확인이 필요한 신청자가 2명 있습니다.',
    )
    expect(body.stateNote).toBe('현재 상태: 기획 중 · 다음 운영 단계는 행사 진행입니다.')
  })

  // **비어 있는 것도 말로 온다.** 화면이 빈 글을 보고 '미입력'을 지어내면 그 말이
  // 화면에 박힌다.
  it('아무것도 안 채운 행사는 무엇이 없는지 말한다', async () => {
    const body = await read(BRIEFING, 'E-02')
    expect(body.headline).toBe(
      '참여 설문을 아직 만들지 않았습니다. 아직 정하지 않은 것이 있습니다: 일시 · 장소 · 담당.',
    )
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await get(BRIEFING, 'E-99')).status).toBe(404)
    expect((await get(BRIEFING, 'E-없음')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    for (const eventId of ['E-01', 'E-02']) {
      expect(matchesContract('event.overviewBriefing', await read(BRIEFING, eventId))).toBe(true)
    }
  })
})

describe('개요의 강조 카드 셋(event.overviewHighlights)', () => {
  it('담당자 없는 업무와 확인 필요 신청자를 센다', async () => {
    const body = await read(HIGHLIGHTS)
    expect(body.unassignedTasks).toBe('2건')
    // 마감이 이른 것부터. 기한 없는 것은 뒤로 간다.
    expect(body.unassignedTasksDetail).toBe('행사장 안전 점검 · 참가자 명단 최종 확정')
    expect(body.needsCheck).toBe('2명')
    expect(body.needsCheckDetail).toBe('학번·이름 불일치 또는 명단 외 학생')
  })

  // **다음 핵심 일정은 일정 화면과 같은 세 원본에서 온다** — 업무 마감·회의 일시·
  // 행사 당일. 앞으로 올 것 중 가장 이른 것이다.
  it('다음 핵심 일정을 세 원본에서 골라 온다', async () => {
    const body = await read(HIGHLIGHTS)
    expect(body.nextMilestone).toBe('행사장 안전 점검')
    expect(body.nextMilestoneDetail).toBe('08.18 · 담당자 없음 · 배정 필요')
  })

  it('셀 것이 없으면 없다고 말한다', async () => {
    const body = await read(HIGHLIGHTS, 'E-02')
    expect(body.unassignedTasks).toBe('0건')
    expect(body.unassignedTasksDetail).toBe('담당자 없는 업무가 없습니다')
    expect(body.needsCheck).toBe('0명')
    expect(body.needsCheckDetail).toBe('확인이 필요한 신청자가 없습니다')
    expect(body.nextMilestone).toBe('다음 일정이 아직 없습니다')
    expect(body.nextMilestoneDetail).toBe('앞으로 잡힌 일정이 없습니다')
  })

  it('답이 계약의 모양을 지킨다', async () => {
    for (const eventId of ['E-01', 'E-02']) {
      expect(matchesContract('event.overviewHighlights', await read(HIGHLIGHTS, eventId))).toBe(true)
    }
  })
})

describe('참가 현황 타일 넷(event.participantStats)', () => {
  it('신청·납부·확인 필요·미배정을 센다', async () => {
    const body = await read(STATS)
    expect(body.applicants).toBe('3명')
    expect(body.applicantsNote).toBe('정원 200명')
    expect(body.paid).toBe('1명')
    // **미납과 미확인은 다른 사실이다.** 표가 셋을 갈라 두었으므로 세는 말도 갈린다.
    expect(body.paidNote).toBe('미납 1명 · 미확인 1명')
    expect(body.needsCheck).toBe('2명')
    expect(body.needsCheckNote).toBe('명단 불일치')
    expect(body.unassignedTasks).toBe('2개')
    expect(body.unassignedTasksNote).toBe('처리 필요')
  })

  it('정원을 안 정한 행사는 그 사실이 온다', async () => {
    const body = await read(STATS, 'E-02')
    expect(body.applicants).toBe('0명')
    expect(body.applicantsNote).toBe('정원 미정')
    expect(body.paidNote).toBe('미납 0명')
  })

  it('답이 계약의 모양을 지킨다', async () => {
    for (const eventId of ['E-01', 'E-02']) {
      expect(matchesContract('event.participantStats', await read(STATS, eventId))).toBe(true)
    }
  })
})

describe('모집 설정(event.recruitSettings)', () => {
  it('설문의 상태·기간·방식·신청자를 그대로 말한다', async () => {
    const body = await read(RECRUIT)
    expect(body.surveyStatus).toBe('활성')
    expect(body.period).toBe('마감 2026. 08. 18')
    // 신청 방식의 말은 **명세가 갖고 있다**(event.surveyApplyMethods).
    expect(body.method).toBe('선착순')
    expect(body.applicantCount).toBe('3명')
  })

  it('설문이 없으면 없다고 한다', async () => {
    const body = await read(RECRUIT, 'E-02')
    expect(body.surveyStatus).toBe('아직 없음')
    expect(body.period).toBe('기간 미입력')
    expect(body.method).toBe('미정')
    expect(body.applicantCount).toBe('0명')
  })

  it('답이 계약의 모양을 지킨다', async () => {
    for (const eventId of ['E-01', 'E-02']) {
      expect(matchesContract('event.recruitSettings', await read(RECRUIT, eventId))).toBe(true)
    }
  })
})

describe('지금 확인해야 할 항목(event.checklist)', () => {
  // **개수도 내용도 행사의 상태가 정한다.** 참인 것만 온다.
  it('참인 것만 급한 차례로 온다', async () => {
    const rows = await readList(CHECKLIST)
    expect(rows.map((row) => [row.title, row.tone])).toEqual([
      ['담당자 없는 업무 2개', 'red'],
      ['모집 마감까지 3일 남았습니다', 'orange'],
      ['명단 확인이 필요한 신청자 2명', 'yellow'],
      ['QR 참석 확인 설정 완료', 'green'],
    ])
  })

  // **갈 곳이 있는 항목에만 문구가 온다**(계약이 둘을 optional로 적었다).
  it('갈 곳이 있는 항목만 열쇠와 문구를 갖는다', async () => {
    const rows = await readList(CHECKLIST)
    const byTitle = new Map(rows.map((row) => [row.title, row]))
    expect(byTitle.get('담당자 없는 업무 2개')).toMatchObject({
      targetKind: 'tasks',
      actionLabel: '업무 보기',
      detail: '행사장 안전 점검 · 참가자 명단 최종 확정',
    })
    expect(byTitle.get('명단 확인이 필요한 신청자 2명')).toMatchObject({
      targetKind: 'participants',
      actionLabel: '참가자 명단 보기',
      detail: '학번·이름 불일치 또는 명단 외 학생',
    })
    expect(byTitle.get('모집 마감까지 3일 남았습니다')).not.toHaveProperty('targetKind')
    expect(byTitle.get('QR 참석 확인 설정 완료')).not.toHaveProperty('actionLabel')
  })

  it('확인할 것이 없으면 비어서 온다', async () => {
    expect(await readList(CHECKLIST, 'E-02')).toEqual([])
  })

  // **계약이 이 자리에 404를 두지 않았다.** 남의 행사를 물으면 거르고 남은 것이 없다.
  it('울타리 밖은 빈 목록이다', async () => {
    expect((await get(CHECKLIST, 'E-99')).status).toBe(200)
    expect(await readList(CHECKLIST, 'E-99')).toEqual([])
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(matchesContract('event.checklist', await readList(CHECKLIST))).toBe(true)
  })
})

describe('최근 변경 사항(event.recentChanges)', () => {
  // **표는 무엇이 바뀌었는지가 아니라 언제 바뀌었는지를 안다.** 그래서 줄은 무엇이
  // 손댄 것인지와 더해진 것인지 고쳐진 것인지까지만 말한다.
  it('오늘·어제 같은 상대적인 말로 때를 만든다', async () => {
    const rows = await readList(CHANGES)
    expect(rows[0]).toEqual({ at: '오늘 10:40', title: '신규 신청자 2명 추가' })
    expect(rows[1]).toEqual({ at: '오늘 09:30', title: '행사 기본정보 수정' })
    expect(rows[2]).toEqual({ at: '어제 16:20', title: '신규 신청자 1명 추가' })
  })

  // 최근의 것만이다. 전부 주면 '최근'이 아니다.
  it('다섯 줄까지만 온다', async () => {
    expect((await readList(CHANGES)).length).toBe(5)
  })

  it('울타리 밖은 빈 목록이다', async () => {
    expect(await readList(CHANGES, 'E-99')).toEqual([])
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(matchesContract('event.recentChanges', await readList(CHANGES))).toBe(true)
  })
})
