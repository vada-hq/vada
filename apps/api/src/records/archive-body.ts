import type { Db } from '../db/client.ts'
import { archiveOf } from './archive-facts.ts'
import { liveArchiveBody } from './archive-body-live.ts'
import type { FrozenArchive } from './archive-body-types.ts'

export type {
  ArchiveDetail,
  AutoFilled,
  EvidenceRow,
  FrozenArchive,
  TimelineRow,
} from './archive-body-types.ts'

// 발행 전에는 현재 데이터로 만들고, 발행 뒤에는 저장된 스냅샷만 읽는다.
// freezeArchive도 같은 liveArchiveBody를 호출해 두 경로의 본문 계산이 갈리지 않는다.

/**
 * 이 문서의 자동 본문. **굳은 값이 있으면 그것이고, 없으면 지금 값이다.**
 */
export async function archiveBody(
  db: Db,
  orgId: string,
  eventId: string,
  now: Date,
): Promise<FrozenArchive> {
  const archive = await archiveOf(db, orgId, eventId)
  const frozen = archive.row?.frozen
  if (frozen !== null && frozen !== undefined) return asFrozen(frozen)
  return liveArchiveBody(db, orgId, archive.event, archive.row, now)
}

/**
 * 지금 값을 계약의 모양으로 굳힌다. **발행하는 변이가 이것을 `frozen`에 넣는다.**
 *
 * 굳은 값이 이미 있어도 늘 지금 값을 본다 — 굳히는 일과 읽는 일은 다른 물음이다.
 * 표에 쓰지는 않는다: 언제 누가 발행했는지와 함께 한 번에 써야 하고 그것은 발행
 * 변이의 일이다.
 */
export async function freezeArchive(
  db: Db,
  orgId: string,
  eventId: string,
  now: Date,
): Promise<FrozenArchive> {
  const archive = await archiveOf(db, orgId, eventId)
  return liveArchiveBody(db, orgId, archive.event, archive.row, now)
}

export const archiveDetail = async (db: Db, orgId: string, eventId: string, now: Date) =>
  (await archiveBody(db, orgId, eventId, now)).detail
export const archiveTimeline = async (db: Db, orgId: string, eventId: string, now: Date) =>
  (await archiveBody(db, orgId, eventId, now)).timeline
export const archiveEvidence = async (db: Db, orgId: string, eventId: string, now: Date) =>
  (await archiveBody(db, orgId, eventId, now)).evidence
export const archiveAutoFilled = async (db: Db, orgId: string, eventId: string, now: Date) =>
  (await archiveBody(db, orgId, eventId, now)).autoFilled

/**
 * 표에 든 굳은 값이 계약의 모양인가.
 *
 * **모양이 다르면 터뜨린다.** 조용히 지금 값으로 대신하면 발행된 문서가 원본을 따라
 * 바뀌는데 아무도 모른다 — 그것이 이 자리가 막으려는 바로 그 일이다.
 */
function asFrozen(value: unknown): FrozenArchive {
  const frozen = value as Partial<FrozenArchive> | null
  if (
    frozen === null ||
    typeof frozen !== 'object' ||
    typeof frozen.detail !== 'object' ||
    frozen.detail === null ||
    !Array.isArray(frozen.timeline) ||
    !Array.isArray(frozen.evidence) ||
    typeof frozen.autoFilled !== 'object' ||
    frozen.autoFilled === null
  ) {
    throw new Error('아카이브의 굳은 값이 계약의 모양이 아닙니다')
  }
  return {
    detail: frozen.detail,
    timeline: frozen.timeline,
    evidence: frozen.evidence,
    autoFilled: frozen.autoFilled,
  }
}
