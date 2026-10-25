import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { test } from 'node:test'

// 서버 코드가 지금 시각을 직접 읽으면 앱의 시계를 미뤄도 그 곳만 실제 시각으로 판단한다.
// 시계는 `() => new Date()` 꼴로 정의만 하고(운영 진입점과 라우트 기본값), 읽는 곳은 clock()을 쓴다.
const root = import.meta.dirname

// 직접 읽어도 되는 곳. 이유 없이 늘리지 않는다.
const ALLOWED = new Map([['ops/pg-smoke/', '실제 DB에 대한 걸린 시간 측정이라 앱 시계와 무관하다']])
const isChecked = (file: string) =>
  file.endsWith('.ts') &&
  !file.endsWith('.test.ts') &&
  !file.includes('test-support/') &&
  !file.endsWith('test-db.ts') &&
  ![...ALLOWED.keys()].some(prefix => file.startsWith(prefix))

function sourcesOf(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory()
      ? sourcesOf(join(dir, entry.name))
      : [relative(root, join(dir, entry.name)).split(sep).join('/')],
  )
}

const DIRECT = /(?<!=>\s*)new Date\(\s*\)|Date\.now\(\)/
const commentOnly = (line: string) => /^\s*(\/\/|\*|\/\*)/.test(line)

test('서버 코드는 지금 시각을 직접 읽지 않는다(시계 정의 `() => new Date()` 꼴만 둔다)', () => {
  const found: string[] = []
  for (const file of sourcesOf(root).filter(isChecked))
    readFileSync(join(root, file), 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (!commentOnly(line) && DIRECT.test(line)) found.push(`${file}:${index + 1}`)
      })
  assert.deepEqual(
    found,
    [],
    'clock()을 받아 쓴다. 정말 직접 읽어야 하면 ALLOWED에 이유와 함께 적는다',
  )
})

test('판별 규칙: 직접 읽기만 걸리고 시계 정의는 통과한다', () => {
  assert.ok(DIRECT.test('const now = new Date()'))
  assert.ok(DIRECT.test('const t = Date.now()'))
  assert.ok(DIRECT.test('x(new Date( ))'))
  assert.ok(!DIRECT.test('const clock = options.clock ?? (() => new Date())'))
  assert.ok(!DIRECT.test('$onUpdate(() => new Date())'))
  assert.ok(!DIRECT.test('new Date(value)'))
})
