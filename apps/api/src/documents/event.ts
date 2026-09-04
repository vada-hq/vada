import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { documents, events, members } from '../db/schema.ts'
import {
  categoryTones,
  type DocumentStatus,
  NO_CATEGORY,
  NO_CATEGORY_TONE,
  NO_DESCRIPTION,
  phaseOf,
  readFilter,
  STATUS,
  updatedNote,
} from './labels.ts'

// 행사의 공용 문서(EVT-DOC-01)와 그 위의 타일·개수.
//
// **행사에 딸린 문서가 곧 행사의 공용 원본이다.** 업무가 내놓은 문서와 회의에 붙은
// 자료는 같은 표에 있지만 이 목록에 들지 않는다 — 명세가 그 둘을 따로 묻고
// (`task.workDocuments` · `meeting.documents`), 참고 문서가 '업무의 것이 아니라
// 행사의 공용 원본'이라고 못 박았기 때문이다. 여기서 거르지 않으면 EVT-DOC-01의
// 표와 EVT-TASK-02의 참고 문서가 같은 행사에서 서로 다른 줄을 보게 된다.
//
// **거르는 것도 세는 것도 서버가 한다.** 목록은 고른 상태로 걸러서 오고, 타일과
// 거르개 옆의 개수는 **고른 상태와 무관하게** 그 행사 전체를 센다 — 거른 뒤에 세면
// 하나를 고르는 순간 나머지 선택지의 개수가 0이 된다.

/**
 * 그 행사의 공용 문서를 고르는 조건.
 *
 * **울타리를 조회가 든다.** 행사 id만으로 집어 오면 주소에 남의 학생회 행사 id를
 * 적은 사람이 그 행사의 문서 이름을 본다.
 */
export function eventOwnDocuments(orgId: string, eventId: string) {
  return and(
    eq(documents.orgId, orgId),
    eq(documents.eventId, eventId),
    // 업무에 매인 것도 회의에 붙은 것도 행사의 공용 원본이 아니다.
    isNull(documents.taskId),
    isNull(documents.meetingId),
  )
}

const ROW = {
  id: documents.id,
  category: documents.category,
  title: documents.title,
  description: documents.description,
  status: documents.status,
  updatedAt: documents.updatedAt,
  editorName: members.name,
}

/**
 * 그 학생회의 그 행사에 딸린 공용 문서들.
 *
 * **이어 붙인 표도 자기 조직을 확인한다.** 손댄 사람을 id로만 이으면 남의 조직의
 * 이름이 우리 표에 그려진다 — 표가 그것을 막게 되어 있지만 여기도 함께 건다
 * (업무 보드가 같은 벽을 두 겹으로 세웠다).
 */
export async function eventDocumentRows(db: Db, orgId: string, eventId: string) {
  return db
    .select(ROW)
    .from(documents)
    .leftJoin(
      members,
      and(eq(documents.updatedByMemberId, members.id), eq(members.orgId, orgId)),
    )
    .where(eventOwnDocuments(orgId, eventId))
}

type Row = Awaited<ReturnType<typeof eventDocumentRows>>[number]

/**
 * 줄의 차례.
 *
 * **명세도 그림도 차례를 말하지 않는다.** 안 정하면 저장소가 주는 대로 그려져
 * 새로고침마다 줄이 자리를 바꾼다. 이 표가 무엇을 위해 있는지를 따른다: 문서는
 * 행사의 국면을 따라 놓이므로 국면끼리 모으고, 같은 국면 안에서는 이름순이다.
 * **국면이 아직 없는 문서는 뒤로** — 없는 것을 있는 것 사이에 끼우지 않는다.
 */
export function byPhase(
  left: { category: string | null; title: string },
  right: { category: string | null; title: string },
): number {
  const key = (category: string | null) => {
    const phase = phaseOf(category)
    return phase === null ? '1' : `0${phase}`
  }
  return (
    key(left.category).localeCompare(key(right.category)) ||
    left.title.localeCompare(right.title)
  )
}

export interface EventDocument {
  id: string
  category: string
  title: string
  description: string
  status: string
  statusTone: string
  tone: string
  updatedNote: string
}

/**
 * 행사 문서 표의 줄들(`event.documents`).
 *
 * **완성된 글과 색으로 온다.** 화면이 상태를 말로 옮기거나 때와 사람을 잇지 않는다.
 */
export async function eventDocuments(
  db: Db,
  orgId: string,
  eventId: string,
  asked: { status?: string },
): Promise<EventDocument[]> {
  const wanted = readFilter(asked.status)
  const tones = await categoryTones(db, orgId)
  const rows = await eventDocumentRows(db, orgId, eventId)

  return rows
    .filter((row) => wanted === null || row.status === wanted)
    .sort(byPhase)
    .map((row) => documentRow(row, tones))
}

/** 한 줄. 참고 문서와 같은 표를 읽으므로 옮기는 규칙도 한 벌이다. */
function documentRow(row: Row, tones: Map<string, string>): EventDocument {
  const phase = phaseOf(row.category)
  const status: DocumentStatus = row.status
  return {
    // 표에 그려지지 않지만 눌러서 문서를 열 때 '어느 문서인지'로 넘어간다.
    id: row.id,
    category: phase ?? NO_CATEGORY,
    title: row.title,
    description: row.description ?? NO_DESCRIPTION,
    status: STATUS[status].label,
    statusTone: STATUS[status].tone,
    tone: phase === null ? NO_CATEGORY_TONE : (tones.get(phase) ?? NO_CATEGORY_TONE),
    updatedNote: updatedNote(status, row.updatedAt, row.editorName),
  }
}

/**
 * 그 학생회에 그 행사가 있는가.
 *
 * **없는 것과 남의 것은 밖에서 같은 답이어야 한다** — 갈려 보이면 남의 행사가
 * 있는지를 주소로 물어볼 수 있게 된다.
 */
async function eventExists(db: Db, orgId: string, eventId: string): Promise<boolean> {
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1)
  return rows.length > 0
}

/** 상태별로 몇인가. 타일과 거르개가 같은 셈을 본다. */
async function countByStatus(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<Record<DocumentStatus, number> & { all: number }> {
  const rows = await db
    .select({ status: documents.status })
    .from(documents)
    .where(eventOwnDocuments(orgId, eventId))
  const count = (status: DocumentStatus) => rows.filter((row) => row.status === status).length
  return {
    all: rows.length,
    notStarted: count('notStarted'),
    drafting: count('drafting'),
    reviewing: count('reviewing'),
    confirmed: count('confirmed'),
  }
}

export interface EventDocumentStats {
  total: string
  totalNote: string
  drafting: string
  draftingNote: string
  reviewing: string
  reviewingNote: string
}

/**
 * 머리의 타일 셋(`event.documentStats`).
 *
 * **값에 단위까지 붙어서 온다** — 명세가 그렇게 적었고, 화면이 숫자에 '개'를 붙이면
 * 세는 것과 부르는 말이 화면마다 갈린다.
 *
 * 곁들이는 문구는 **타일이 무엇을 말하는 자리인지**를 알리는 것이라 수와 함께
 * 흔들리지 않는다. 명세가 그 문구를 조각으로 두었으므로 서버가 만들어 보낸다.
 */
export async function eventDocumentStats(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<EventDocumentStats | null> {
  if (!(await eventExists(db, orgId, eventId))) return null
  const counts = await countByStatus(db, orgId, eventId)
  return {
    total: `${counts.all}개`,
    totalNote: '행사 공용 문서',
    drafting: `${counts.drafting}개`,
    draftingNote: '계속 확인이 필요해요',
    reviewing: `${counts.reviewing}개`,
    reviewingNote: '의견 확인이 필요해요',
  }
}

export interface EventDocumentStatusCounts {
  all: number
  drafting: number
  reviewing: number
  confirmed: number
  notStarted: number
}

/**
 * 거르개의 선택지마다 곁들이는 개수(`event.documentStatusCounts`).
 *
 * **조각의 이름이 선택지의 값과 같다**(`event.documentStatus`). 선택지는 명세에
 * 고정이고 개수만 데이터가 준다 — 그래서 여기서 '전체'까지 함께 센다.
 */
export async function eventDocumentStatusCounts(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<EventDocumentStatusCounts | null> {
  if (!(await eventExists(db, orgId, eventId))) return null
  const counts = await countByStatus(db, orgId, eventId)
  return {
    all: counts.all,
    drafting: counts.drafting,
    reviewing: counts.reviewing,
    confirmed: counts.confirmed,
    notStarted: counts.notStarted,
  }
}
