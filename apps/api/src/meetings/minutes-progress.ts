import type { Db } from '../db/client.ts'
import { word } from './meetings.ts'
import { agendaRecordsOf, linkedTaskCount, minutesRow } from './minutes-records.ts'

export function decided(agenda: { decisionText: string | null; noDecision?: boolean }): boolean {
  return word(agenda.decisionText) !== null || agenda.noDecision === true
}

export function followedUp(
  agendas: ReadonlyArray<{ noFollowUp?: boolean }>,
  linkedTasks: number,
): boolean {
  return linkedTasks > 0 || (agendas.length > 0 && agendas.every((one) => one.noFollowUp === true))
}

function ended(status: string): boolean {
  return status === 'wrapUp' || status === 'done'
}

function flag(value: boolean): string {
  return value ? 'y' : ''
}

const AGENDAS_LEFT = '안건별 필수 정리를 완료해 주세요'
const NOT_ENDED = '회의가 끝난 뒤에 정리를 마칠 수 있습니다'
const ALREADY_DONE = '이미 정리가 끝난 회의록입니다'

export interface MinutesCondition {
  label: string
  done: string
  optional?: string
}

export interface MinutesProgress {
  requiredDoneNote: string
  blockedNote?: string
  canComplete: boolean
  conditions: MinutesCondition[]
}

export async function minutesProgress(
  db: Db,
  orgId: string,
  meetingId: string,
): Promise<MinutesProgress> {
  const row = await minutesRow(db, orgId, meetingId)
  const agendas = await agendaRecordsOf(db, orgId, meetingId)
  const linked = await linkedTaskCount(db, orgId, meetingId)
  const closed = ended(row.status)
  const conditions: MinutesCondition[] = [
    { label: '안건별 논의 내용', done: flag(closed) },
    { label: '결정사항 또는 없음 표시', done: flag(agendas.every(decided)) },
    { label: '후속 업무 또는 없음 표시', done: flag(followedUp(agendas, linked)) },
    { label: '참가 결과', done: flag(closed) },
    { label: '회의 전체 요약 (선택)', done: flag(word(row.minutesSummary) !== null), optional: 'y' },
  ]
  const required = conditions.filter((one) => one.optional === undefined)
  const met = required.filter((one) => one.done !== '').length
  const settled = row.minutesStatus === 'done'
  const answer: MinutesProgress = {
    requiredDoneNote: `필수 ${met} / ${required.length}`,
    canComplete: met === required.length && !settled,
    conditions,
  }
  if (settled) answer.blockedNote = ALREADY_DONE
  else if (!closed) answer.blockedNote = NOT_ENDED
  else if (met < required.length) answer.blockedNote = AGENDAS_LEFT
  return answer
}
