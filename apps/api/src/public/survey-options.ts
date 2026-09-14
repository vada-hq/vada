import { and, asc, eq, isNotNull } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { students } from '../db/schema.ts'
import { surveyOf, type SurveyRow } from './survey-link.ts'

export interface Option {
  value: string
  label: string
}

/**
 * 폼에서 고르는 단과대학·학부(EXT-02A).
 *
 * **명단이 곧 목록이다.** 학교 전체의 학사 편제를 들고 있는 표가 없고, 이 화면에는
 * 학교를 고르는 칸도 없다 — 어느 학교인지는 설문을 연 학생회가 이미 안다. 그래서
 * 그 학생회가 올린 명단에 실제로 있는 값만 고를 수 있게 한다.
 *
 * `collegeId`가 곧 단과대학의 이름인 까닭도 같다. 명단이 글로 들고 있으므로 그 글이
 * 이 자리의 값이다.
 *
 * **없는 토큰에도 빈 목록으로 답한다.** 계약이 이 자리에 404를 두지 않았고, 답을
 * 가려 주면 그것이 토큰이 있는지 없는지를 알려 주는 자리가 된다.
 */
export async function collegeOptions(db: Db, token: string): Promise<Option[]> {
  const survey = await found(db, token)
  if (survey === null) return []
  const rows = await db
    .selectDistinct({ name: students.college })
    .from(students)
    .where(and(eq(students.orgId, survey.orgId), isNotNull(students.college)))
    .orderBy(asc(students.college))
  return rows.flatMap((row) => (row.name === null || row.name === '' ? [] : [option(row.name)]))
}

export async function departmentOptions(
  db: Db,
  token: string,
  collegeId: string,
): Promise<Option[]> {
  const survey = await found(db, token)
  if (survey === null || collegeId === '') return []
  const rows = await db
    .selectDistinct({ name: students.department })
    .from(students)
    .where(
      and(
        eq(students.orgId, survey.orgId),
        eq(students.college, collegeId),
        isNotNull(students.department),
      ),
    )
    .orderBy(asc(students.department))
  return rows.flatMap((row) => (row.name === null || row.name === '' ? [] : [option(row.name)]))
}

function option(name: string): Option {
  return { value: name, label: name }
}

/** 있으면 그 설문, 없으면 null. 목록 자리는 없다고 막지 않는다. */
async function found(db: Db, token: string): Promise<SurveyRow | null> {
  try {
    return await surveyOf(db, token)
  } catch {
    return null
  }
}
