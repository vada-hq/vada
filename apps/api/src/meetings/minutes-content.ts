import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { meetingAgendas } from '../db/schema.ts'
import { orNote, word } from './meetings.ts'
import { linkedTaskCount, minutesRow } from './minutes-records.ts'
import { decided } from './minutes-progress.ts'

const UNSETTLED = { label: '정리 중 · 변경될 수 있음', tone: 'yellow' } as const
const AI_DISCLAIMER =
  'AI 초안은 안건별 논의·결정 기록만 재구성하며, 기록에 없는 결정·담당자·기한을 새로 만들지 않습니다.\n' +
  '요약이 없어도 정리 완료가 막히지는 않습니다.'
const NO_SUMMARY = '아직 작성된 전체 요약이 없습니다'

export interface MeetingMinutes {
  summaryText: string
  statusLabel: string
  statusTone: string
  aiDisclaimer: string
}

export async function meetingMinutes(
  db: Db,
  orgId: string,
  meetingId: string,
): Promise<MeetingMinutes> {
  const row = await minutesRow(db, orgId, meetingId)
  const settled = row.minutesStatus === 'done'
  return {
    summaryText: orNote(row.minutesSummary, NO_SUMMARY),
    statusLabel: settled ? '' : UNSETTLED.label,
    statusTone: settled ? '' : UNSETTLED.tone,
    aiDisclaimer: AI_DISCLAIMER,
  }
}

export interface MinutesPart {
  label: string
  stateNote: string
}

export async function meetingMinutesStatus(
  db: Db,
  orgId: string,
  meetingId: string,
): Promise<{ parts: MinutesPart[] }> {
  const row = await minutesRow(db, orgId, meetingId)
  const agendas = await db
    .select({ status: meetingAgendas.status, decisionText: meetingAgendas.decisionText })
    .from(meetingAgendas)
    .where(and(eq(meetingAgendas.orgId, orgId), eq(meetingAgendas.meetingId, meetingId)))
  const linked = await linkedTaskCount(db, orgId, meetingId)
  const tidied = agendas.filter((one) => one.status === 'done').length
  const decisions = agendas.filter(decided).length
  return {
    parts: [
      { label: '안건 내용', stateNote: `${tidied} / ${agendas.length} 정리` },
      { label: '의사결정', stateNote: `${decisions}건 확인` },
      { label: '후속 업무', stateNote: `${linked}건 연결` },
      {
        label: '전체 요약',
        stateNote: word(row.minutesSummary) === null ? '작성 전' : '초안 작성',
      },
    ],
  }
}
