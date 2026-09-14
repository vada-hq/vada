import { and, desc, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { students, surveyApplications, surveys } from '../db/schema.ts'

export interface SurveyFacts {
  id: string
  active: boolean
  replacedById: string | null
  opensAt: Date | null
  closesAt: Date | null
  applyMethod: string
}

export async function currentSurvey(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<SurveyFacts | null> {
  const rows = await db
    .select({
      id: surveys.id,
      active: surveys.active,
      replacedById: surveys.replacedById,
      opensAt: surveys.opensAt,
      closesAt: surveys.closesAt,
      applyMethod: surveys.applyMethod,
    })
    .from(surveys)
    .where(and(eq(surveys.orgId, orgId), eq(surveys.eventId, eventId)))
    .orderBy(desc(surveys.createdAt), desc(surveys.id))
    .limit(1)
  return rows[0] ?? null
}

export interface Applicants {
  total: number
  paid: number
  unpaid: number
  unknown: number
  needsCheck: number
}

const NO_APPLICANTS: Applicants = { total: 0, paid: 0, unpaid: 0, unknown: 0, needsCheck: 0 }

export async function applicantsOf(
  db: Db,
  orgId: string,
  survey: SurveyFacts | null,
): Promise<Applicants> {
  if (survey === null) return NO_APPLICANTS
  const rows = await db
    .select({
      name: surveyApplications.name,
      payStatus: surveyApplications.payStatus,
      rosterName: students.name,
    })
    .from(surveyApplications)
    .leftJoin(
      students,
      and(
        eq(students.orgId, orgId),
        eq(students.studentNumber, surveyApplications.studentNumber),
      ),
    )
    .where(eq(surveyApplications.surveyId, survey.id))
  const counted = { ...NO_APPLICANTS, total: rows.length }
  for (const row of rows) {
    if (row.payStatus === 'paid') counted.paid += 1
    else if (row.payStatus === 'unpaid') counted.unpaid += 1
    else counted.unknown += 1
    if (row.rosterName === null || row.rosterName !== row.name) counted.needsCheck += 1
  }
  return counted
}

export async function applicationMomentsOf(
  db: Db,
  survey: SurveyFacts | null,
): Promise<Date[]> {
  if (survey === null) return []
  const rows = await db
    .select({ at: surveyApplications.at })
    .from(surveyApplications)
    .where(eq(surveyApplications.surveyId, survey.id))
  return rows.map((row) => row.at)
}
