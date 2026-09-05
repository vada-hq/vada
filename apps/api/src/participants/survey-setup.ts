import { and, asc, desc, eq } from 'drizzle-orm'
import optionSources from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import { events, surveyQuestions, surveys } from '../db/schema.ts'
import { NotFound } from '../routes.ts'
import { fieldMoment } from '../time.ts'

// 참여 설문을 세우는 자리(EVT-05).
//
// **막는 것은 서버다.** 화면에 '설문 링크 활성화'가 그려지지만 무엇이 모자란지는
// 화면이 세지 않는다 — 세면 조직의 규칙이 화면에 적히고, 규칙이 바뀔 때마다 화면을
// 고쳐야 한다. 화면이 하는 일은 서버가 준 까닭을 그대로 내놓는 것뿐이다.
//
// 그래서 **딱지의 수와 목록의 빨간 줄이 한 셈에서 나온다**(`conditionsOf`). 두 곳에서
// 세면 언젠가 목록에는 빨간 줄이 둘인데 딱지는 '미충족 3개'라고 말하는 날이 온다.
//
// ## 조건 목록은 그림이 든다 — 열여섯 줄
//
// 명세의 조각은 모양만 말한다(묶음·줄·색·갈 곳). 무엇을 채워야 하는지는 EVT-05가
// **열여섯 줄로 그려 두었다.** 열셋은 표를 보고 답하고, 셋은 **늘 참**이다.
//
// 늘 참인 셋(이름 문항 · 학번 문항 · 학생회비 대조용 식별 문항)은 한동안 못 지었다 —
// 어느 문항이 이름이고 학번인지 표가 몰랐고, 제목 글자로 가르는 것은 운영진이 적은
// 글에 규칙을 거는 일이라서다. **2026-09-05에 사람이 정했다: 이름과 학번은 문항이
// 아니라 설문에 박힌 고정 칸이다.** 운영진이 지울 수 없고, 신청은 그 둘 없이 들어올
// 수 없다(`survey_applications.name`·`studentNumber`가 `notNull`이다). 대조도 학번으로
// 한다. 그래서 셋은 검사할 것이 없이 참이고, 그림이 그린 대로 초록 줄로 그린다 —
// 줄을 빼면 사람은 열여섯을 기대하다 열셋만 보고 무엇이 빠졌는지 찾는다.

/** 문항의 갈래를 사람의 말로. **명세가 든다** — 여기 다시 적으면 두 벌이 갈린다. */
function questionTypeLabels(): Record<string, string> {
  const sources = optionSources.sources as Array<{
    key: string
    options?: Array<{ value: string; label: string }>
  }>
  const source = sources.find((one) => one.key === 'event.surveyQuestionTypes')
  if (source?.options === undefined) {
    throw new Error("선택지 'event.surveyQuestionTypes'가 명세에 없습니다.")
  }
  return Object.fromEntries(source.options.map((option) => [option.value, option.label]))
}

const TYPE_LABEL = questionTypeLabels()

interface EventRow {
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

interface SurveyRow {
  id: string
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
async function setupOf(
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

export async function surveyActivationConditions(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<ConditionGroup[]> {
  const { event, survey } = await setupOf(db, orgId, eventId)
  return conditionsOf(event, survey, await questionTypesOf(db, orgId, survey.id))
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
  const groups = await surveyActivationConditions(db, orgId, eventId)
  const unmet = groups.flatMap((group) => group.rows).filter((row) => row.met === '').length
  const answer: SurveyActivation = {
    unmetCountNote: `미충족 ${unmet}개`,
    unmetCount: unmet,
    canActivate: unmet === 0,
  }
  // 계약이 optional로 적었다 — 막히지 않았으면 까닭도 없다.
  if (unmet > 0) answer.blockedNote = `아직 채우지 않은 활성화 조건이 ${unmet}개 있습니다.`
  return answer
}

export interface SurveyQuestion {
  id: string
  title: string
  typeLabel: string
  badges: Array<{ label: string; tone: string }>
  locked?: string
}

/**
 * 참여 설문의 문항들(EVT-05).
 *
 * **딱지의 개수가 데이터에 달렸다.** 그림이 그린 둘은 '필수 · 삭제 불가'와 '필수'다 —
 * 앞엣것은 지울 수 없는 필수 문항이고 뒤엣것은 지울 수 있는 필수 문항이다. 필수가
 * 아닌 문항에는 아무것도 안 붙는다.
 */
export async function surveyQuestionList(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<SurveyQuestion[]> {
  const { survey } = await setupOf(db, orgId, eventId)
  const rows = await db
    .select({
      id: surveyQuestions.id,
      title: surveyQuestions.title,
      type: surveyQuestions.type,
      required: surveyQuestions.required,
      locked: surveyQuestions.locked,
    })
    .from(surveyQuestions)
    .where(and(eq(surveyQuestions.orgId, orgId), eq(surveyQuestions.surveyId, survey.id)))
    .orderBy(asc(surveyQuestions.sortOrder), asc(surveyQuestions.id))
  return rows.map((row) => {
    const badges: Array<{ label: string; tone: string }> = []
    if (row.required && row.locked) badges.push({ label: '필수 · 삭제 불가', tone: 'gray' })
    else if (row.required) badges.push({ label: '필수', tone: 'blue' })
    else if (row.locked) badges.push({ label: '삭제 불가', tone: 'gray' })
    const question: SurveyQuestion = {
      id: row.id,
      title: row.title,
      typeLabel: TYPE_LABEL[row.type] ?? row.type,
      badges,
    }
    // 계약이 글로 적었고 optional이다 — 잠기지 않은 문항에는 오지 않는다.
    if (row.locked) question.locked = 'y'
    return question
  })
}
