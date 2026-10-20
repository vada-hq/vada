import { sValidator } from '@hono/standard-validator'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import { isStrictObject } from '@vada/contracts'
import { errorResponse } from './errors.js'

// 인증보다 앞에 둔다. 형식이 틀린 요청은 DB 조회 없이 거절한다.
export const json = <S extends StandardSchemaV1>(schema: S) => {
  // 라우트를 만들 때 바로 실패시켜 모르는 키를 받아 주는 스키마가 들어오지 못하게 한다.
  if (!isStrictObject(schema)) throw new Error('json()에는 z.strictObject 스키마만 넘긴다')
  return sValidator('json', schema, (result, c) => {
    if (!result.success) return errorResponse(c, 'INVALID_INPUT')
  })
}
