import { Blocked } from './errors.ts'

/** 선택 입력을 앞뒤 공백이 제거된 글 또는 빈 값으로 읽는다. */
export function readWord(body: Record<string, unknown>, key: string, label: string): string | null {
  const value = body[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Blocked(`${label} 칸은 글로 적어 주세요`)
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}
