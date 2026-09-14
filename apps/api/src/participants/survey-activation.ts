import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { surveyQuestions, surveys } from '../db/schema.ts'
import { AlreadyExists, NotReady } from '../errors.ts'
import { setupOf, type EventRow, type SurveyRow } from './survey-setup.ts'

// 참여 설문을 켤 수 있는지 판정하고 실제로 켜는 정책(EVT-05).
//
// 조건 목록, 미충족 수, 활성화 명령은 모두 activationOf의 같은 계산을 쓴다.
// 이름·학번·회비 대조 식별값은 설문의 고정 칸이라 항상 충족되며, 운영진이 추가하는
// 문항 중에는 개인정보 동의 문항이 있는지를 확인한다.

export interface ConditionRow {
  key: string
  label: string
  met: string
  tone: string
  detail?: string
  locationNote?: string
  actionLabel?: string
  targetKind?: string
}

export interface ConditionGroup {
  groupLabel: string
  rows: ConditionRow[]
}

/**
 * 채우러 가는 자리. **화면 id가 아니다** — 갈 곳은 명세가 든다(계약이 그렇게 적었다).
 *
 * 문구까지 함께 두는 까닭은 둘이 같은 사실의 두 모습이기 때문이다. 갈 곳이 바뀌면
 * 문구도 바뀌어야 하고, 떨어져 있으면 한쪽만 바뀐다.
 */
const WHERE = {
  basics: { actionLabel: '기본정보에서 수정 →', targetKind: 'basics' },
  settings: { actionLabel: '모집 설정에서 입력 →', targetKind: 'surveySettings' },
  questions: { actionLabel: '문항에서 추가 →', targetKind: 'surveySettings' },
} as const

/** 채워졌으면 이름과 색만, 아니면 무엇이 없고 어디서 채우는지까지. */
function condition(
  key: string,
  label: string,
  met: boolean,
  unmet: { detail: string; locationNote: string; go: keyof typeof WHERE },
): ConditionRow {
  if (met) return { key, label, met: 'y', tone: 'green' }
  return {
    key,
    label,
    met: '',
    tone: 'red',
    detail: unmet.detail,
    locationNote: unmet.locationNote,
    ...WHERE[unmet.go],
  }
}

/**
 * 링크를 켜려면 채워야 하는 것들.
 *
 * **묶음이 둘인 까닭이 갈 곳이 둘이기 때문이다** — 앞엣것은 행사 기본정보에서
 * 채우고 뒤엣것은 이 화면에서 채운다. 그림이 그렇게 갈라 그렸다.
 */
function conditionsOf(event: EventRow, survey: SurveyRow, questionTypes: string[]) {
  const basics: ConditionRow[] = [
    condition('title', '행사명', event.title.trim() !== '', {
      detail: '행사명이 입력되지 않았습니다',
      locationNote: '입력 위치: 행사 기본정보 → 행사명',
      go: 'basics',
    }),
    condition('startAt', '시작 일시', event.startAt !== null, {
      detail: '시작 일시가 설정되지 않았습니다',
      locationNote: '입력 위치: 행사 기본정보 → 일시',
      go: 'basics',
    }),
    // **안 적은 것과 안 정하기로 한 것은 다른 사실이다**(표가 그 둘을 갈라 둔다).
    // 안 정하기로 했으면 채울 것이 없으므로 못 채운 것이 아니다.
    condition('endAt', '종료 일시', event.endAt !== null || event.endUnset, {
      detail: '종료 일시가 설정되지 않았습니다',
      locationNote: '입력 위치: 행사 기본정보 → 일시',
      go: 'basics',
    }),
    condition('place', '장소', event.place !== null || event.placeUnset, {
      detail: '장소가 입력되지 않았습니다',
      locationNote: '입력 위치: 행사 기본정보 → 장소',
      go: 'basics',
    }),
    condition('audience', '참가 대상', event.audience !== null, {
      detail: '참가 대상이 입력되지 않았습니다',
      locationNote: '입력 위치: 행사 기본정보 → 참가 대상',
      go: 'basics',
    }),
    condition('feeType', '참가비 유형', event.feeType !== 'undecided', {
      detail: '참가비 유형이 정해지지 않았습니다',
      locationNote: '입력 위치: 행사 기본정보 → 참가비',
      go: 'basics',
    }),
    // **학생회비 조건부일 때만 채울 것이 있다.** 그림이 그 줄의 입력 위치를
    // '참가비(학생회비 조건부)'라고 적었다 — 정액일 때 어느 금액을 쓰는지는
    // 명세가 끝까지 말하지 않으므로(표 머리가 적어 둔 자리다) 여기서 정하지 않는다.
    condition(
      'feeAmounts',
      '납부자·미납자 금액·결제 안내',
      event.feeType !== 'duesConditional' ||
        (event.paidAmount !== null && event.unpaidAmount !== null && event.payGuide !== null),
      {
        detail: '금액과 결제 안내를 입력하세요',
        locationNote: '입력 위치: 행사 기본정보 → 참가비(학생회비 조건부)',
        go: 'basics',
      },
    ),
    condition('capacityType', '행사 정원 유형', event.capacityType !== 'undecided', {
      detail: '정원 유형이 정해지지 않았습니다',
      locationNote: '입력 위치: 행사 기본정보 → 정원',
      go: 'basics',
    }),
    // 제한이 없으면 적을 인원이 없다.
    condition(
      'capacity',
      '정원 인원',
      event.capacityType === 'unlimited' || event.capacityCount !== null,
      {
        detail: '정원 인원이 입력되지 않았습니다',
        locationNote: '입력 위치: 행사 기본정보 → 정원',
        go: 'basics',
      },
    ),
  ]

  const settings: ConditionRow[] = [
    condition('applyEnd', '신청 마감 일시', survey.closesAt !== null, {
      detail: '신청 마감 일시가 설정되지 않았습니다',
      locationNote: '입력 위치: 모집 설정',
      go: 'settings',
    }),
    // 시작을 안 적으면 곧바로 여는 것이라 순서가 어긋날 수 없다. 둘 다 있을 때만 본다.
    condition(
      'applyOrder',
      '신청 시작·마감 순서',
      survey.opensAt === null || survey.closesAt === null || survey.opensAt < survey.closesAt,
      {
        detail: '신청 시작이 마감보다 늦습니다',
        locationNote: '입력 위치: 모집 설정',
        go: 'settings',
      },
    ),
    // **표가 비워 둘 수 없는 값이다.** 선착순이 기본이므로 늘 채워져 있다.
    condition('applyMethod', '신청 방식', true, {
      detail: '신청 방식이 정해지지 않았습니다',
      locationNote: '입력 위치: 모집 설정',
      go: 'settings',
    }),
    condition('privacyConsent', '개인정보 수집·이용 동의', questionTypes.includes('privacy'), {
      detail: '개인정보 수집·이용 동의 문항이 없습니다',
      locationNote: '입력 위치: 설문 문항',
      go: 'questions',
    }),
    // **이름과 학번은 문항이 아니라 고정 칸이다**(머리 주석). 신청은 그 둘 없이 들어올
    // 수 없으므로 셋은 늘 참이다 — 그림이 그린 줄이라 초록으로 그린다.
    condition('nameField', '이름 필수 문항', true, {
      detail: '이름 문항이 없습니다',
      locationNote: '입력 위치: 설문 문항',
      go: 'questions',
    }),
    condition('studentNumberField', '학번 필수 문항', true, {
      detail: '학번 문항이 없습니다',
      locationNote: '입력 위치: 설문 문항',
      go: 'questions',
    }),
    condition('duesMatchField', '학생회비 대조용 식별 문항', true, {
      detail: '학생회비 대조에 쓸 문항이 없습니다',
      locationNote: '입력 위치: 설문 문항',
      go: 'questions',
    }),
  ]

  return [
    { groupLabel: '행사 기본정보', rows: basics },
    { groupLabel: '참여 설문 설정', rows: settings },
  ]
}

/** 이 설문의 문항들이 가진 갈래. 조건 셈이 그중 하나를 본다. */
async function questionTypesOf(db: Db, orgId: string, surveyId: string): Promise<string[]> {
  const rows = await db
    .select({ type: surveyQuestions.type })
    .from(surveyQuestions)
    .where(and(eq(surveyQuestions.orgId, orgId), eq(surveyQuestions.surveyId, surveyId)))
  return rows.map((row) => row.type)
}

/**
 * 조건 목록과 못 채운 수와 지금의 설문을 **한 셈**으로.
 *
 * 딱지(`surveyActivation`)·목록(`surveyActivationConditions`)·막힘(`activateSurvey`)이
 * 전부 여기서 나온다. 셋 중 하나가 따로 세면 언젠가 목록에는 빨간 줄이 둘인데 딱지는
 * '미충족 3개'이고, 단추는 눌리는데 서버는 막는 날이 온다.
 */
async function activationOf(db: Db, orgId: string, eventId: string) {
  const { event, survey } = await setupOf(db, orgId, eventId)
  const groups = conditionsOf(event, survey, await questionTypesOf(db, orgId, survey.id))
  const unmet = groups.flatMap((group) => group.rows).filter((row) => row.met === '').length
  return { survey, groups, unmet }
}

/** 못 채운 채로 켜려 할 때의 까닭. 딱지 옆의 글과 막힐 때의 글이 **같은 글**이다. */
function blockedNoteOf(unmet: number): string {
  return `아직 채우지 않은 활성화 조건이 ${unmet}개 있습니다.`
}

export async function surveyActivationConditions(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<ConditionGroup[]> {
  return (await activationOf(db, orgId, eventId)).groups
}

export interface SurveyActivation {
  unmetCountNote: string
  unmetCount: number
  canActivate: boolean
  blockedNote?: string
}

/**
 * 지금 링크를 켤 수 있는가(EVT-05의 단추와 그 옆 딱지).
 *
 * **같은 목록을 세어서 답한다.** 조건이 늘거나 줄면 딱지의 수도 함께 움직인다.
 */
export async function surveyActivation(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<SurveyActivation> {
  const { unmet } = await activationOf(db, orgId, eventId)
  const answer: SurveyActivation = {
    unmetCountNote: `미충족 ${unmet}개`,
    unmetCount: unmet,
    canActivate: unmet === 0,
  }
  // 계약이 optional로 적었다 — 막히지 않았으면 까닭도 없다.
  if (unmet > 0) answer.blockedNote = blockedNoteOf(unmet)
  return answer
}

/**
 * 참여 설문 링크를 켠다(EVT-05 · event.survey.activate).
 *
 * **막는 것은 서버다.** 화면의 단추는 `canActivate`를 보고 눌리지만 그것은 그림이고,
 * 화면을 우회한 요청도 같은 셈으로 막혀야 한다 — 못 채운 것이 하나라도 있으면 막히고
 * 그 까닭은 딱지 옆의 글과 같다.
 *
 * **못 채운 것은 409다.** 한동안 422였는데 이 자리는 몸통이 없어 계약에 422가 없고,
 * 422는 '보낸 값이 틀렸다'는 뜻이라 화면이 없는 칸을 짚는다. 조건을 못 채운 것은
 * 지금 상태가 이 일을 못 받는다는 뜻이고, 그것은 '이미 켜져 있다'와 같은 계급이다.
 *
 * 계약이 conflict라 적었다: 이미 켜진 설문을 또 켤 수 없다(409). 갈아 끼워진 설문도
 * 다시 켜지 않는다 — 그 링크는 새 설문을 가리키고 있다.
 */
export async function activateSurvey(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<Record<string, never>> {
  const { survey, unmet } = await activationOf(db, orgId, eventId)
  if (survey.replacedById !== null) throw new AlreadyExists('교체된 설문은 다시 켤 수 없습니다')
  if (survey.active) throw new AlreadyExists('이미 켜진 설문입니다')
  if (unmet > 0) throw new NotReady(blockedNoteOf(unmet))
  await db
    .update(surveys)
    .set({ active: true })
    // 고칠 때도 학생회를 다시 건다. 위에서 찾았다고 빼면 울타리가 한 겹이 된다.
    .where(and(eq(surveys.orgId, orgId), eq(surveys.id, survey.id)))
  // 계약이 '돌려주는 값이 없다'고 적었다.
  return {}
}
