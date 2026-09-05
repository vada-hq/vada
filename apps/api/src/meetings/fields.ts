import { Blocked } from '../routes.ts'

// 화면이 보낸 몸통에서 칸 하나를 읽는다. 회의록과 회의 관리가 나눠 쓴다.
//
// **읽지 못하는 값은 막는다.** 조용히 비우거나 거짓으로 읽으면 사람은 적었다고 믿고
// 저장소에는 없다 — 회의 만들기(`create.ts`)가 같은 자리에서 같은 규칙을 지킨다.

/** 글 칸 하나. **빈 글은 저장하지 않는다** — 지운 것과 안 적은 것을 같게 둔다. */
export function readWord(
  draft: Record<string, unknown>,
  key: string,
  label: string,
): string | null {
  const value = draft[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Blocked(`${label} 칸은 글로 적어 주세요`)
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * 켜고 끄는 칸.
 *
 * **두 꼴로 온다.** 계약은 참거짓이라 적었고 화면의 체크 상자는 켜짐을 `'y'`로 담는다
 * (OPS-MEET-06B의 두 체크). 어느 쪽이든 같은 뜻으로 읽되, **모르는 값은 막는다.**
 */
export function readFlag(draft: Record<string, unknown>, key: string, label: string): boolean {
  const value = draft[key]
  if (typeof value === 'boolean') return value
  if (value === null || value === undefined || value === '') return false
  if (value === 'y' || value === 'true') return true
  if (value === 'n' || value === 'false') return false
  throw new Blocked(`${label} 칸은 참 또는 거짓이어야 합니다`)
}
