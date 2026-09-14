import optionSourcesJson from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import { day } from '../time.ts'
import { applicantsOf, currentSurvey, openTasksOf, type SurveyFacts } from './counts.ts'
import { capacityNote, must, unassigned } from './overview-shared.ts'

/** 신청 방식의 말은 **명세가 갖고 있다**(event.surveyApplyMethods). 두 벌을 들면 갈린다. */
const APPLY_METHOD = new Map<string, string>(
  (
    optionSourcesJson.sources.find((source) => source.key === 'event.surveyApplyMethods') as
      | { options: Array<{ value: string; label: string }> }
      | undefined
  )?.options.map((option) => [option.value, option.label]) ?? [],
)

export interface ParticipantStats {
  applicants: string
  applicantsNote: string
  paid: string
  paidNote: string
  needsCheck: string
  needsCheckNote: string
  unassignedTasks: string
  unassignedTasksNote: string
}

export async function participantStats(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<ParticipantStats> {
  const row = await must(db, orgId, eventId)
  const survey = await currentSurvey(db, orgId, eventId)
  const applicants = await applicantsOf(db, orgId, survey)
  const waiting = unassigned(await openTasksOf(db, orgId, eventId))

  return {
    applicants: `${applicants.total}명`,
    applicantsNote: capacityNote(row),
    paid: `${applicants.paid}명`,
    // **미납과 미확인은 다른 사실이다.** 표가 셋을 갈라 두었으므로 하나로 합치지 않는다.
    paidNote:
      applicants.unknown === 0
        ? `미납 ${applicants.unpaid}명`
        : `미납 ${applicants.unpaid}명 · 미확인 ${applicants.unknown}명`,
    needsCheck: `${applicants.needsCheck}명`,
    needsCheckNote: applicants.needsCheck === 0 ? '확인할 것이 없습니다' : '명단 불일치',
    // 세는 말이 강조 카드('건')와 다르다 — 그림이 이 자리를 '개'로 그렸다.
    unassignedTasks: `${waiting.length}개`,
    unassignedTasksNote: waiting.length === 0 ? '배정할 것이 없습니다' : '처리 필요',
  }
}

export interface RecruitSettings {
  surveyStatus: string
  period: string
  method: string
  applicantCount: string
}

/**
 * 신청 기간.
 *
 * **정해지지 않은 것은 그 사실이 말로 온다.** 빈 글을 주면 화면이 그 자리에
 * 무엇이든 그리고, '마감일을 안 적었다'와 '설문이 아예 없다'가 같아진다.
 */
function periodNote(survey: SurveyFacts | null): string {
  if (survey === null) return '기간 미입력'
  if (survey.opensAt !== null && survey.closesAt !== null) {
    return `${day(survey.opensAt)} ~ ${day(survey.closesAt)}`
  }
  if (survey.closesAt !== null) return `마감 ${day(survey.closesAt)}`
  if (survey.opensAt !== null) return `${day(survey.opensAt)} 시작`
  return '마감일 미입력'
}

/**
 * 설문의 상태. **행사의 단계와 다른 축이다** — 명세가 그렇게 못 박았다.
 *
 * 아직 안 만든 것은 '초안'이 아니다. 셋을 넷으로 두는 까닭이 그것이다.
 */
function surveyStatusOf(survey: SurveyFacts | null): string {
  if (survey === null) return '아직 없음'
  if (survey.replacedById !== null) return '교체됨'
  return survey.active ? '활성' : '초안'
}

export async function recruitSettings(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<RecruitSettings> {
  await must(db, orgId, eventId)
  const survey = await currentSurvey(db, orgId, eventId)
  const applicants = await applicantsOf(db, orgId, survey)

  return {
    surveyStatus: surveyStatusOf(survey),
    period: periodNote(survey),
    method: survey === null ? '미정' : (APPLY_METHOD.get(survey.applyMethod) ?? survey.applyMethod),
    applicantCount: `${applicants.total}명`,
  }
}
