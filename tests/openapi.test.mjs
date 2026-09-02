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

// **자리마다 누가 열 수 있는지 문서가 들고 간다.**
//
// 권한 규칙은 오랫동안 ORG-04이 그리는 표에 글로만 있었고, 그 표와 216개 자리를
// 잇는 것이 아무 데도 없었다 — 서버를 만드는 사람이 자리마다 스스로 판단해야 했고,
// 판단을 빠뜨린 자리는 조용히 열린다. 하나라도 비면 여기서 빨간불이다.
test('모든 동작이 권한 영역을 든다', () => {
  const built = buildOpenApi()
  const permissions = JSON.parse(
    readFileSync(join(repoRoot, 'specs', 'figma', 'vada-wireframe', 'permissions.json'), 'utf-8'),
  )
  const areas = new Set(permissions.areas.map((area) => area.key))

  for (const [path, item] of Object.entries(built.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      const at = `${method} ${path}`
      const authorize = operation['x-authorize']
      assert.ok(authorize, `${at}에 권한이 없습니다`)
      assert.ok(areas.has(authorize.area), `${at}의 권한 영역 '${authorize.area}'가 없습니다`)
    }
  }
})

// 밖에서 열리는 자리와 권한이 어긋나면 둘 중 하나가 거짓말이다 — 세션을 안 거는데
// 구성원이어야 한다고 적혀 있거나, 세션을 거는데 아무나 된다고 적혀 있거나.
test('세션을 걸지 않는 자리와 public이 같다', () => {
  const built = buildOpenApi()
  const open = []
  const publicArea = []
  for (const [path, item] of Object.entries(built.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      const at = `${method} ${path}`
      if (Array.isArray(operation.security) && operation.security.length === 0) open.push(at)
      if (operation['x-authorize'].area === 'public') publicArea.push(at)
    }
  }
  assert.deepEqual(publicArea.sort(), open.sort())
})

// **216자리가 성공 하나만 들고 있었다.**
//
// 그러면 받는 쪽은 실패를 다룰 수 없고, 다룰 수 없는 실패는 화면에 '알 수 없는 오류'로
// 나온다. 이제 코드는 손으로 적지 않고 명세에서 끌어낸다 — 파생이라 갈릴 수가 없다.
test('실패가 명세에서 끌어낸 대로 실린다', () => {
  const built = buildOpenApi()
  const mutations = new Map(
    JSON.parse(
      readFileSync(join(repoRoot, 'specs', 'figma', 'vada-wireframe', 'mutations.json'), 'utf-8'),
    ).mutations.map((mutation) => [mutation.key, mutation]),
  )

  let checkedPublic = 0
  let checkedConflict = 0
  for (const item of Object.values(built.paths)) {
    for (const operation of Object.values(item)) {
      const codes = operation.responses
      const area = operation['x-authorize'].area
      const at = operation.operationId

      if (area === 'public') {
        // 로그인이 없으므로 막을 것이 없다. 대신 토큰을 마구 넣어 보는 것을 막아야 한다.
        assert.ok(!codes[401] && !codes[403], `${at}가 밖에서 열리는데 권한 실패를 답합니다`)
        assert.ok(codes[429], `${at}가 밖에서 열리는데 너무 자주 눌린 것을 막지 않습니다`)
        checkedPublic += 1
      } else {
        assert.ok(codes[401], `${at}에 401이 없습니다`)
      }

      const mutation = mutations.get(at)
      if (mutation?.repeat.kind === 'conflict') {
        assert.ok(codes[409], `${at}는 상태를 옮기는데 409가 없습니다`)
        checkedConflict += 1
      }
      if (mutation?.repeat.kind !== 'conflict' && mutation !== undefined) {
        assert.ok(!codes[409], `${at}는 상태를 옮기지 않는데 409를 답합니다`)
      }
    }
  }
  assert.equal(checkedPublic, 12)
  assert.equal(checkedConflict, 15)
})

// **두 번 보내지는 것을 막을 방법이 없다.** 사람이 두 번 누르고, 화면이 느려 또 누르고,
// 네트워크가 끊겨 다시 보낸다. 자연 열쇠가 없는 자리는 보내는 쪽이 키를 붙여야 한다.
test('자연 열쇠가 없는 자리는 멱등 키를 요구한다', () => {
  const built = buildOpenApi()
  const mutations = JSON.parse(
    readFileSync(join(repoRoot, 'specs', 'figma', 'vada-wireframe', 'mutations.json'), 'utf-8'),
  ).mutations
  const wanted = new Set(
    mutations.filter((m) => m.repeat.kind === 'idempotencyKey').map((m) => m.key),
  )
  assert.ok(wanted.size > 0)

  const asked = new Set()
  for (const item of Object.values(built.paths)) {
    for (const operation of Object.values(item)) {
      const header = (operation.parameters ?? []).find((p) => p.name === 'Idempotency-Key')
      if (header === undefined) continue
      assert.equal(header.in, 'header')
      assert.equal(header.required, true)
      asked.add(operation.operationId)
    }
  }
  assert.deepEqual([...asked].sort(), [...wanted].sort())
})

// 카탈로그가 result로 말하는데 문서로 이어진 적이 없었다 — 성공 응답이 줄곧 빈 객체였고,
// 출석 확인이 영수증을 준다는 사실이 문서 어디에도 없었다.
test('보낸 뒤에 오는 것이 문서에 실린다', () => {
  const built = buildOpenApi()
  const mutations = JSON.parse(
    readFileSync(join(repoRoot, 'specs', 'figma', 'vada-wireframe', 'mutations.json'), 'utf-8'),
  ).mutations
  let checked = 0
  for (const mutation of mutations) {
    if (!Array.isArray(mutation.result) || mutation.result.length === 0) continue
    const operation = built.paths[mutation.request.path][mutation.request.method.toLowerCase()]
    const schema = operation.responses[200].content['application/json'].schema
    for (const field of mutation.result) {
      assert.ok(schema.properties[field.key], `${mutation.key}의 '${field.key}'가 문서에 없습니다`)
      assert.equal(schema.properties[field.key].type, field.valueType)
    }
    checked += 1
  }
  assert.ok(checked >= 3, `견준 것이 ${checked}개뿐입니다`)
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

// `/api/public/` 아래는 전부 아무나 여는 자리다. **거꾸로는 아니다** — 로그인 자리도
// 아무나 열지만 그 주소를 쓰지 않는다. 이름이 뜻과 어긋나면 읽는 사람이 잘못 안다.
//
// 세션을 거는가 마는가는 권한 영역이 정하고, 그것은 '세션을 걸지 않는 자리와 public이
// 같다'가 잰다. 한동안 이 검사가 주소로 그것까지 판정했고, 그래서 밖에 새로 열린 자리
// (로그인)가 '안의 자리인데 열려 있다'로 잘못 걸렸다.
test('public 주소 아래는 전부 아무나 여는 자리다', () => {
  const built = buildOpenApi()
  const wrong = []
  for (const [path, item] of Object.entries(built.paths)) {
    if (!path.startsWith('/api/public/')) continue
    for (const [method, operation] of Object.entries(item)) {
      if (operation['x-authorize'].area !== 'public') {
        wrong.push(`  ${method} ${path}: public 주소인데 '${operation['x-authorize'].area}'다`)
      }
    }
  }
  assert.deepEqual(wrong, [], `이름과 뜻이 어긋났습니다.\n${wrong.join('\n')}`)
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
