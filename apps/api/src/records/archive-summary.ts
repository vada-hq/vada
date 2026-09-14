import type { Db } from '../db/client.ts'
import { joinParts } from '../finance/labels.ts'
import { clock, day, weekdayStamp } from '../time.ts'
import { archiveOf, memberNameOf, type ArchiveEvent } from './archive-facts.ts'
import { ARCHIVE } from './completed.ts'
import { archiveStatusOf as statusOf, archiveWord as word } from './archive-shared.ts'

/**
 * AI 초안이 무엇을 하고 무엇을 하지 않는지.
 *
 * **화면에 적힌 이 글이 곧 그 동작의 계약이다**(REC-02A 30:4211). 명세가 이 문장을
 * 들면 초안이 하는 일이 바뀔 때 명세가 틀린다 — 그래서 서버가 든다(`meeting.minutes`의
 * aiDisclaimer와 같은 자리).
 */
const AI_DISCLAIMER =
  'AI 초안은 이 행사의 업무·회의·문서·정산 기록만 재구성하며, 기록에 없는 자산·연락처·담당자를 새로 만들지 않습니다. 생성 후 반드시 검토·수정해 확정하세요.'

export interface RecordArchive {
  title: string
  statusLabel: string
  statusTone: string
  scheduleNote?: string
  ownerNote?: string
  publishedNote?: string
  authorNote?: string
  nextOwnerNote?: string
  aiDisclaimer?: string
}

/** `2026. 05. 28 (목) 11:00–17:00`. 요일은 시간대를 아는 곳(`time.ts`)이 만든 것에서 집는다. */
function scheduleNoteOf(event: ArchiveEvent): string {
  if (event.startAt === null) return '일시 미정'
  const weekday = /\((.+?)\)/.exec(weekdayStamp(event.startAt))?.[1] ?? ''
  const start = `${day(event.startAt)} (${weekday}) ${clock(event.startAt)}`
  if (event.endAt === null) return start
  return day(event.endAt) === day(event.startAt)
    ? `${start}–${clock(event.endAt)}`
    : `${start}–${day(event.endAt)} ${clock(event.endAt)}`
}

/**
 * 문서 자체(`record.archive`).
 *
 * 쓰는 화면은 이름과 상태만 읽고(그리고 AI 계약 문장), 발행된 문서는 누가 언제 쓰고
 * 발행했는지까지 읽는다 — '발행된 문서에만 온다'는 조각은 발행 전에는 오지 않는다.
 * 검토자 조각(`reviewerNote`)도 그중 하나라 발행이 생기는 날 함께 온다.
 */
export async function recordArchive(db: Db, orgId: string, eventId: string): Promise<RecordArchive> {
  const { event, row } = await archiveOf(db, orgId, eventId)
  const status = statusOf(row)
  const drawn: RecordArchive = {
    // 문서의 이름이 비어 있으면 행사 이름이 곧 문서의 이름이다.
    title: word(row?.title) ?? event.title,
    statusLabel: ARCHIVE[status].label,
    statusTone: ARCHIVE[status].tone,
  }
  if (status !== 'published') {
    drawn.aiDisclaimer = AI_DISCLAIMER
    return drawn
  }
  drawn.scheduleNote = scheduleNoteOf(event)
  drawn.ownerNote =
    joinParts([
      event.hostDepartment,
      event.hostMember === null ? null : `책임자 ${event.hostMember}`,
    ]) || '담당 미정'
  if (row?.publishedAt) drawn.publishedNote = `발행 ${day(row.publishedAt)}`
  const author = await memberNameOf(db, orgId, row?.authorMemberId ?? null)
  if (author !== null) drawn.authorNote = `작성 ${author}`
  const nextOwner = word(row?.nextOwner)
  if (nextOwner !== null) drawn.nextOwnerNote = `다음 담당: ${nextOwner}`
  return drawn
}
