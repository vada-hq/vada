import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('서버의 객체 정리 잠금은 요청용 DB 주소를 직접 연결 판별에 넘긴다', () => {
  const source = readFileSync(new URL('./serve.ts', import.meta.url), 'utf8')
  assert.match(source, /objectPurgeLockOf\(env\.DATABASE_URL, connectClient\)/)
  assert.doesNotMatch(source, /createObjectPurgeLock/)
})
