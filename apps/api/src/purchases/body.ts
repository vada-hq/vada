import { Blocked } from '../routes.ts'
import { momentOf } from '../time.ts'

// 구매 요청 흐름의 쓰기 여섯이 몸통을 읽는 규칙.
//
// **화면이 보내는 꼴이 계약이 적은 꼴과 다르다.** 화면은 초안(상태 스코프)을 그대로 보내므로
// 되풀이되는 묶음이 평평한 맵으로 온다 — `items: 'r0\nr1'`과 `items.r0.itemName`. 계약(OpenAPI)은
// 줄의 배열이라 적었다. 어느 쪽으로 와도 같은 뜻으로 읽되 **모르는 모양은 막는다**(422).
// 예산 편성(`finance/budget-plan.ts`)과 회의 만들기(`meetings/create.ts`)가 같은 규칙을 지킨다 —
// 그 파일들의 읽개는 밖으로 나오지 않아 여기 다시 두었다.

export type Body = Record<string, unknown>

/** 몸통이 물건 하나인가. 배열이나 글이 오면 무엇의 초안인지 알 수 없다. */
export function objectOf(body: unknown, label: string): Body {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new Blocked(`${label}의 모양이 아닙니다`)
  }
  return body as Body
}

/** 화면이 초안에 줄 이름을 이어 담는 글자(`spec/compute.ts`의 joinRowIds). */
const ROW_SEPARATOR = '\n'

/**
 * 목록 하나의 줄들. 계약이 적은 배열이면 그대로, 화면이 보낸 평평한 꼴이면 줄 이름마다 모은다.
 */
export function rowsOf(body: Body, listKey: string, label: string): Body[] {
  const slot = body[listKey]
  if (slot === undefined || slot === null || slot === '') return []
  if (Array.isArray(slot)) {
    return slot.map((row, index) => {
      if (row === null || typeof row !== 'object' || Array.isArray(row)) {
        throw new Blocked(`${label} ${index + 1}번째 줄의 모양이 아닙니다`)
      }
      return row as Body
    })
  }
  if (typeof slot !== 'string') throw new Blocked(`${label} 목록의 모양이 아닙니다`)
  return slot
    .split(ROW_SEPARATOR)
    .map((rowId) => rowId.trim())
    .filter((rowId) => rowId !== '')
    .map((rowId) => {
      const prefix = `${listKey}.${rowId}.`
      const row: Body = {}
      for (const [key, value] of Object.entries(body)) {
        if (key.startsWith(prefix)) row[key.slice(prefix.length)] = value
      }
      return row
    })
}

/** 글 칸 하나. **빈 글은 없는 것이다** — 지운 것과 안 적은 것을 같게 둔다. */
export function readWord(body: Body, key: string, label: string): string | null {
  const value = body[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Blocked(`${label} 칸은 글로 적어 주세요`)
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * 세는 수(수량·금액). **0 이상의 정수다** — 표가 정수이고 원 아래 단위가 없다.
 *
 * 화면은 수를 글로 실어 보내고(초안은 글의 맵이다) 계약은 수라 적었으므로 둘 다 받는다.
 * 자릿점이 찍힌 글도 수다. 비어 있으면 없는 것이다 — 0은 값이라 빈 것과 섞지 않는다.
 */
export function readCount(body: Body, key: string, label: string): number | null {
  const value = body[key]
  if (value === null || value === undefined || value === '') return null
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(/,/g, '').trim())
        : Number.NaN
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Blocked(`${label} 칸은 0 이상의 정수여야 합니다`)
  }
  return parsed
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * 날짜 칸. `YYYY-MM-DD`이고 달력에 있는 날이어야 한다(2월 30일은 날이 아니다).
 *
 * **그 날의 자정을 서버가 못 박은 시간대로 읽는다**(`time.ts`). 표가 때(timestamptz)를 담으므로
 * 어느 시간대의 자정인지가 정해져 있어야 읽을 때 같은 날이 돌아온다.
 */
export function readDay(body: Body, key: string, label: string): Date | null {
  const word = readWord(body, key, label)
  if (word === null) return null
  const when = DAY.test(word) ? momentOf(`${word}T00:00`) : null
  if (when === null) throw new Blocked(`${label} 칸은 YYYY-MM-DD 꼴의 날짜여야 합니다`)
  return when
}
