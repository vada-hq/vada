import { and, eq, isNull, sql } from 'drizzle-orm'
import type { ApiResponse } from '../../../../specs/figma/vada-wireframe/api-types.d.ts'
import type { Db } from '../db/client.ts'
import { students, surveyApplications, surveys } from '../db/schema.ts'
import { missingProofCount } from './home-finance-facts.ts'

export type OrgAlert = ApiResponse<'home.orgAlerts'>[number]

/**
 * 조직 운영에서 확인이 필요한 항목(`home.orgAlerts`).
 *
 * **종류가 상황에 따라 달라진다**(명세가 그렇게 적었다). 그래서 0건인 종류는 아예
 * 오지 않는다 — '확인이 필요한 항목'에 0이 오면 그것은 확인할 것이 있다는 말이 된다.
 *
 * 화면이 아는 종류가 둘이고(문서형·인원형 아이콘) 각각이 가리키는 사실이 이 저장소에
 * 이미 있다.
 *
 * - **증빙 서류 누락**(`document`) — 붙어야 하는데 안 붙은 결제 증빙이다. 표가 그
 *   자리를 미리 만들어 두고 붙으면 `registeredAt`이 찍힌다(`db/schema.ts`), 그리고
 *   증빙 정리 화면이 그 상태를 이미 '누락'이라 부른다(`finance/evidence.ts`).
 *   **예산과 무관하다** — 그래서 재정 요약이 미뤄져 있어도 이것은 셀 수 있다.
 * - **참가자 명단 확인 필요**(`members`) — 학생 명단에서 찾지 못한 신청자다. 무엇이
 *   확인 대상인지는 명세가 다른 자리에서 말해 두었다: '학번·이름 불일치 또는 명단 외
 *   학생'(`event.checklist`의 detail). 그 규칙을 학생회 전체로 넓힌 것이 이 수다.
 */
export async function homeOrgAlerts(db: Db, orgId: string): Promise<OrgAlert[]> {
  const [missingProof, unmatchedApplicants] = await Promise.all([
    missingProofCount(db, orgId),
    unmatchedApplicantCount(db, orgId),
  ])

  const alerts: OrgAlert[] = []
  if (missingProof > 0) {
    alerts.push({ kind: 'document', label: '증빙 서류 누락', count: missingProof })
  }
  if (unmatchedApplicants > 0) {
    alerts.push({ kind: 'members', label: '참가자 명단 확인 필요', count: unmatchedApplicants })
  }
  return alerts
}

/**
 * 학생 명단에서 찾지 못한 신청자.
 *
 * **학번과 이름이 함께 맞아야 찾은 것이다.** 학번만 보면 남의 학번으로 낸 신청이
 * 조용히 통과하고, 이름만 보면 동명이인이 통과한다.
 */
async function unmatchedApplicantCount(db: Db, orgId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(surveyApplications)
    .innerJoin(
      surveys,
      and(eq(surveyApplications.surveyId, surveys.id), eq(surveys.orgId, orgId)),
    )
    .leftJoin(
      students,
      and(
        eq(students.orgId, orgId),
        eq(students.studentNumber, surveyApplications.studentNumber),
        eq(students.name, surveyApplications.name),
      ),
    )
    .where(isNull(students.id))
  return Number(rows[0]?.total ?? 0)
}
