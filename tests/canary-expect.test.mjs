import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fixtureText, nonFixtureWebText } from '../scripts/canary-source-text.mjs'

test('카나리 기대값은 도메인별 fixture 모듈까지 훑어 만든다', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'vada-canary-source-'))
  const development = join(root, 'development')
  const modules = join(development, 'fixtures')
  mkdirSync(modules, { recursive: true })
  context.after(() => rmSync(root, { recursive: true, force: true }))

  writeFileSync(join(development, 'data-fixtures.ts'), 'central fixture\n')
  writeFileSync(join(development, 'option-fixtures.ts'), 'option fixture\n')
  writeFileSync(join(modules, 'attendance.ts'), 'attendance fixture\n')
  writeFileSync(join(root, 'screen.tsx'), 'ordinary screen\n')
  writeFileSync(join(root, 'screen.test.tsx'), 'test source\n')

  const fixtures = fixtureText(root)
  assert.match(fixtures, /central fixture/)
  assert.match(fixtures, /option fixture/)
  assert.match(fixtures, /attendance fixture/)

  const elsewhere = nonFixtureWebText(root)
  assert.match(elsewhere, /ordinary screen/)
  assert.doesNotMatch(elsewhere, /central fixture|option fixture|attendance fixture|test source/)
})
