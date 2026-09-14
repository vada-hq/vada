import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, eventArchives, members } from '../db/schema.ts'
import { AlreadyExists, Blocked } from '../errors.ts'
import { readWord } from '../input.ts'
import { archiveOf, type ArchiveRow } from './archive-facts.ts'

export interface ArchiveWriter {
  memberId: string
}

/** 이 학생회의 그 부서인가. 못 찾으면 막는다 — 조용히 비우면 고른 줄 알고 지나간다. */
async function departmentOf(db: Db, orgId: string, departmentId: string | null): Promise<string | null> {
  if (departmentId === null) return null
  const rows = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.orgId, orgId), eq(departments.id, departmentId)))
    .limit(1)
  if (rows[0] === undefined) throw new Blocked('이 학생회에 그런 부서가 없습니다')
  return departmentId
}

/** 발행된 문서에는 아무것도 쓰지 않는다. */
export function mustBeUnpublished(row: ArchiveRow | null, what: string): void {
  if (row?.status === 'published') throw new Blocked(`이미 발행된 문서는 ${what} 수 없습니다`)
}

/**
 * 줄이 있으면 고치고 없으면 만든다. 두 길이 같은 값을 쓴다 — 울타리(학생회)는 고칠
 * 때도 다시 건다.
 */
export async function upsert(
  db: Db,
  orgId: string,
  eventId: string,
  row: ArchiveRow | null,
  who: ArchiveWriter,
  at: Date,
  newId: () => string,
  values: Partial<typeof eventArchives.$inferInsert>,
): Promise<void> {
  if (row === null) {
    await db.insert(eventArchives).values({
      id: newId(),
      orgId,
      eventId,
      status: 'draft',
      authorMemberId: who.memberId,
      createdAt: at,
      updatedAt: at,
      ...values,
    })
    return
  }
  await db
    .update(eventArchives)
    .set({
      // 처음 쓴 사람이 안 남아 있으면 지금 쓰는 사람이다. 남아 있으면 그대로다.
      ...(row.authorMemberId === null ? { authorMemberId: who.memberId } : {}),
      updatedAt: at,
      ...values,
    })
    .where(and(eq(eventArchives.orgId, orgId), eq(eventArchives.id, row.id)))
}

/**
 * 검토자로 고른 사람. **이 학생회의 회장단·부서장이어야 한다** — 검토자 후보 목록
 * (`record.archiveReviewers`)이 그 둘만 주고, 여기서 다시 확인한다. 목록에 없는 id를
 * 보내면 그것은 화면이 아니라 손으로 만든 요청이다.
 */
async function reviewerOf(db: Db, orgId: string, memberId: string | null): Promise<string | null> {
  if (memberId === null) return null
  const rows = await db
    .select({ id: members.id, role: members.role })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.id, memberId)))
    .limit(1)
  const found = rows[0]
  if (found === undefined) throw new Blocked('이 학생회에 그런 구성원이 없습니다')
  if (found.role !== 'chair' && found.role !== 'head') {
    throw new Blocked('검토자는 회장단이나 부서장이어야 합니다')
  }
  return found.id
}

/** 화면이 한 번에 보내는 칸 전부. 임시 저장과 검토 요청이 **같은 것**을 보낸다(명세). */
async function draftValuesOf(
  db: Db,
  orgId: string,
  draft: Record<string, unknown>,
): Promise<Partial<typeof eventArchives.$inferInsert>> {
  return {
    onSiteOperation: readWord(draft, 'onSiteOperation', '현장 운영'),
    retroGood: readWord(draft, 'retroGood', '잘된 점'),
    retroIssues: readWord(draft, 'retroIssues', '미흡했던 점과 원인'),
    retroImprovements: readWord(draft, 'retroImprovements', '다음 행사 개선안'),
    improvementDepartmentId: await departmentOf(
      db,
      orgId,
      readWord(draft, 'improvementDepartment', '담당 부서'),
    ),
    handover: readWord(draft, 'handover', '인수인계'),
    nextOwner: readWord(draft, 'nextOwner', '다음 담당자'),
    reviewerMemberId: await reviewerOf(db, orgId, readWord(draft, 'reviewer', '검토자')),
  }
}

/**
 * 임시 저장(`record.archive.saveDraft`). **덮어쓰기다** — 화면이 칸 전부를 한 번에
 * 보내므로 안 보낸 칸은 비운 것이다. 고른 검토자도 함께 남는다 — 저장하고 다시 열었을
 * 때 고른 사람이 사라지면 사람은 저장이 안 된 줄 안다.
 */
export async function saveArchiveDraft(
  db: Db,
  orgId: string,
  eventId: string,
  draft: Record<string, unknown>,
  who: ArchiveWriter,
  at: Date,
  newId: () => string,
): Promise<Record<string, never>> {
  const { row } = await archiveOf(db, orgId, eventId)
  mustBeUnpublished(row, '고칠')
  await upsert(db, orgId, eventId, row, who, at, newId, await draftValuesOf(db, orgId, draft))
  return {}
}

/**
 * 검토 요청(`record.archive.requestReview`). 임시 저장과 **같은 것**을 보내되 보내는 곳이
 * 다르다 — 글을 남기고 문서를 '검토 중'으로 옮긴다. **발행이 아니다.** 검토자가 승인하는
 * 순간이 발행인데(사람이 정함, 2026-09-05) 그 단추는 그림에 아직 없다. 그때까지 문서는
 * 여기 머문다.
 *
 * **두 번 못 넘긴다**(명세의 repeat: conflict). 이미 검토 중인 문서를 또 넘기면 409다.
 * 검토자 없이는 넘길 것이 없다 — 누구에게 넘기는지 모르는 요청은 요청이 아니다.
 */
export async function requestArchiveReview(
  db: Db,
  orgId: string,
  eventId: string,
  draft: Record<string, unknown>,
  who: ArchiveWriter,
  at: Date,
  newId: () => string,
): Promise<Record<string, never>> {
  const { row } = await archiveOf(db, orgId, eventId)
  mustBeUnpublished(row, '넘길')
  if (row?.status === 'inReview') throw new AlreadyExists('이미 검토로 넘어간 아카이브입니다')
  const values = await draftValuesOf(db, orgId, draft)
  if (values.reviewerMemberId === null || values.reviewerMemberId === undefined) {
    throw new Blocked('검토자를 고르세요')
  }
  await upsert(db, orgId, eventId, row, who, at, newId, {
    ...values,
    status: 'inReview',
    reviewRequestedAt: at,
  })
  return {}
}
