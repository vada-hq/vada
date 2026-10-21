import type { ZodType } from 'zod'
import { ApiError } from './errors.js'

// 쿼리 문자열을 스키마로 읽는다. 같은 키를 두 번 준 쿼리는 어느 값을 쓸지 정할 수 없어 400이다. 모르는 키와 틀린 값도 400이다.
export function parseQuery<T>(schema: ZodType<T>, queries: Record<string, string[]>): T {
  const entries = Object.entries(queries)
  if (entries.some(([, values]) => values.length !== 1)) throw new ApiError('INVALID_INPUT')
  const parsed = schema.safeParse(
    Object.fromEntries(entries.map(([key, values]) => [key, values[0]])),
  )
  if (!parsed.success) throw new ApiError('INVALID_INPUT')
  return parsed.data
}
