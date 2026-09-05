import { and, asc, desc, eq, sql } from 'drizzle-orm'
import optionSourcesJson from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import { surveyApplications, surveyQuestions, surveys } from '../db/schema.ts'
import { AlreadyExists, Blocked, NotFound } from '../routes.ts'

// 참여 설문 한 건과 그것을 갈아 끼울 때의 여파, 그리고 갈아 끼우기(EVT-05 · EVT-05B).
//
// **설문의 상태는 행사의 상태와 다른 축이다.** 명세가 그렇게 못 박았다 — 초안·활성·
// 교체됨은 설문의 것이고 기획 중·진행 중은 행사의 것이다(회의의 status와
// minutesStatus가 갈린 것과 같다).

/**
 * 지금 이 행사의 설문.
 *
 * **가장 최근 것이다.** 교체하면 옛 설문이 남은 채 새 것이 생기므로(옛 링크가 새
 * 설문으로 갈 수 있어야 한다) 한 행사에 여러 줄이 있을 수 있다. 화면이 보는 것은
 * 지금의 설문이고, 지금의 것은 마지막에 만들어진 것이다.
 */
async function currentSurvey(db: Db, orgId: string, eventId: string) {
  const rows = await db
    .select({
      id: surveys.id,
      active: surveys.active,
      replacedById: surveys.replacedById,
    })
    .from(surveys)
    .where(and(eq(surveys.orgId, orgId), eq(surveys.eventId, eventId)))
    .orderBy(desc(surveys.createdAt), desc(surveys.id))
    .limit(1)
  const row = rows[0]
  // **없는 것은 없다고 한다.** 빈 딱지를 그리면 '초안'과 '아직 안 만들었다'가 같아진다.
  if (row === undefined) throw new NotFound('이 행사의 참여 설문이 아직 없습니다')
  return row
}

export interface EventSurvey {
  statusLabel: string
  statusTone: string
  previewUrl?: string
}

/**
 * 설문 한 건의 상태(EVT-05 · EVT-05B의 머리 딱지).
 *
 * **`previewUrl`은 아직 오지 않는다.** 설문 링크가 어느 주소에 놓이는지를 배포가
 * 말해 주는 자리가 없다 — 지금 있는 것은 초대 링크의 자리(`invite.linkBase`)뿐이고
 * 그것은 다른 링크다. 주소를 지어내면 사람이 그 주소를 눌러 보고서야 안다.
 * 계약이 optional로 적었으므로 없을 때는 아예 오지 않는다.
 */
export async function eventSurvey(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<EventSurvey> {
  const row = await currentSurvey(db, orgId, eventId)
  // 갈아 끼워진 설문은 닫힌 것이고, 열지 않은 것은 아직 초안이다. **셋이 다른 사실이다.**
  if (row.replacedById !== null) return { statusLabel: '교체됨', statusTone: 'gray' }
  return row.active
    ? { statusLabel: '활성', statusTone: 'green' }
    : { statusLabel: '초안', statusTone: 'gray' }
}

/**
 * 갈아 끼우면 무엇이 어떻게 되는지(EVT-05B).
 *
 * **여기 적힌 넷은 이 동작이 하는 일 그대로다** — 옛 설문은 `replacedById`를 갖고
 * 닫히고(그래서 '교체됨'이 된다), 낸 신청은 지워지지 않으며, 새 설문은 신청을
 * 하나도 안 가진 채로 서고, 옛 링크는 새 설문을 가리킨다(`survey.linkState`가 그
 * 자리를 이미 답한다). 화면이 이 말을 들면 동작을 고칠 때 함께 안 고쳐진다.
 */
const NOTES: readonly string[] = [
  "기존 설문은 '교체됨' 상태로 변경됩니다.",
  '기존 응답자 데이터는 삭제되지 않고 보관됩니다.',
  '기존 응답자는 새 설문에 다시 응답해야 합니다.',
  '기존 링크에서는 새 설문으로 이동 버튼이 표시됩니다.',
]

export interface SurveyReplaceImpact {
  title: string
  warning: string
  currentRespondents: string
  affectedRespondents: string
  notes: Array<{ text: string }>
}

export async function surveyReplaceImpact(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<SurveyReplaceImpact> {
  const row = await currentSurvey(db, orgId, eventId)
  // **세는 것은 서버가 한다.** 이 화면은 응답 목록을 아예 받지 않는다.
  const counted = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(surveyApplications)
    .where(eq(surveyApplications.surveyId, row.id))
  const total = Number(counted[0]?.total ?? 0)

  return {
    title: '새 설문으로 교체하시겠어요?',
    warning: '응답이 존재하는 설문은 직접 수정할 수 없습니다.',
    currentRespondents: `${total}명`,
    // 낸 것은 남지만 새 설문에는 다시 내야 한다 — 그래서 **전부가 영향을 받는다.**
    affectedRespondents: `${total}명 (재응답 필요)`,
    notes: NOTES.map((text) => ({ text })),
  }
}

/** 새 초안을 어떻게 시작할지 — **명세가 갖고 있다**(event.surveyReplaceModes). 두 벌을 들면 갈린다. */
const REPLACE_MODES: readonly string[] =
  (
    optionSourcesJson.sources.find((source) => source.key === 'event.surveyReplaceModes') as
      | { options: Array<{ value: string }> }
      | undefined
  )?.options.map((option) => option.value) ?? []

export interface SurveyMakers {
  newId: () => string
  /** 새 링크의 열쇠. **밖에서 받는다** — 추측할 수 없어야 하고 검사는 정해 줄 수 있어야 한다. */
  newToken: () => string
}

/**
 * 기존 설문을 끝내고 새 설문 초안을 만든다(EVT-05B · event.survey.replace).
 *
 * `surveyReplaceImpact`가 말한 넷이 여기서 그대로 일어난다: 옛 설문은 `replacedById`를
 * 갖고 닫히고(그래서 '교체됨'), 낸 신청은 그대로 남고, 새 설문은 신청을 하나도 안 가진
 * 채로 서며, 옛 링크는 새 설문의 열쇠를 안내한다(`survey.linkState`가 그 자리를 답한다).
 *
 * - `copyQuestions` — 문항 구조만 따라온다. 명세가 '질문 구조만 복사. 응답 데이터는
 *   복사하지 않습니다'라고 적었다. 모집 설정(기간·방식·정원·안내 문구)은 새 초안이
 *   비운 채로 시작한다 — 명세가 문항만 말했고, 옛 마감을 물려받으면 켜기 조건이 말없이
 *   채워진 채 선다. 비어 있는 것은 EVT-05의 칸에 그대로 보이므로 조용하지 않다.
 * - `blank` — 문항이 없다. 이름·학번은 문항이 아니라 고정 칸이라(2026-09-05에 정함)
 *   만들 줄이 없다.
 *
 * **열지 않은 설문은 끝낼 것이 없다.** 계약이 conflict라 적었다 — 두 번 누르면 방금
 * 만든 초안이 또 갈리는데, 그 초안은 아직 열리지 않았으므로 여기서 막힌다(409).
 *
 * **새 열쇠는 밖에서 온다.** 옛 것에서 유도하면 옛 링크를 가진 사람이 새 것을 만든다.
 * 만든 때는 표가 찍는다 — 지금의 설문은 '마지막에 만들어진 것'이므로 새 것이 그 자리에
 * 선다. 새 것을 먼저 만들고 옛 것을 닫는다: 그 사이에 멈춰도 옛 링크가 없는 곳을
 * 가리키지는 않는다.
 */
export async function replaceSurvey(
  db: Db,
  orgId: string,
  eventId: string,
  draft: Record<string, unknown>,
  make: SurveyMakers,
): Promise<Record<string, never>> {
  const current = await currentSurvey(db, orgId, eventId)
  const mode = typeof draft.replaceMode === 'string' ? draft.replaceMode.trim() : ''
  if (mode === '') throw new Blocked('새 설문 초안 생성 방식을 골라 주세요')
  if (!REPLACE_MODES.includes(mode)) throw new Blocked('명세에 없는 설문 초안 생성 방식입니다')
  if (current.replacedById !== null) throw new AlreadyExists('이미 교체된 설문입니다')
  if (!current.active) throw new AlreadyExists('아직 열지 않은 설문은 끝낼 것이 없습니다')

  const id = make.newId()
  await db
    .insert(surveys)
    .values({ id, orgId, eventId, linkToken: make.newToken(), active: false })
  if (mode === 'copyQuestions') {
    const questions = await db
      .select({
        sortOrder: surveyQuestions.sortOrder,
        title: surveyQuestions.title,
        type: surveyQuestions.type,
        required: surveyQuestions.required,
        locked: surveyQuestions.locked,
      })
      .from(surveyQuestions)
      .where(and(eq(surveyQuestions.orgId, orgId), eq(surveyQuestions.surveyId, current.id)))
      .orderBy(asc(surveyQuestions.sortOrder), asc(surveyQuestions.id))
    if (questions.length > 0) {
      await db
        .insert(surveyQuestions)
        .values(questions.map((question) => ({ id: make.newId(), orgId, surveyId: id, ...question })))
    }
  }
  await db
    .update(surveys)
    .set({ active: false, replacedById: id })
    .where(and(eq(surveys.orgId, orgId), eq(surveys.id, current.id)))
  // 계약이 '돌려주는 값이 없다'고 적었다.
  return {}
}
