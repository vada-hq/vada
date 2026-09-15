import type { Db } from '../db/client.ts'
import { NotFound } from '../errors.ts'
import { daysBetween } from '../time.ts'
import { eventFacts, type EventFacts, type OpenTask } from './counts.ts'
import { eventCapacityLabel } from './participation-labels.ts'

/** 이 학생회의 그 행사. **없으면 404다** — 계약이 이 자리들에 404를 두었다. */
export async function must(db: Db, orgId: string, eventId: string): Promise<EventFacts> {
  const row = await eventFacts(db, orgId, eventId)
  if (row === null) throw new NotFound('그 행사를 찾지 못했습니다')
  return row
}

/** 모집이 언제 닫히는가를 **남은 날로** 말한다. 오늘이 언제인지는 서버만 안다. */
export function deadlineNote(closesAt: Date, now: Date): string {
  const days = daysBetween(now, closesAt)
  if (days > 0) return `모집 마감까지 ${days}일 남았습니다`
  if (days === 0) return '오늘 모집이 마감됩니다'
  return `모집이 ${-days}일 전에 마감되었습니다`
}

/**
 * 정원. **'제한 없음'과 '아직 안 정했다'는 다른 사실이다** — 표가 그 둘을
 * `capacityType`으로 갈라 두었으므로 말도 갈린다.
 */
export function capacityNote(row: EventFacts): string {
  return eventCapacityLabel({ ...row, capacity: null }, '정원 미정')
}

/** 확인이 왜 필요한지. **명세가 이 말을 적어 두었다**(event.checklist의 detail). */
export const NEEDS_CHECK_REASON = '학번·이름 불일치 또는 명단 외 학생'

/** 담당자가 아직 없는 업무. 끝난 업무는 여기 들지 않는다. */
export function unassigned(rows: OpenTask[]): OpenTask[] {
  return rows.filter((row) => row.assignee === null)
}
