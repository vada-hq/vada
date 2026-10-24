import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withoutSeparator } from './script-args.js'

test('맨 앞의 --만 뺀다', () => {
  assert.deepEqual(withoutSeparator(['--', '--apply']), ['--apply'])
  assert.deepEqual(withoutSeparator(['--apply']), ['--apply'])
  assert.deepEqual(withoutSeparator(['seed', '--', 'x']), ['seed', '--', 'x'])
  assert.deepEqual(withoutSeparator([]), [])
})
