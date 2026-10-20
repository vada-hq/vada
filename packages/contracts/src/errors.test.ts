import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ERROR_STATUS, statusOf } from './errors.js'

test('오류 코드마다 4xx나 5xx 상태 하나가 정해져 있다', () => {
  for (const [code, status] of Object.entries(ERROR_STATUS)) {
    assert.match(code, /^[A-Z_]+$/)
    assert.ok(status >= 400 && status < 600, code)
  }
})

test('응답 계약으로 이미 나간 코드와 상태는 그대로다', () => {
  assert.deepEqual(
    [
      statusOf('INVALID_INPUT'),
      statusOf('UNAUTHENTICATED'),
      statusOf('FORBIDDEN'),
      statusOf('NOT_FOUND'),
      statusOf('VERSION_CONFLICT'),
      statusOf('BODY_TOO_LARGE'),
      statusOf('UNSUPPORTED_MEDIA_TYPE'),
      statusOf('DELIVERY_PROVIDER_FAILED'),
    ],
    [400, 401, 403, 404, 409, 413, 415, 502],
  )
})
