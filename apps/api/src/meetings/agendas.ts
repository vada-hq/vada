import type { Db } from '../db/client.ts'
import { agendasOf, meetingOf } from './detail.ts'
import { word } from './meetings.ts'

export interface MeetingAgenda {
  agendaId: string
  orderLabel: string
  title: string
  description: string
  durationNote: string
  status: string
  statusTone: string
  isCurrent?: boolean
  discussionText: string
  decisionText: string
  decisionEmptyNote: string
  summaryLine: string
  decisionCountNote: string
  taskCountNote: string
}

export const AGENDA_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: '대기', tone: 'yellow' },
  current: { label: '진행 중', tone: 'green' },
  done: { label: '논의 완료', tone: 'gray' },
}

const NO_DECISION =
  '아직 결정사항이 정리되지 않았습니다. 오른쪽 패널에서 작성하거나 ‘결정사항 없음’을 선택하세요.'

/** 회의 단계에 맞춰 안건 목록을 화면용 데이터로 만든다. */
export async function meetingAgendaList(
  db: Db,
  orgId: string,
  meetingId: string,
): Promise<MeetingAgenda[]> {
  await meetingOf(db, orgId, meetingId)
  const rows = await agendasOf(db, orgId, meetingId)
  return rows.map((row, at) => {
    const isCurrent = row.status === 'current'
    const drawnStatus = AGENDA_STATUS[row.status]
    const decision = word(row.decisionText)
    const drawn: MeetingAgenda = {
      agendaId: row.id,
      orderLabel: `안건 ${at + 1}`,
      title: row.title,
      description: word(row.description) ?? '',
      durationNote:
        row.plannedMinutes === null ? '' : `${isCurrent ? '예상 ' : ''}${row.plannedMinutes}분`,
      status: drawnStatus?.label ?? '',
      statusTone: drawnStatus?.tone ?? '',
      discussionText: word(row.discussionText) ?? '',
      decisionText: decision ?? '',
      decisionEmptyNote: decision === null ? NO_DECISION : '',
      summaryLine: '',
      decisionCountNote: `결정 ${decision === null ? 0 : 1}`,
      taskCountNote: '',
    }
    if (isCurrent) drawn.isCurrent = true
    return drawn
  })
}
