// OpenAPI가 카탈로그와 어긋나지 않는가.
//
// `specs/figma/vada-wireframe/openapi.json`은 손으로 쓰지 않는다 — 카탈로그에서
// 만들어진다. 그런데 만들어 두고 카탈로그만 고치면 그 순간 둘이 갈리고, 갈린
// 문서로 타입과 서버 뼈대와 API Gateway 설정이 나온다.
//
// **그래서 여기서 다시 만들어 견준다.** 같지 않으면 빨간불이다.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { buildOpenApi } from '../apps/spec-service/src/generate-openapi.mjs'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const OUT = join(repoRoot, 'specs', 'figma', 'vada-wireframe', 'openapi.json')

test('openapi.json이 카탈로그에서 다시 만든 것과 같다', () => {
  const built = buildOpenApi()
  const saved = JSON.parse(readFileSync(OUT, 'utf-8'))

  assert.deepEqual(
    saved,
    built,
    'openapi.json이 카탈로그와 갈렸습니다. ' +
      'node apps/spec-service/src/generate-openapi.mjs 로 다시 만드세요.',
  )
})

// **열쇠 없이 부를 수 있는 계약이었다.**
//
// 조회 인자 115개가 전부 `required: false`로 나가고 있었다. 그러면 '어느 행사인가'를
// 빼고 부르는 것이 계약상 허용되고, 그 답은 거르지 않은 전부다. 명세가 인자마다
// 필수 여부를 갖게 되었으므로 그것이 실제로 문서까지 가는지 못 박는다.
test('명세가 필수라 한 인자는 문서에서도 필수다', () => {
  const built = buildOpenApi()
  const sources = JSON.parse(
    readFileSync(join(repoRoot, 'specs', 'figma', 'vada-wireframe', 'data-sources.json'), 'utf-8'),
  ).sources
  const wanted = new Map()
  for (const source of sources) {
    for (const param of source.params) wanted.set(`${source.key}|${param.key}`, param)
  }

  let checked = 0
  for (const item of Object.values(built.paths)) {
    for (const operation of Object.values(item)) {
      for (const parameter of operation.parameters ?? []) {
        const declared = wanted.get(`${operation.operationId}|${parameter.name}`)
        if (declared === undefined) continue
        checked += 1
        const required = parameter.in === 'path' ? true : declared.required
        assert.equal(
          parameter.required,
          required,
          `${operation.operationId}의 '${parameter.name}'`,
        )
        assert.ok(parameter.description, `${operation.operationId}의 '${parameter.name}'에 설명이 없습니다`)
      }
    }
  }
  assert.ok(checked > 100, `견준 인자가 ${checked}개뿐입니다`)
})

// 경로에 `{이름}` 자리가 있는데 명세가 그 인자를 선언하지 않으면 만들다가 멈춘다.
// 멈추지 않던 시절에 변이 27개의 경로 인자 29자리가 **설명 없는 문자열로 지어내져**
// 문서에 들어가 있었다.
test('선언하지 않은 경로 자리는 만들다가 멈춘다', () => {
  const mutations = JSON.parse(
    readFileSync(join(repoRoot, 'specs', 'figma', 'vada-wireframe', 'mutations.json'), 'utf-8'),
  )
  const withPath = mutations.mutations.filter((m) => m.request.path.includes('{'))
  assert.ok(withPath.length > 0)
  for (const mutation of withPath) {
    const declared = new Set(mutation.params.map((param) => param.key))
    for (const [, name] of mutation.request.path.matchAll(/\{([^}]+)\}/g)) {
      assert.ok(declared.has(name), `${mutation.key}가 '${name}'를 선언하지 않았습니다`)
    }
  }
})

// 같은 자리를 두 번 적으면 생성기가 던진다. 실제로 한 번 잡았다 —
// org.departments가 데이터 카탈로그와 선택지 카탈로그에 같은 경로로 있었고,
// 조직도가 읽는 나무와 고르는 목록이라 **한 자리가 두 모양을 줄 수 없었다.**
// 그 검사가 살아 있는지 여기서 못 박는다.
test('한 자리에 두 동작을 적으면 만들다가 멈춘다', () => {
  const built = buildOpenApi()
  const seen = new Set()
  for (const [path, item] of Object.entries(built.paths)) {
    for (const method of Object.keys(item)) {
      const at = `${method} ${path}`
      assert.ok(!seen.has(at), `${at}가 두 번 있습니다`)
      seen.add(at)
    }
  }
})

// operationId는 문서 전체에서 하나여야 한다 — 코드 생성기가 그것으로 함수 이름을
// 짓는다. 겹치면 하나가 조용히 덮인다.
test('operationId가 겹치지 않는다', () => {
  const built = buildOpenApi()
  const ids = []
  for (const item of Object.values(built.paths)) {
    for (const operation of Object.values(item)) ids.push(operation.operationId)
  }
  const dup = ids.filter((id, at) => ids.indexOf(id) !== at)
  assert.deepEqual([...new Set(dup)], [], 'operationId가 겹칩니다')
})

// 밖에서 열리는 자리는 로그인이 없다. 뿌리의 세션 규칙이 걸리면 QR로 온 사람이
// 자기 참석 결과를 못 본다.
test('밖에서 열리는 자리에는 세션을 걸지 않는다', () => {
  const built = buildOpenApi()
  const wrong = []
  for (const [path, item] of Object.entries(built.paths)) {
    const isPublic = path.startsWith('/api/public/')
    for (const [method, operation] of Object.entries(item)) {
      const open = Array.isArray(operation.security) && operation.security.length === 0
      if (isPublic !== open) {
        wrong.push(`  ${method} ${path}: ${isPublic ? '밖의 자리인데 세션이 걸렸다' : '안의 자리인데 열려 있다'}`)
      }
    }
  }
  assert.deepEqual(wrong, [], `세션 경계가 어긋났습니다.\n${wrong.join('\n')}`)
})

// 값의 종류가 빠진 조각이 있으면 스키마에 type 없는 자리가 생기고, 거기서 나온
// 타입은 unknown이 된다. 스키마가 valueType을 요구하므로 원래 날 수 없지만,
// **나오는 쪽에서도 한 번 본다** — 지키는 것과 쓰이는 것은 다른 일이다.
test('스키마에 종류 없는 자리가 없다', () => {
  const built = buildOpenApi()
  const missing = []
  const walk = (node, at) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${at}[${index}]`))
      return
    }
    if (node === null || typeof node !== 'object') return
    if (node.properties !== undefined && node.type === undefined) missing.push(at)
    for (const [key, value] of Object.entries(node)) walk(value, `${at}.${key}`)
  }
  walk(built.paths, 'paths')
  assert.deepEqual(missing, [], '종류를 말하지 않는 스키마가 있습니다')
})
