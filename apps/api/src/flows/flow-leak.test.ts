import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { appModulesOf } from '../app-modules.js'
import { createApp } from '../app.js'
import { createAuth } from '../auth/auth.js'
import { createTestDb } from '../db/test-db.js'
import { createPurchaseWriteLimiter } from '../purchases/write-limit.js'
import { ORIGIN } from '../test-support/http.js'
import { createAccount } from './people.js'

const srcDir = resolve(fileURLToPath(new URL('..', import.meta.url)))
const root = resolve(srcDir, '../../..')
const flowsDir = join(srcDir, 'flows')

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })

test('머리 x-flow-user를 단 요청은 운영 연결의 앱(진짜 세션)에서 401이다', async () => {
  const { db, close } = await createTestDb()
  try {
    await createAccount(db, { userId: 'flow-chief', name: '회장', googleLinked: true })
    const auth = createAuth(db, {
      secret: 'local-test-only-secret-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      baseURL: ORIGIN,
      googleClientId: 'test-client',
      googleClientSecret: 'test-secret',
    })
    const modules = appModulesOf(db, headers => auth.api.getSession({ headers }), {
      clock: () => new Date(),
      writeLimiter: createPurchaseWriteLimiter(),
      receiptKey: 'test-receipt-key',
    })
    const app = createApp({ auth, trustedOrigin: ORIGIN, ...modules })
    const headers = { 'x-flow-user': 'flow-chief' }
    assert.equal((await app.request('/api/me/councils', { headers })).status, 401)
    const post = await app.request('/api/organizations/join', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({ code: 'ABCD2345' }),
    })
    assert.equal(post.status, 401)
  } finally {
    await close()
  }
})

const FLOW_IMPORT = /from\s+['"][^'"]*flows\/[^'"]*['"]/
test('flows 밖의 서버 코드는 흐름 세션과 흐름 서버를 가져오지 않는다', () => {
  const offenders = walk(srcDir)
    .filter(file => file.endsWith('.ts') && !file.startsWith(flowsDir))
    .filter(file => FLOW_IMPORT.test(readFileSync(file, 'utf8')))
    .map(file => relative(srcDir, file))
  assert.deepEqual(offenders, [])
  assert.doesNotMatch(readFileSync(join(srcDir, 'serve.ts'), 'utf8'), /flow/i)
})

test('flows 안에서 db/schema의 표를 쓰는 곳은 계정 만들기 도우미 하나뿐이다', () => {
  const files = walk(flowsDir).filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  const touching = files
    .filter(file =>
      /db\/schema|createRecord|updateRecord|\.insert\(|\.update\(|\.delete\(/.test(
        readFileSync(file, 'utf8'),
      ),
    )
    .map(file => relative(flowsDir, file))
  assert.deepEqual(touching, ['people.ts'])
  const people = readFileSync(join(flowsDir, 'people.ts'), 'utf8')
  const start = people.indexOf('export async function createAccount')
  const end = people.indexOf('\n}\n', start)
  assert.ok(start >= 0 && end > start)
  assert.doesNotMatch(
    people.slice(0, start) + people.slice(end),
    /\.insert\(|\.update\(|\.delete\(/,
  )
})

// 린트가 막는지는 실제 oxlint로 본다. serve.ts나 라우트 파일과 같은 자리(flows 밖)에 임시 파일을 만들어 돌린다.
const lintImport = (name: string, source: string) => {
  const file = join(srcDir, 'http', name)
  writeFileSync(file, source)
  try {
    const bin = join(root, 'node_modules/oxlint/bin/oxlint')
    assert.ok(existsSync(bin))
    return spawnSync(process.execPath, [bin, '-c', join(root, '.oxlintrc.json'), file], {
      cwd: root,
      encoding: 'utf8',
    })
  } finally {
    rmSync(file, { force: true })
  }
}
test('flows 밖에서 흐름 세션을 가져오면 린트가 실패하고, flows 안에서는 통과한다', () => {
  const leak = lintImport(
    'leak-fixture.tmp.ts',
    "import { createFlowSession } from '../flows/flow-session.js'\nexport const leaked = createFlowSession\n",
  )
  assert.notEqual(leak.status, 0, leak.stdout)
  assert.match(leak.stdout, /no-restricted-imports/)
  const clean = lintImport('clean-fixture.tmp.ts', 'export const clean = 1\n')
  assert.equal(clean.status, 0, clean.stdout)
})
