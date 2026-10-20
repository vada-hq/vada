import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Hono } from 'hono'
import { ERROR_STATUS, type ErrorCode } from '@vada/contracts'
import { ApiError, errorResponse } from './errors.js'

test('ApiError의 상태와 직접 만든 오류 응답의 상태가 오류 목록과 같다', async () => {
  const app = new Hono()
  app.get('/:code', c => errorResponse(c, c.req.param('code') as ErrorCode))
  for (const [code, status] of Object.entries(ERROR_STATUS)) {
    assert.equal(new ApiError(code as ErrorCode).status, status, code)
    const response = await app.request(`/${code}`)
    assert.equal(response.status, status, code)
    assert.deepEqual(await response.json(), { error: code })
  }
})
