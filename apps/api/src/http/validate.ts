import { sValidator } from '@hono/standard-validator'
import type { StandardSchemaV1 } from '@standard-schema/spec'

// 인증보다 앞에 둔다. 형식이 틀린 요청은 DB 조회 없이 거절한다.
export const json = <S extends StandardSchemaV1>(schema: S) =>
  sValidator('json', schema, (result, c) => {
    if (!result.success) return c.json({ error: 'INVALID_INPUT' }, 400)
  })
