import type { Db } from '../db/client.ts'
import { archiveOf, type ArchiveRow } from './archive-facts.ts'
import { archiveStatusOf as statusOf, archiveWord as word } from './archive-shared.ts'

export interface ConditionRow {
  key: string
  label: string
  met: string
  tone: string
}

/**
 * 그림이 그린 여섯 조건(REC-02A 30:4237). 전부 사람이 쓰는 칸이 비었는지다.
 */
const CONDITIONS = [
  { key: 'onSite', label: '현장 운영 기록', field: 'onSiteOperation' },
  { key: 'retroGood', label: '회고 · 잘된 점', field: 'retroGood' },
  { key: 'retroIssues', label: '회고 · 미흡했던 점과 원인', field: 'retroIssues' },
  { key: 'retroImprovements', label: '회고 · 다음 행사 개선안', field: 'retroImprovements' },
  { key: 'handover', label: '인수인계 내용', field: 'handover' },
  { key: 'nextOwner', label: '다음 담당자 지정', field: 'nextOwner' },
] as const

export type ConditionKey = (typeof CONDITIONS)[number]['key']

const MET = { met: 'y', tone: 'green' } as const
const UNMET = { met: '', tone: 'orange' } as const

/** 조건 목록과 채운 수가 **여기 한 셈**에서 나온다. */
export function archiveConditionsOf(row: ArchiveRow | null): Array<ConditionRow & { key: ConditionKey }> {
  return CONDITIONS.map((condition) => ({
    key: condition.key,
    label: condition.label,
    ...(word(row?.[condition.field]) === null ? UNMET : MET),
  }))
}

export async function archiveGateConditions(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<ConditionRow[]> {
  const { row } = await archiveOf(db, orgId, eventId)
  return archiveConditionsOf(row)
}

export interface ArchiveGate {
  metCountNote: string
  blockedNote?: string
}

/**
 * 다음 단계로 넘길 수 있는가(REC-02A의 단추가 읽는다).
 *
 * **같은 목록을 세어서 답한다.** 조건이 늘거나 줄면 수도 함께 움직인다. 이미 발행된
 * 문서는 조건과 상관없이 다시 넘길 수 없다 — 발행은 한 번이다.
 */
export async function archiveGate(db: Db, orgId: string, eventId: string): Promise<ArchiveGate> {
  const { row } = await archiveOf(db, orgId, eventId)
  const conditions = archiveConditionsOf(row)
  const unmet = conditions.filter((condition) => condition.met === '').length
  const gate: ArchiveGate = { metCountNote: `${conditions.length - unmet} / ${conditions.length}` }
  if (statusOf(row) === 'published') gate.blockedNote = '이미 발행된 문서입니다.'
  else if (unmet > 0) gate.blockedNote = `아직 채우지 않은 발행 조건이 ${unmet}개 있습니다.`
  return gate
}
