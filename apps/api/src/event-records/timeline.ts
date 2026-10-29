import { and, asc, eq, isNull } from 'drizzle-orm'
import {
  RECORD_TIMELINE_KINDS,
  type EventChange,
  type EventVersion,
  type RecordTimelineEntry,
  type SettlementApproval,
} from '@vada/contracts'
import { meeting, record } from '../db/schema.js'
import type { Db } from '../db/types.js'

type Reader = Pick<Db, 'select'>

// 타임라인 줄의 짧은 글. 화면은 종류로 꾸미고 이 글을 그대로 보인다(회의는 회의 제목).
const FIELD_LABEL: Record<Exclude<EventChange['field'], 'created'>, string> = {
  name: '이름',
  startsAt: '일시',
  endsAt: '일시',
  place: '장소',
  owner: '책임자',
}
const FIELD_ORDER = ['이름', '일시', '장소', '책임자']
const CREATED_TEXT = '행사 만듦'
const COMPLETION_TEXT = { completed: '완료', completion_cancelled: '완료 취소' } as const

// 판 하나의 줄. 만듦, 또는 이름·일시·장소·책임자가 바뀐 판만 줄이다(이전 행사처럼 다른 칸만 바뀐 판은 없다).
function versionLine(version: EventVersion): RecordTimelineEntry | null {
  const base = { at: version.at, by: version.by, recordId: null }
  if (version.changes.some(change => change.field === 'created'))
    return { ...base, kind: 'created', text: CREATED_TEXT }
  const labels = new Set(
    version.changes.flatMap(change =>
      change.field === 'created' ? [] : FIELD_LABEL[change.field],
    ),
  )
  if (!labels.size) return null
  const text = `${FIELD_ORDER.filter(label => labels.has(label)).join('·')} 변경`
  return { ...base, kind: 'changed', text }
}

// 이 행사에 이은 취소하지 않은 회의. 회의 시각에 둔다.
async function meetingLinesOf(db: Reader, councilId: string, eventId: string) {
  const rows = await db
    .select({ id: meeting.id, title: meeting.title, heldAt: meeting.heldAt })
    .from(meeting)
    .innerJoin(record, eq(record.id, meeting.id))
    .where(
      and(
        eq(record.councilId, councilId),
        eq(meeting.eventId, eventId),
        isNull(meeting.cancelledAt),
      ),
    )
    .orderBy(asc(meeting.heldAt), asc(meeting.id))
  return rows.map((row): RecordTimelineEntry => ({
    kind: 'meeting',
    at: row.heldAt.toISOString(),
    text: row.title,
    by: null,
    recordId: row.id,
  }))
}

const kindRank = (entry: RecordTimelineEntry) => RECORD_TIMELINE_KINDS.indexOf(entry.kind)

// 행사 기록의 타임라인: 만듦, 정보 변경(events/history.ts eventHistoryOf), 회의, 완료와 완료 취소(completionApprovalsOf).
// 시각은 모두 ISO라 글자 순서가 시간 순서다. 같은 시각이면 종류 차례, 그다음 들어온 차례다(정렬은 안정적이다).
export async function timelineOf(
  db: Reader,
  scope: { councilId: string; eventId: string },
  sources: { history: EventVersion[]; approvals: SettlementApproval[] },
): Promise<RecordTimelineEntry[]> {
  const versions = sources.history.flatMap(version => versionLine(version) ?? [])
  const completions = sources.approvals.map((item): RecordTimelineEntry => ({
    kind: item.outcome,
    at: item.at,
    text: COMPLETION_TEXT[item.outcome],
    by: item.by,
    recordId: null,
  }))
  const meetings = await meetingLinesOf(db, scope.councilId, scope.eventId)
  return [...versions, ...meetings, ...completions].sort((a, b) =>
    a.at < b.at ? -1 : a.at > b.at ? 1 : kindRank(a) - kindRank(b),
  )
}
