import { and, count, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { events, surveyApplications, surveys } from '../db/schema.ts'
import { NotFound } from '../errors.ts'
import { eventFeeLabel } from '../events/participation-labels.ts'
import { moment } from '../time.ts'
import type { Clock } from './attendance.ts'
import { looksLikeToken } from './tokens.ts'

// 공개 설문 토큰을 설문으로 바꾸고, 지금 신청 가능한지를 한 정책으로 판정한다.
// 신청 폼과 막힘 안내와 실제 제출이 모두 blockOf를 재사용한다.

export interface SurveyRow {
  id: string
  orgId: string
  eventId: string
  active: boolean
  opensAt: Date | null
  closesAt: Date | null
  capacity: number | null
  replacedById: string | null
  completionTitle: string | null
  duesCheck: boolean
}

export async function surveyOf(db: Db, token: string): Promise<SurveyRow> {
  // 모양이 아닌 것은 표를 찾아보기도 전에 막는다.
  if (!looksLikeToken(token)) throw new NotFound('그 참여 신청을 찾지 못했습니다')
  const rows = await db
    .select({
      id: surveys.id,
      orgId: surveys.orgId,
      eventId: surveys.eventId,
      active: surveys.active,
      opensAt: surveys.opensAt,
      closesAt: surveys.closesAt,
      capacity: surveys.capacity,
      replacedById: surveys.replacedById,
      completionTitle: surveys.completionTitle,
      duesCheck: surveys.duesCheck,
    })
    .from(surveys)
    .where(eq(surveys.linkToken, token))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 참여 신청을 찾지 못했습니다')
  return row
}

export interface LinkState {
  label: string
  tone: string
  note: string
  actionLabel?: string
  replacementToken?: string
}

/**
 * 이 링크가 **지금 받는가.** 받으면 `null`이다.
 *
 * **판정이 한 곳에 있다.** 신청 폼과 안내 화면이 이 함수의 답을 뒤집어 쓰므로
 * 둘 중 하나만 답하는 것이 우연이 아니라 구조다.
 *
 * 순서가 뜻을 가진다 — 교체를 맨 앞에 둔다. 교체된 설문은 대개 꺼져 있기도 한데,
 * 신청자에게 쓸모 있는 답은 '꺼졌습니다'가 아니라 **'여기로 가세요'**다.
 */
export async function blockOf(db: Db, survey: SurveyRow, now: Date): Promise<LinkState | null> {
  if (survey.replacedById !== null) {
    const rows = await db
      .select({ linkToken: surveys.linkToken })
      .from(surveys)
      .where(eq(surveys.id, survey.replacedById))
      .limit(1)
    const next = rows[0]
    return {
      label: '설문이 교체되었습니다',
      tone: 'blue',
      note: '이 링크의 설문은 새 설문으로 바뀌었습니다.',
      // **다섯 중 이것만 갈 곳이 있다.** 나머지 넷에는 단추를 그리지 않는다.
      ...(next === undefined
        ? {}
        : { actionLabel: '새 신청 폼으로 가기', replacementToken: next.linkToken }),
    }
  }
  if (!survey.active) {
    return {
      label: '링크 비활성화',
      tone: 'gray',
      note: '이 링크는 더 이상 쓸 수 없습니다. 행사 운영진에게 문의해 주세요.',
    }
  }
  if (survey.opensAt !== null && now < survey.opensAt) {
    return {
      label: '모집 전',
      tone: 'gray',
      note: `${moment(survey.opensAt)}부터 신청할 수 있습니다.`,
    }
  }
  if (survey.closesAt !== null && now > survey.closesAt) {
    return {
      label: '모집 마감',
      tone: 'yellow',
      note: '신청 기간이 지났습니다. 행사 운영진에게 문의해 주세요.',
    }
  }
  if (survey.capacity !== null) {
    const [counted] = await db
      .select({ value: count() })
      .from(surveyApplications)
      .where(eq(surveyApplications.surveyId, survey.id))
    if ((counted?.value ?? 0) >= survey.capacity) {
      return {
        label: '정원 마감',
        tone: 'orange',
        note: '신청 정원이 모두 찼습니다. 행사 운영진에게 문의해 주세요.',
      }
    }
  }
  return null
}

export interface ApplyForm {
  title: string
  startAt: string
  place: string
  audience: string
  fee: string
}

/**
 * 링크를 열면 보이는 신청 폼의 머리(EXT-02A).
 *
 * **막힌 링크에는 이 답이 없다.** 서버가 상태를 보고 신청 폼이나 안내 화면 중
 * 하나로 보낸다(docs/decisions/product-decisions.md).
 */
export async function applyForm(db: Db, token: string, time: Clock): Promise<ApplyForm> {
  const survey = await surveyOf(db, token)
  if ((await blockOf(db, survey, time.now())) !== null) {
    throw new NotFound('이 링크는 지금 신청을 받고 있지 않습니다')
  }
  const rows = await db
    .select({
      title: events.title,
      startAt: events.startAt,
      place: events.place,
      audience: events.audience,
      fee: events.fee,
      feeType: events.feeType,
      paidAmount: events.paidAmount,
      unpaidAmount: events.unpaidAmount,
    })
    .from(events)
    .where(and(eq(events.id, survey.eventId), eq(events.orgId, survey.orgId)))
    .limit(1)
  const event = rows[0]
  if (event === undefined) throw new NotFound('그 행사를 찾지 못했습니다')

  // 비어 있는 것을 지어내지 않는다 — '없다'와 '아직 안 적었다'는 다른 말이다.
  return {
    title: event.title,
    startAt: event.startAt === null ? '일시 미정' : moment(event.startAt),
    place: event.place ?? '장소 미정',
    audience: event.audience ?? '대상 미정',
    fee: eventFeeLabel(event, '참가비 안내 없음'),
  }
}

/**
 * 링크가 왜 막혔는지(EXT-02C).
 *
 * **막히지 않은 링크에는 이 답이 없다.** 이 출처가 무언가를 답했다는 것 자체가
 * '지금은 받지 않는다'는 뜻이다.
 */
export async function linkState(db: Db, token: string, time: Clock): Promise<LinkState> {
  const survey = await surveyOf(db, token)
  const blocked = await blockOf(db, survey, time.now())
  if (blocked === null) throw new NotFound('이 링크는 막혀 있지 않습니다')
  return blocked
}
