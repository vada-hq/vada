import { and, asc, eq } from 'drizzle-orm'
import optionSources from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import { surveyQuestions } from '../db/schema.ts'
import { setupOf } from './survey-setup.ts'

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
