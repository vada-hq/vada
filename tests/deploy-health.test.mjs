import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

// **건강 확인이 가리키는 자리가 진짜로 열려 있는가.**
//
// 2026-09-02에 이것 때문에 배포가 죽었다. 로그인 자리를 계약 안으로 옮기면서 옛 주소
// (`/api/auth-ways`)를 지웠는데, Render의 건강 확인이 그 주소를 보고 있었다. 서버는
// 멀쩡히 섰지만 그 자리가 403을 내니 Render가 "안 건강하다"고 보고 계속 죽였다 —
// **코드는 초록인데 배포만 죽는** 자리이고, 어느 검사도 그것을 보지 않았다.
//
// 여기서 셋을 잰다: 그 자리가 계약에 있는가 · 로그인이 없어도 열리는가 · GET인가.
// 셋 중 하나라도 아니면 배포가 스스로를 죽인다.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const render = readFileSync(join(repoRoot, 'render.yaml'), 'utf8')
const openapi = JSON.parse(
  readFileSync(join(repoRoot, 'specs', 'figma', 'vada-wireframe', 'openapi.json'), 'utf8'),
)

function healthPath() {
  const found = /^\s*healthCheckPath:\s*(\S+)\s*$/m.exec(render)
  assert.ok(found, 'render.yaml에 healthCheckPath가 없습니다')
  return found[1]
}

test('건강 확인이 계약에 있는 자리를 가리킨다', () => {
  const path = healthPath()
  assert.ok(
    openapi.paths[path],
    `건강 확인이 '${path}'를 보는데 계약에 그 자리가 없습니다. ` +
      '서버는 계약에 없는 자리를 403으로 막으므로 배포가 스스로를 죽입니다.',
  )
})

test('건강 확인 자리는 로그인 없이 열린다', () => {
  const path = healthPath()
  const get = openapi.paths[path]?.get
  assert.ok(get, `'${path}'에 GET이 없습니다. 건강 확인은 GET으로 부릅니다.`)
  assert.equal(
    get['x-authorize'].area,
    'public',
    `'${path}'가 로그인을 요구합니다. 건강 확인에는 세션이 없으므로 401이 됩니다.`,
  )
})
