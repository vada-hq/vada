import assert from 'node:assert/strict'
import { test } from 'node:test'
import type postgres from 'postgres'
import { objectPurgeLockOf } from './orphan-connection.js'

test('Neon 풀링 주소는 잠금 연결에서만 직접 주소로 바꾸고 자격·DB·TLS 설정은 유지한다', async () => {
  for (const suffix of ['-pooler', '']) {
    const url = `postgresql://user:p%40ss@ep-blue-sky-a123${suffix}.ap-southeast-1.aws.neon.tech/vada?sslmode=require&connect_timeout=15`
    const opened: string[] = []
    const ended: number[] = []
    const lock = objectPurgeLockOf(url, direct => {
      opened.push(direct)
      return {
        unsafe: async () => [{ locked: true }],
        end: async () => {
          ended.push(1)
        },
      } as unknown as Pick<postgres.Sql, 'unsafe' | 'end'>
    })
    assert.deepEqual(opened, [])
    let ran = false
    assert.equal(
      await lock(async () => {
        ran = true
      }),
      true,
    )
    assert.equal(ran, true)
    assert.deepEqual(opened, [url.replace('-pooler.', '.')])
    assert.deepEqual(ended, [1])
  }
})

test('직접 주소를 판별할 수 없으면 연결·작업 없이 개수나 비밀 없는 한 줄만 남긴다', async () => {
  const invalid = [
    undefined,
    '',
    'secret-url',
    'https://ep-blue-sky-pooler.ap-southeast-1.aws.neon.tech/vada',
    'postgres://user:secret@pooler.example/vada',
    'postgres://user:secret@ep-blue-sky-pooler.neon.tech.evil.test/vada',
    'postgres://user:secret@ep-blue-sky-pooler.ap-southeast-1.aws.neon.tech:6543/vada',
    'postgres://user:secret@ep-blue-sky.ap-southeast-1.aws.neon.tech/vada?host=pooler.example',
  ]
  const logs: string[] = []
  const original = console.error
  console.error = (line: string) => logs.push(line)
  try {
    for (const url of invalid) {
      const lock = objectPurgeLockOf(url, () => assert.fail('연결하면 안 됨'))
      assert.equal(await lock(async () => assert.fail('작업하면 안 됨')), false)
    }
    assert.equal(logs.length, invalid.length)
    assert.equal(new Set(logs).size, 1)
    assert.doesNotMatch(logs.join(''), /secret|postgres|listed|removed|failed|\d|\n/)
  } finally {
    console.error = original
  }
})
