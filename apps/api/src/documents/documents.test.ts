import { beforeAll, describe, expect, it } from 'vitest'
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  documents,
  events,
  meetingAgendas,
  meetings,
  members,
  organizations,
  tasks,
} from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import type { Viewer } from '../permissions.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'

// 문서(EVT-DOC-01 · OPS-MEET-03A/05A/07 · EVT-TASK-02).
//
// **화면 다섯이 한 표를 본다.** 명세가 그렇게 말한다 — 회의 쪽은 '안건의 사전 자료와
// 회의록의 관련 자료가 같은 물건'이라 적었고, 업무 쪽은 참고 문서가 '업무의 것이
// 아니라 행사의 공용 원본이라 여러 업무가 같은 것을 본다'고 적었다. 그래서 이
// 파일도 화면이 아니라 표를 따라 갈렸다.
//
// 이 파일이 재는 것이 여섯이다.
//
// 1. **거르는 것을 서버가 한다.** 상태 거르개가 고른 값을 인자로 받아 서버가
//    거른다 — 목록을 통째로 보내고 화면이 거르면 거르개 옆의 개수가 화면마다 갈린다.
// 2. **세는 것도 서버가 한다.** 머리의 타일과 거르개 옆의 개수는 **고른 상태와
//    무관하게** 그 행사의 문서 전체를 센다. 거른 뒤에 세면 하나를 고르는 순간
//    나머지 선택지의 개수가 0이 된다.
// 3. **완성된 글과 색을 준다.** '4개'·'07. 18 · 박해랑'·'green'을 서버가 만든다.
//    화면이 숫자에 '개'를 붙이거나 상태를 말로 옮기지 않는다.
// 4. **한 표를 세 자리가 같은 모양으로 읽는다.** 행사 문서 표에 그려지는 줄과
//    업무의 참고 문서가 같은 줄이다 — 업무에 매인 문서는 어느 쪽에도 공용 원본으로
//    끼지 않는다.
// 5. **없는 것은 없다고 말한다.** 계약이 404를 둔 자리(타일·개수·회의 자료)는
//    없으면 404이고, 목록인 자리는 빈 목록이 곧 '없다'는 답이다.
// 6. **울타리가 선다.** 남의 학생회 문서도, 다른 행사·다른 회의·다른 업무의 문서도
//    섞이지 않는다.

let db: Db

/** 오늘. 문서의 때는 저장된 값이 정하지만, 앱을 세우려면 이 값이 있어야 한다. */
const NOW = new Date('2026-07-21T10:00:00+09:00')

function viewer(orgId = 'ORG-01', memberId = 'M-01'): Viewer {
  return {
    userId: 'U-01',
    membership: {
      orgId,
      memberId,
      role: 'member',
      departmentId: 'D-01',
      inFinanceDepartment: false,
    },
  }
}

function harness(who: Viewer | null = viewer()) {
  const deps: Deps = {
    audit: { async write() {} },
    db,
    who: async () => who,
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
    },
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    newId: () => 'X-01',
  }
  return createApp(deps)
}

type Row = Record<string, unknown>

const ask = (path: string, who?: Viewer) => harness(who ?? viewer()).request(path)
const list = async (path: string, who?: Viewer): Promise<Row[]> =>
  (await (await ask(path, who)).json()) as Row[]
const one = async (path: string, who?: Viewer): Promise<Row> =>
  (await (await ask(path, who)).json()) as Row

const eventDocuments = (status = 'all', eventId = 'E-01') =>
  list(`/api/ops/event/documents?eventId=${eventId}&status=${status}`)
const titles = (rows: Row[]) => rows.map((row) => String(row.title))

const at = (text: string) => new Date(`${text}+09:00`)

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회', term: '2026' },
    // **옆 학생회를 하나 더 둔다.** 울타리를 재려면 넘어갈 담이 있어야 한다.
    { id: 'ORG-02', name: '옆 학생회' },
  ])

  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '박해랑' },
    { id: 'M-02', orgId: 'ORG-01', name: '이수현' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의 사람' },
  ])

  await db.insert(events).values([
    { id: 'E-01', orgId: 'ORG-01', title: '2026 소프트웨어융합대학 체육대회' },
    { id: 'E-02', orgId: 'ORG-01', title: '2026 신입생 환영회' },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사' },
  ])

  await db.insert(meetings).values([
    { id: 'MTG-01', orgId: 'ORG-01', eventId: 'E-01', title: '체육대회 준비 회의' },
    { id: 'MTG-02', orgId: 'ORG-01', title: '정기 운영회의' },
    { id: 'MTG-99', orgId: 'ORG-02', title: '남의 회의' },
  ])

  // 안건의 차례가 곧 회의가 진행되는 차례다.
  await db.insert(meetingAgendas).values([
    { id: 'AG-01', orgId: 'ORG-01', meetingId: 'MTG-01', sortOrder: 0, title: '안전 계획' },
    { id: 'AG-02', orgId: 'ORG-01', meetingId: 'MTG-01', sortOrder: 1, title: '비상 연락' },
  ])

  await db.insert(tasks).values([
    { id: 'T-01', orgId: 'ORG-01', eventId: 'E-01', title: '현수막 디자인 확정' },
    // 행사에 걸리지 않은 상시 업무. 따를 **행사의** 공용 원본이 없다.
    { id: 'T-02', orgId: 'ORG-01', title: '게시판 공지물 정리' },
    { id: 'T-99', orgId: 'ORG-02', title: '남의 업무' },
  ])

  await db.insert(documents).values([
    // ── 행사의 공용 문서(EVT-DOC-01의 표 · EVT-TASK-02의 참고 문서) ────────
    {
      id: 'DOC-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      category: '기획',
      title: '행사 운영 계획서',
      description: '운영 목표, 역할 분담, 당일 진행 순서',
      status: 'confirmed',
      updatedByMemberId: 'M-02',
      updatedAt: at('2026-07-12T09:30:00'),
    },
    {
      id: 'DOC-02',
      orgId: 'ORG-01',
      eventId: 'E-01',
      category: '운영',
      title: '안전 관리 체크리스트',
      description: '현장 안전 점검 및 비상 대응 항목',
      status: 'reviewing',
      updatedByMemberId: 'M-01',
      updatedAt: at('2026-07-18T14:00:00'),
    },
    // **손댄 사람이 남지 않은 문서.** 때는 아는데 누구인지는 모른다.
    {
      id: 'DOC-03',
      orgId: 'ORG-01',
      eventId: 'E-01',
      category: '참가자',
      title: '참가자 명단 최종본',
      description: '신청·납부·참석 확인 기준의 최종 명단',
      status: 'drafting',
      updatedAt: at('2026-07-19T11:00:00'),
    },
    // 아직 아무도 손대지 않은 문서. 분류도 아직 없다.
    {
      id: 'DOC-04',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '행사 결과 보고서',
      status: 'notStarted',
      updatedAt: at('2026-07-01T09:00:00'),
    },

    // ── 업무가 내놓은 문서(EVT-TASK-02의 작업 문서) ──────────────────────
    //
    // **행사를 함께 가리켜도 행사의 공용 원본이 아니다** — 업무에 매인 것이다.
    {
      id: 'DOC-05',
      orgId: 'ORG-01',
      eventId: 'E-01',
      taskId: 'T-01',
      title: '현수막 시안 v2.png',
      status: 'reviewing',
      updatedAt: at('2026-07-20T10:00:00'),
    },
    {
      id: 'DOC-06',
      orgId: 'ORG-01',
      taskId: 'T-01',
      title: '현수막 디자인 작업 노트',
      status: 'drafting',
      updatedAt: at('2026-07-20T11:00:00'),
    },

    // ── 회의에 붙은 자료(OPS-MEET-03A · 05A · 07) ────────────────────────
    {
      id: 'DOC-07',
      orgId: 'ORG-01',
      eventId: 'E-01',
      meetingId: 'MTG-01',
      agendaId: 'AG-01',
      title: '체육대회_안전점검표.pdf',
      status: 'confirmed',
      updatedAt: at('2026-07-15T09:00:00'),
    },
    {
      id: 'DOC-08',
      orgId: 'ORG-01',
      meetingId: 'MTG-01',
      agendaId: 'AG-02',
      title: '비상연락망_초안.xlsx',
      status: 'drafting',
      updatedAt: at('2026-07-16T09:00:00'),
    },
    // 회의 전체에 붙은 자료. 어느 안건의 것도 아니다.
    {
      id: 'DOC-09',
      orgId: 'ORG-01',
      meetingId: 'MTG-01',
      title: '지난 회의 결과 요약.docx',
      status: 'confirmed',
      updatedAt: at('2026-07-14T09:00:00'),
    },
    { id: 'DOC-10', orgId: 'ORG-01', meetingId: 'MTG-02', title: '다른 회의 자료.pdf' },

    // ── 섞이면 안 되는 것들 ──────────────────────────────────────────────
    { id: 'DOC-11', orgId: 'ORG-01', eventId: 'E-02', category: '기획', title: '환영회 기획안' },
    { id: 'DOC-91', orgId: 'ORG-02', eventId: 'E-99', category: '기획', title: '남의 행사 문서' },
    { id: 'DOC-92', orgId: 'ORG-02', meetingId: 'MTG-99', title: '남의 회의 자료.pdf' },
    { id: 'DOC-93', orgId: 'ORG-02', taskId: 'T-99', title: '남의 업무 문서' },
  ])
}, 60_000)

describe('행사 문서 표가 저장소에서 온다(EVT-DOC-01)', () => {
  // 차례는 **국면 → 제목**이다. 명세도 그림도 차례를 말하지 않는데, 안 정하면
  // 저장소가 주는 대로 그려져 새로고침마다 줄이 자리를 바꾼다.
  it('이 행사의 공용 문서만 국면 차례로 온다', async () => {
    const rows = await eventDocuments()
    expect(titles(rows)).toEqual([
      '행사 운영 계획서',
      '안전 관리 체크리스트',
      '참가자 명단 최종본',
      // 국면이 아직 없는 문서는 뒤로 — 없는 것을 있는 것 사이에 끼우지 않는다.
      '행사 결과 보고서',
    ])
  })

  // **업무에 매인 문서도 회의에 붙은 자료도 행사의 공용 원본이 아니다.**
  // 명세가 그 둘을 따로 묻는다(task.workDocuments · meeting.documents).
  it('업무 문서·회의 자료·다른 행사·남의 학생회 문서가 섞이지 않는다', async () => {
    const drawn = titles(await eventDocuments()).join(' ')
    expect(drawn).not.toContain('현수막 시안 v2.png')
    expect(drawn).not.toContain('체육대회_안전점검표.pdf')
    expect(drawn).not.toContain('환영회 기획안')
    expect(drawn).not.toContain('남의 행사 문서')
  })

  // **거르는 것을 서버가 한다.** 받아온 것을 화면에서 거르지 않는다.
  it('고른 상태로 서버가 거른다', async () => {
    expect(titles(await eventDocuments('reviewing'))).toEqual(['안전 관리 체크리스트'])
    expect(titles(await eventDocuments('confirmed'))).toEqual(['행사 운영 계획서'])
    expect(titles(await eventDocuments('notStarted'))).toEqual(['행사 결과 보고서'])
  })

  it('완성된 글과 색이 서버에서 온다', async () => {
    const rows = await eventDocuments('reviewing')
    expect(rows[0]).toEqual({
      id: 'DOC-02',
      category: '운영',
      title: '안전 관리 체크리스트',
      description: '현장 안전 점검 및 비상 대응 항목',
      status: '검토 중',
      statusTone: 'yellow',
      // 줄 왼쪽 강조선의 색은 그 문서가 속한 국면이 정한다.
      tone: 'amber',
      updatedNote: '07. 18 · 박해랑',
    })
  })

  // **아직 시작하지 않은 문서는 언제 쓸 것인지로 온다** — 명세가 그렇게 적었다.
  it('아직 시작하지 않은 문서는 손댄 때 대신 언제 쓸 것인지가 온다', async () => {
    const row = (await eventDocuments('notStarted'))[0]!
    expect(row.updatedNote).toBe('행사 종료 후')
    // 분류가 아직 없으면 그 사실이 말로 오고, 색은 '색이 없다'는 뜻의 무채색이다.
    expect(row.category).toBe('분류 미정')
    expect(row.tone).toBe('gray')
  })

  // **손댄 사람이 없는 것과 손댄 적이 없는 것은 다르다.**
  it('손댄 사람이 안 남았으면 그 사실이 말로 온다', async () => {
    expect((await eventDocuments('drafting'))[0]?.updatedNote).toBe('07. 19 · 기록 없음')
  })

  it('명세에 없는 상태로 물으면 막는다', async () => {
    expect((await ask('/api/ops/event/documents?eventId=E-01&status=거의다됨')).status).toBe(422)
  })

  // 목록인 자리는 계약이 404를 두지 않았다 — 빈 목록이 곧 '없다'는 답이다.
  it('남의 학생회 행사의 문서는 한 줄도 오지 않는다', async () => {
    expect(await eventDocuments('all', 'E-99')).toEqual([])
  })
})

describe('머리의 타일이 저장소에서 온다(event.documentStats)', () => {
  // **화면이 숫자에 단위를 붙이지 않는다.**
  it('값에 단위까지 붙어서 온다', async () => {
    expect(await one('/api/ops/event/documents/stats?eventId=E-01')).toEqual({
      total: '4개',
      totalNote: '행사 공용 문서',
      drafting: '1개',
      draftingNote: '계속 확인이 필요해요',
      reviewing: '1개',
      reviewingNote: '의견 확인이 필요해요',
    })
  })

  // **없는 것과 남의 것이 밖에서 같은 답이다.** 답이 서버의 말인지도 함께 잰다 —
  // 자리가 안 붙어 있어도 404가 오므로, 그것만 재면 안 붙은 것을 못 본다.
  it('없는 행사도 남의 학생회 행사도 없다고 말한다', async () => {
    for (const eventId of ['E-77', 'E-99']) {
      const answer = await ask(`/api/ops/event/documents/stats?eventId=${eventId}`)
      expect(answer.status).toBe(404)
      expect(((await answer.json()) as Row).message).toBe('그 행사를 찾지 못했습니다')
    }
  })
})

describe('거르개 옆의 개수가 저장소에서 온다(event.documentStatusCounts)', () => {
  // **고른 상태와 무관하게 그 행사의 문서 전체를 센다.** 거른 뒤에 세면 하나를
  // 고르는 순간 나머지 선택지의 개수가 0이 된다.
  it('선택지마다의 개수를 서버가 센다', async () => {
    expect(await one('/api/ops/event/documents/counts?eventId=E-01')).toEqual({
      all: 4,
      drafting: 1,
      reviewing: 1,
      confirmed: 1,
      notStarted: 1,
    })
  })

  it('없는 행사도 남의 학생회 행사도 없다고 말한다', async () => {
    for (const eventId of ['E-77', 'E-99']) {
      const answer = await ask(`/api/ops/event/documents/counts?eventId=${eventId}`)
      expect(answer.status).toBe(404)
      expect(((await answer.json()) as Row).message).toBe('그 행사를 찾지 못했습니다')
    }
  })
})

describe('회의 자료가 저장소에서 온다(OPS-MEET-03A · 05A · 07)', () => {
  // **안건의 사전 자료와 회의록의 관련 자료가 같은 물건이다.**
  it('회의 전체 자료가 먼저, 안건 자료는 안건 차례로 온다', async () => {
    const rows = await list('/api/ops/meetings/MTG-01/documents')
    expect(rows.map((row) => row.name)).toEqual([
      '지난 회의 결과 요약.docx',
      '체육대회_안전점검표.pdf',
      '비상연락망_초안.xlsx',
    ])
  })

  // **없으면 오지 않는다** — 명세가 optional로 적었고, 빈 글을 주면 화면이
  // '어느 안건의 것도 아니다'와 '안건 이름이 비었다'를 가릴 수 없다.
  it('안건의 자료면 agendaId가 함께 오고 회의 전체 자료면 오지 않는다', async () => {
    const rows = await list('/api/ops/meetings/MTG-01/documents')
    expect(rows[0]).toEqual({ documentId: 'DOC-09', name: '지난 회의 결과 요약.docx' })
    expect(rows[1]).toMatchObject({ documentId: 'DOC-07', agendaId: 'AG-01' })
    expect('agendaId' in rows[0]!).toBe(false)
  })

  it('다른 회의 자료가 섞이지 않는다', async () => {
    const drawn = (await list('/api/ops/meetings/MTG-01/documents'))
      .map((row) => String(row.name))
      .join(' ')
    expect(drawn).not.toContain('다른 회의 자료.pdf')
  })

  it('없는 회의도 남의 학생회 회의도 없다고 말한다', async () => {
    for (const meetingId of ['MTG-77', 'MTG-99']) {
      const answer = await ask(`/api/ops/meetings/${meetingId}/documents`)
      expect(answer.status).toBe(404)
      expect(((await answer.json()) as Row).message).toBe('그 회의를 찾지 못했습니다')
    }
  })
})

describe('업무의 참고 문서가 저장소에서 온다(EVT-TASK-02)', () => {
  // **업무의 것이 아니라 행사의 공용 원본이다** — 행사 문서 표가 그리는 그 줄이다.
  it('그 업무가 딸린 행사의 공용 원본이 온다', async () => {
    const rows = await list('/api/ops/task/reference-documents?taskId=T-01')
    expect(titles(rows)).toEqual([
      '행사 운영 계획서',
      '안전 관리 체크리스트',
      '참가자 명단 최종본',
      '행사 결과 보고서',
    ])
    // 그 업무가 내놓은 문서는 참고할 원본이 아니다.
    expect(titles(rows).join(' ')).not.toContain('현수막 시안 v2.png')
  })

  it('완성된 글과 색이 서버에서 온다', async () => {
    const rows = await list('/api/ops/task/reference-documents?taskId=T-01')
    expect(rows[0]).toEqual({
      title: '행사 운영 계획서',
      description: '운영 목표, 역할 분담, 당일 진행 순서',
      lastModifiedNote: '최종 수정일 2026-07-12',
      status: '확정',
      statusTone: 'green',
    })
  })

  it('행사에 걸리지 않은 업무는 따를 공용 원본이 없다', async () => {
    expect(await list('/api/ops/task/reference-documents?taskId=T-02')).toEqual([])
  })

  it('남의 학생회 업무의 문서는 한 줄도 오지 않는다', async () => {
    expect(await list('/api/ops/task/reference-documents?taskId=T-99')).toEqual([])
  })
})

describe('업무의 작업 문서가 저장소에서 온다(EVT-TASK-02)', () => {
  it('그 업무가 내놓은 문서만 온다', async () => {
    const rows = await list('/api/ops/task/work-documents?taskId=T-01')
    expect(titles(rows)).toEqual(['현수막 디자인 작업 노트', '현수막 시안 v2.png'])
  })

  // 표가 담는 것은 **이름과 상태**뿐이다 — 파일인지는 이름이 말한다.
  it('파일인지 문서인지가 이름에서 오고 상태가 말과 색으로 온다', async () => {
    const rows = await list('/api/ops/task/work-documents?taskId=T-01')
    expect(rows[1]).toEqual({
      title: '현수막 시안 v2.png',
      kind: '파일',
      status: '검토 중',
      statusTone: 'yellow',
      officialReflection: '미반영',
    })
    expect(rows[0]).toMatchObject({ kind: '문서', status: '작성 중', statusTone: 'blue' })
  })

  it('남의 학생회 업무의 문서는 한 줄도 오지 않는다', async () => {
    expect(await list('/api/ops/task/work-documents?taskId=T-99')).toEqual([])
  })
})
