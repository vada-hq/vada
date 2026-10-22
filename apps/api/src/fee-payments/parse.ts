import { FEE_PAYMENT_BATCH_MAX, INVALID_LINES_MAX, STUDENT_ID_PATTERN } from '@vada/contracts'

export type ParsedStudents =
  | { kind: 'ok'; ids: string[]; total: number }
  | { kind: 'invalid'; lines: number[] }
  | { kind: 'unusable' }

// 붙여 넣은 글을 줄바꿈·쉼표·공백으로 나눠 학번을 꺼낸다. 형식이 틀린 학번이 하나라도 있으면 그 줄 번호(1부터)만 돌려주고
// 아무것도 받지 않는다. 같은 학번이 글 안에서 되풀이되면 한 번만 센다. 비었거나 20,000개를 넘으면 쓸 수 없는 입력이다.
export function parseStudents(input: string): ParsedStudents {
  const seen = new Set<string>()
  const invalid = new Set<number>()
  let total = 0
  const lines = input.split(/\r\n|\r|\n/)
  for (const [index, line] of lines.entries())
    for (const part of line.split(/[\s,]+/)) {
      if (!part) continue
      total++
      if (!STUDENT_ID_PATTERN.test(part)) invalid.add(index + 1)
      else seen.add(part)
    }
  if (total === 0 || total > FEE_PAYMENT_BATCH_MAX) return { kind: 'unusable' }
  if (invalid.size) return { kind: 'invalid', lines: [...invalid].slice(0, INVALID_LINES_MAX) }
  return { kind: 'ok', ids: [...seen], total }
}
