import optionSources from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import { Blocked } from '../errors.ts'

/** 명세가 든 선택지. **여기 목록을 다시 적지 않는다** — 두 벌은 갈린다. */
function choicesOf(key: string): Array<{ value: string; label: string }> {
  const sources = optionSources.sources as Array<{
    key: string
    options?: Array<{ value: string; label: string }>
  }>
  const found = sources.find((one) => one.key === key)
  if (found?.options === undefined) {
    throw new Error(`선택지 '${key}'가 명세에 없습니다.`)
  }
  return found.options.map((option) => ({ value: option.value, label: option.label }))
}

export const ORG_TYPES = choicesOf('org.types')
export const OPERATING_YEARS = choicesOf('org.operatingYears')
export const SETUP_MODES = choicesOf('org.setupModes')
export const CURRENT_GRADES = choicesOf('education.currentGrades')

/** 값에서 그려지는 말로. 못 찾으면 null — 지어내지 않는다. */
export function labelOf(choices: Array<{ value: string; label: string }>, value: string | null) {
  if (value === null) return null
  return choices.find((choice) => choice.value === value)?.label ?? null
}

/**
 * 받침이 있는가. **조사를 고르는 데 쓴다.**
 *
 * '학생회명을(를) 적어 주세요'는 완성된 글이 아니다 — 서버가 완성해서 주기로 한
 * 이상 조사도 서버가 고른다. 한글 음절이 아닌 끝(영문·숫자)은 알 수 없으므로 덜
 * 어색한 쪽으로 기운다.
 */
function hasFinalConsonant(word: string): boolean {
  const last = (word.at(-1) ?? '').codePointAt(0) ?? 0
  if (last < 0xac00 || last > 0xd7a3) return false
  return (last - 0xac00) % 28 !== 0
}

/** 글 칸 하나. **빈 글은 없는 것으로 본다** — 화면의 빈 칸이 `''`로 온다. */
export function readWord(draft: Record<string, unknown>, key: string, label: string): string {
  const value = draft[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Blocked(`${label}${hasFinalConsonant(label) ? '을' : '를'} 적어 주세요`)
  }
  return value.trim()
}

/** 있으면 그 글, 없으면 없는 것. **비워 둘 수 있는 칸에 쓴다** — 지어내서 채우지 않는다. */
export function readMaybe(draft: Record<string, unknown>, key: string): string | null {
  const value = draft[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** 명세가 든 선택지가 아니면 막는다. `event.saveBasics`가 참가비 유형에 쓰는 것과 같다. */
export function readChoice(
  draft: Record<string, unknown>,
  key: string,
  choices: Array<{ value: string }>,
  label: string,
): string {
  const value = draft[key]
  if (typeof value !== 'string' || !choices.some((choice) => choice.value === value)) {
    throw new Blocked(`그런 ${label}${hasFinalConsonant(label) ? '은' : '는'} 없습니다`)
  }
  return value
}
