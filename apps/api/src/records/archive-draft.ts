import { and, eq, inArray } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, members } from '../db/schema.ts'
import { archiveOf, departmentNameOf } from './archive-facts.ts'
import { handoverGroups, retroGroups, type HandoverGroup, type RetroGroup } from './archive-text.ts'
import { archiveWord as word } from './archive-shared.ts'

export interface ArchiveDraft {
  onSiteOperation?: string
  retroGood?: string
  retroIssues?: string
  retroImprovements?: string
  improvementDepartment?: string
  handover?: string
  nextOwner?: string
  reviewer?: string
}

/**
 * 사람이 쓰는 칸들(`record.archiveDraft`).
 *
 * **칸은 칸으로 준다.** 안 적은 칸은 아예 오지 않는다 — 빈 글이나 '미정' 같은 말을
 * 넣으면 사람이 그것을 지우지 않고 저장한다. 줄이 없는 문서는 빈 초안이라 아무것도 없다.
 * 고른 검토자도 칸이다 — 저장했다 다시 열면 그 사람이 골라져 있어야 한다.
 */
export async function archiveDraft(db: Db, orgId: string, eventId: string): Promise<ArchiveDraft> {
  const { row } = await archiveOf(db, orgId, eventId)
  const draft: ArchiveDraft = {}
  // 적힌 글은 **적힌 그대로** 돌려준다 — 칸에 되돌아가는 값이라 앞뒤를 다듬으면 사람이
  // 쓴 것과 달라진다. 비었는지만 본다.
  const put = (key: keyof ArchiveDraft, value: string | null | undefined) => {
    if (word(value) !== null) draft[key] = value as string
  }
  put('onSiteOperation', row?.onSiteOperation)
  put('retroGood', row?.retroGood)
  put('retroIssues', row?.retroIssues)
  put('retroImprovements', row?.retroImprovements)
  put('improvementDepartment', row?.improvementDepartmentId)
  put('handover', row?.handover)
  put('nextOwner', row?.nextOwner)
  put('reviewer', row?.reviewerMemberId)
  return draft
}

/**
 * 검토 의견(`record.archiveReview`). **쓰는 사람이 아니라 검토자가 적는 값**이라
 * 초안과 갈린다(명세). 아직 검토되지 않았으면 조각이 오지 않는다 — 검토자가 의견을
 * 적는 자리는 승인 단추와 함께 그림에 더해질 것이고, 그때까지 이 자리는 늘 빈 채다.
 */
export async function archiveReview(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<{ comment?: string }> {
  const { row } = await archiveOf(db, orgId, eventId)
  const comment = word(row?.reviewComment)
  return comment === null ? {} : { comment }
}

/**
 * 검토자 후보(`record.archiveReviewers`). **회장단과 부서장.** 명세는 '조직의 권한
 * 규칙'이라고만 적었고, 기록을 쓰는 권한(`record.write`)이 그 둘이므로 검토도 그
 * 둘이 한다 — 쓸 수 없는 사람이 검토하는 것은 이상하다. 사람이 다른 규칙을 정하면
 * 여기 한 곳만 바뀐다.
 */
export async function archiveReviewers(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<Array<{ value: string; label: string; description: string }>> {
  await archiveOf(db, orgId, eventId)
  const rows = await db
    .select({ id: members.id, name: members.name, role: members.role, department: departments.name })
    .from(members)
    .leftJoin(
      departments,
      and(eq(members.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .where(and(eq(members.orgId, orgId), inArray(members.role, ['chair', 'head'])))
  return rows
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((row) => ({
      value: row.id,
      label: row.name,
      description: row.role === 'chair' ? '회장단' : `부서장 · ${row.department ?? '부서 미배정'}`,
    }))
}

/**
 * 회고(`record.archiveRetro`). 글의 줄이 곧 줄이다 — 규칙은 `archive-text.ts`가 든다.
 * 개선안의 담당 부서는 이 학생회의 부서일 때만 이름이 붙는다.
 */
export async function archiveRetro(db: Db, orgId: string, eventId: string): Promise<RetroGroup[]> {
  const { row } = await archiveOf(db, orgId, eventId)
  return retroGroups(
    {
      retroGood: row?.retroGood ?? null,
      retroIssues: row?.retroIssues ?? null,
      retroImprovements: row?.retroImprovements ?? null,
    },
    await departmentNameOf(db, orgId, row?.improvementDepartmentId ?? null),
  )
}

/** 인수인계(`record.archiveHandover`). 다음 담당자는 문서 전체의 것이라 `record.archive`가 든다. */
export async function archiveHandover(db: Db, orgId: string, eventId: string): Promise<HandoverGroup[]> {
  const { row } = await archiveOf(db, orgId, eventId)
  return handoverGroups(row?.handover)
}
