import { and, eq, ne } from 'drizzle-orm'
import type { ApiResponse } from '../../../../specs/figma/vada-wireframe/api-types.d.ts'
import type { Db } from '../db/client.ts'
import { members, tasks } from '../db/schema.ts'
import { NotFound } from '../errors.ts'
import { daysBetween } from '../time.ts'

/** 이 학생회에서 보는 사람의 이름. 인사에 들어가므로 서버가 완성해서 준다. */
async function nameOf(db: Db, orgId: string, memberId: string): Promise<string> {
  const rows = await db
    .select({ name: members.name })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.id, memberId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('이 학생회의 구성원이 아닙니다')
  return row.name
}

export type BriefingNotice = ApiResponse<'home.briefingNotices'>[number]

/**
 * 브리핑이 짚어 주는 문장들(`home.briefingNotices`).
 *
 * **짚을 것이 없으면 빈 목록이다**(명세가 그렇게 적었다). 그래서 0건인 줄은 아예
 * 오지 않는다 — '지연된 업무가 0건 있습니다'는 짚는 말이 아니다.
 *
 * 무엇을 짚는가는 **이 저장소가 이미 든 두 사실**이다.
 *
 * 1. **지연** — 기한이 지났고 아직 안 끝난 업무(`tasks/labels.ts`의 `isOverdue`).
 *    브리핑 곁의 단추가 '지연 업무 보기'라 같은 것을 가리킨다.
 * 2. **담당자 없음** — 배정해야 하는 업무. 업무 보드가 이것을 맨 위로 올린다
 *    (`tasks/board.ts`의 차례: '먼저 봐야 하는 것(담당자 없음)이 위로').
 *    **끝난 업무는 세지 않는다** — 이미 한 일에 사람을 붙일 까닭이 없다.
 *
 * **학생회 전체를 센다.** 홈은 내 업무가 아니라 학생회의 요약이고, 내 것은 옆의
 * '내 담당 업무'가 따로 든다(MY-01).
 */
export async function homeBriefingNotices(
  db: Db,
  orgId: string,
  now: Date,
): Promise<BriefingNotice[]> {
  // **지났는지는 시간대가 정한다.** 저장소에 물으면 시간대 이름이 여기 또 적힌다 —
  // 날 수를 세는 일은 `time.ts` 하나가 든다(운영 허브가 같은 자리에서 같은 것을 했다).
  const rows = await db
    .select({ dueDate: tasks.dueDate, assigneeMemberId: tasks.assigneeMemberId })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), ne(tasks.status, 'done')))

  const delayed = rows.filter(
    (row) => row.dueDate !== null && daysBetween(row.dueDate, now) > 0,
  ).length
  const unassigned = rows.filter((row) => row.assigneeMemberId === null).length

  const notices: BriefingNotice[] = []
  if (delayed > 0) notices.push({ message: `지연된 업무가 ${delayed}건 있습니다.` })
  if (unassigned > 0) notices.push({ message: `담당자가 없는 업무가 ${unassigned}건 있습니다.` })
  return notices
}

export type Briefing = ApiResponse<'home.briefing'>

/**
 * 브리핑의 인사 제목(`home.briefing`).
 *
 * **사람 이름이 들어가므로 서버가 완성해서 준다**(명세가 그렇게 적었다).
 *
 * 명세는 인사를 하나만 예로 들었다('박해랑님, 확인이 필요해요'). 그런데 짚을 것이
 * 없는 상태를 명세가 이미 인정하고 있으므로(`home.briefingNotices`가 빈 목록일 수
 * 있다) 그때도 '확인이 필요해요'라고 말하면 **화면이 없는 일을 알린다.** 그래서
 * 짚을 것이 있을 때만 그 말을 하고, 없으면 없다고 말한다.
 */
export async function homeBriefing(
  db: Db,
  orgId: string,
  memberId: string,
  now: Date,
): Promise<Briefing> {
  const [name, notices] = await Promise.all([
    nameOf(db, orgId, memberId),
    homeBriefingNotices(db, orgId, now),
  ])
  return {
    title:
      notices.length === 0 ? `${name}님, 지금은 확인할 내용이 없어요` : `${name}님, 확인이 필요해요`,
  }
}
