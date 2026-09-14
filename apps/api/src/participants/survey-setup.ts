import { and, desc, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { events, surveys } from '../db/schema.ts'
import { NotFound } from '../errors.ts'
import { fieldMoment } from '../time.ts'

// 참여 설문의 현재 설정을 읽는 자리(EVT-05).
//
// 최신 설문과 행사 기본정보를 한 번에 찾는 공통 조회는 활성화 정책과 문항 표시가
// 함께 쓴다. 설정 초안은 이 조회에서 편집할 값만 골라 돌려준다.

export interface EventRow {
  title: string
  startAt: Date | null
  endAt: Date | null
  endUnset: boolean
  place: string | null
  placeUnset: boolean
  audience: string | null
  feeType: string
  paidAmount: number | null
  unpaidAmount: number | null
  payGuide: string | null
  capacityType: string
  capacityCount: number | null
}

export interface SurveyRow {
  id: string
  active: boolean
  replacedById: string | null
  opensAt: Date | null
  closesAt: Date | null
  applyMethod: string
  waitlist: boolean
  duesCheck: boolean
  completionTitle: string | null
}

/**
 * 이 학생회의 그 행사와, 지금 그 행사의 설문.
 *
 * **가장 최근 것이다.** 교체하면 옛 설문이 남은 채 새 것이 생기므로 한 행사에 여러
 * 줄이 있을 수 있다(`events/survey.ts`가 쓰는 규칙과 같다).
 *
 * **없는 것은 없다고 한다.** 빈 초안을 대신 주면 '아직 안 만들었다'와 '만들었는데
 * 비워 두었다'가 같은 모양이 된다 — 이 화면이 하는 일이 바로 그 둘을 가르는 일이다.
 */
export async function setupOf(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<{ event: EventRow; survey: SurveyRow }> {
  const eventRows = await db
    .select({
      title: events.title,
      startAt: events.startAt,
      endAt: events.endAt,
      endUnset: events.endUnset,
      place: events.place,
      placeUnset: events.placeUnset,
      audience: events.audience,
      feeType: events.feeType,
      paidAmount: events.paidAmount,
      unpaidAmount: events.unpaidAmount,
      payGuide: events.payGuide,
      capacityType: events.capacityType,
      capacityCount: events.capacityCount,
    })
    .from(events)
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1)
  const event = eventRows[0]
  if (event === undefined) throw new NotFound('그 행사를 찾지 못했습니다')

  const surveyRows = await db
    .select({
      id: surveys.id,
      active: surveys.active,
      replacedById: surveys.replacedById,
      opensAt: surveys.opensAt,
      closesAt: surveys.closesAt,
      applyMethod: surveys.applyMethod,
      waitlist: surveys.waitlist,
      duesCheck: surveys.duesCheck,
      completionTitle: surveys.completionTitle,
    })
    .from(surveys)
    .where(and(eq(surveys.orgId, orgId), eq(surveys.eventId, eventId)))
    .orderBy(desc(surveys.createdAt), desc(surveys.id))
    .limit(1)
  const survey = surveyRows[0]
  if (survey === undefined) throw new NotFound('이 행사의 참여 설문이 아직 없습니다')
  return { event, survey }
}

export interface SurveySettingsDraft {
  applyStart?: string
  applyEnd?: string
  applyMethod: string
  waitlist: boolean
  duesCheck?: string
  completionNote?: string
}

/**
 * 모집 설정의 고칠 칸 하나하나(EVT-05).
 *
 * **칸은 칸으로 준다**(EVT-02B의 초안과 같은 규칙). 빈 칸에 '미정' 같은 말을 넣으면
 * 사람이 그것을 지우지 않고 저장해 안내 문구가 '미정'이 된다. 안 정한 칸은 아예 오지
 * 않는다 — 계약이 여섯을 전부 optional로 적었다.
 *
 * 표가 참거짓으로 아는 둘은 늘 온다. **꼴이 서로 다른 것은 계약이 그렇게 적었기
 * 때문이다** — `waitlist`는 참거짓이고 `duesCheck`는 글이다.
 */
export async function surveySettingsDraft(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<SurveySettingsDraft> {
  const { survey } = await setupOf(db, orgId, eventId)
  const draft: SurveySettingsDraft = {
    applyMethod: survey.applyMethod,
    waitlist: survey.waitlist,
  }
  if (survey.duesCheck) draft.duesCheck = 'y'
  if (survey.opensAt !== null) draft.applyStart = fieldMoment(survey.opensAt)
  if (survey.closesAt !== null) draft.applyEnd = fieldMoment(survey.closesAt)
  if (survey.completionTitle !== null && survey.completionTitle !== '') {
    draft.completionNote = survey.completionTitle
  }
  return draft
}
