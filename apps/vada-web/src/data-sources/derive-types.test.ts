import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { DASHBOARD_FIXTURES, FILTERED_FIXTURES } from './fixtures'
import { ALL_SCREENS, exampleParamsOf } from '../spec/screens'
import { resolveParams } from '../spec/params'
import type { DataRow, DataValue } from './catalog'

// 조각 920개의 **값의 종류**를 개발용 응답에서 읽어 낸다.
//
// 카탈로그는 조각의 이름과 설명만 갖고 값의 종류는 하나도 갖지 않는다. 그 상태로는
// OpenAPI를 뽑을 수 없고, 백엔드를 만드는 사람은 `amount`를 숫자로 줄지
// '180,000원'으로 줄지 알 수 없다.
//
// **지어내지 않는다.** 개발용 응답이 이미 실제 값을 갖고 있고, 그 값들은 화면이
// 그리는 것과 design 대조로 묶여 있다 — 짐작보다 정확한 근거다.
//
// 이 파일은 검사가 아니라 **연장**이다. 평소에는 아무것도 하지 않고,
// `DERIVE_TYPES=1`을 주면 결과를 파일로 내놓는다. 사람이 그것을 보고 카탈로그에
// 옮긴다 — 기계가 카탈로그를 직접 고치게 하지 않는 까닭은, 값의 종류가 개발용
// 응답의 성질이 아니라 **계약**이어서 한 번은 사람이 봐야 하기 때문이다.

const OUT = fileURLToPath(new URL('./derived-types.json', import.meta.url))
const CATALOG = fileURLToPath(
  new URL('../../../../specs/figma/vada-wireframe/data-sources.json', import.meta.url),
)

type Observed = 'string' | 'number' | 'boolean' | 'list' | 'mixed' | 'empty'

function typeOf(value: DataValue | undefined): Observed {
  if (value === undefined || value === null) return 'empty'
  if (Array.isArray(value)) return 'list'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'string'
}

function merge(a: Observed | undefined, b: Observed): Observed {
  if (a === undefined || a === 'empty') return b
  if (b === 'empty') return a
  return a === b ? a : 'mixed'
}

/** 한 응답에서 조각마다 본 종류. 되풀이되는 항목은 안으로 들어간다. */
function observe(rows: DataRow[], into: Map<string, Observed>, prefix = '') {
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      const path = prefix === '' ? key : `${prefix}.${key}`
      const seen = typeOf(value)
      into.set(path, merge(into.get(path), seen))
      if (Array.isArray(value)) observe(value as DataRow[], into, path)
    }
  }
}

it('개발용 응답에서 값의 종류를 읽어 낸다', () => {
  if (process.env.DERIVE_TYPES !== '1') return

  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'))
  const sources: Array<{ key: string; shape: string; params?: string[] }> =
    catalog.sources ?? catalog.dataSources

  // **화면이 실제로 넘기는 인자를 쓴다.** 인자 없이 부르면 거르개가 전부를 주는
  // 출처만 답하고(56/145), 나머지는 한 건을 집어 오는 것이라 빈손이 온다.
  // 명세가 어느 화면이 무엇을 어떤 인자로 부르는지 이미 적어 두었다.
  const calls = new Map<string, Array<Record<string, string>>>()
  const remember = (key: unknown, params: Record<string, string>) => {
    if (typeof key !== 'string') return
    const list = calls.get(key) ?? []
    list.push(params)
    calls.set(key, list)
  }
  for (const spec of ALL_SCREENS) {
    const screenParams = exampleParamsOf(spec.screenId)
    const walk = (node: unknown) => {
      if (Array.isArray(node)) {
        for (const item of node) walk(item)
        return
      }
      if (node === null || typeof node !== 'object') return
      const entry = node as Record<string, unknown>
      if (typeof entry.dataSourceKey === 'string') {
        let resolved: Record<string, string> = {}
        try {
          resolved = resolveParams(entry.params as never, { screenParams })
        } catch {
          resolved = {}
        }
        remember(entry.dataSourceKey, resolved)
      }
      for (const [name, value] of Object.entries(entry)) {
        if (name === 'optionsSource') continue
        walk(value)
      }
    }
    walk(spec)
  }

  // 인자 이름마다 저장소가 실제로 쓰는 값들. 화면의 예시 인자에서 모은다.
  const known = new Map<string, string[]>()
  for (const params of [...calls.values()].flat()) {
    for (const [name, value] of Object.entries(params)) {
      if (value === '') continue
      known.set(name, [...(known.get(name) ?? []), value])
    }
  }
  for (const spec of ALL_SCREENS) {
    for (const [name, value] of Object.entries(exampleParamsOf(spec.screenId))) {
      if (value === '') continue
      known.set(name, [...(known.get(name) ?? []), value])
    }
  }

  const out: Record<string, Record<string, Observed>> = {}
  const missed: string[] = []

  for (const source of sources) {
    const seen = new Map<string, Observed>()
    const filtered = FILTERED_FIXTURES[source.key] as
      | ((params: Record<string, string>) => DataRow[])
      | undefined

    if (filtered === undefined) {
      const fixture = DASHBOARD_FIXTURES[source.key]
      if (fixture === undefined) {
        missed.push(source.key)
        continue
      }
      observe(Array.isArray(fixture) ? fixture : [fixture], seen)
    } else {
      // 인자 없이 한 번, 그리고 화면이 넘기는 것마다 한 번. 넓게 볼수록 종류가
      // 흔들리는 조각(때로 비고 때로 오는 것)이 드러난다.
      // 화면이 안 부르는 출처가 아홉 있다 — 셸이 읽거나(event.workspace) 묶음 안에서
      // 불려 인자가 화면 밖에서 온다. 그때는 **다른 화면이 쓰는 인자 값들을 빌려**
      // 훑는다. 종류를 재는 데는 어느 한 건이든 답하면 된다.
      const borrowed = source.params?.flatMap((name) =>
        [...new Set(known.get(name) ?? [])].map((value) => ({ [name]: value })),
      )
      const attempts = [{}, ...(calls.get(source.key) ?? []), ...(borrowed ?? [])]
      for (const params of attempts) {
        try {
          observe(filtered(params), seen)
        } catch {
          // 인자가 모자란 호출은 넘긴다. 다른 호출이 답한다.
        }
      }
      if (seen.size === 0) {
        missed.push(source.key)
        continue
      }
    }
    out[source.key] = Object.fromEntries([...seen].sort())
  }

  writeFileSync(
    OUT,
    `${JSON.stringify({ observed: out, noFixture: missed.sort() }, null, 2)}
`,
    'utf8',
  )
  console.log(
    `
  값의 종류를 읽은 출처 ${Object.keys(out).length}개 · 못 읽은 것 ${missed.length}개`,
  )
})

// **명세가 적은 종류와 개발용 응답이 주는 것이 같은가.**
//
// 위의 도출은 한 번 쓰는 연장이고, 이것은 늘 도는 검사다. 카탈로그의 valueType은
// 이제 계약이므로 개발용 응답이 그것을 어기면 실제 서버도 어길 수 있다 —
// 개발용 응답은 서버 대역이고, 대역이 계약을 지키지 않으면 무엇을 시험한 것인지
// 알 수 없다.
//
// 안 재는 것도 적어 둔다: 응답에 **없는** 조각은 여기서 아무 말도 하지 않는다.
// optional인 것이 안 오는 것은 정상이고, 필수인 것이 안 오는 것은 다른 검사의
// 몫이다.
it('개발용 응답이 명세가 적은 값의 종류를 지킨다', () => {
  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'))
  const sources: Array<{
    key: string
    fields?: Array<Record<string, unknown>>
  }> = catalog.sources ?? catalog.dataSources

  const declared = new Map<string, string>()
  const collect = (fields: Array<Record<string, unknown>>, key: string, prefix = '') => {
    for (const field of fields) {
      const path = prefix === '' ? String(field.key) : `${prefix}.${String(field.key)}`
      if (Array.isArray(field.fields)) {
        collect(field.fields as Array<Record<string, unknown>>, key, path)
        continue
      }
      if (typeof field.valueType === 'string') declared.set(`${key}|${path}`, field.valueType)
    }
  }
  for (const source of sources) collect(source.fields ?? [], source.key)

  const broken: string[] = []
  const check = (rows: DataRow[], key: string, prefix = '') => {
    for (const row of rows) {
      for (const [name, value] of Object.entries(row)) {
        const path = prefix === '' ? name : `${prefix}.${name}`
        if (Array.isArray(value)) {
          check(value as DataRow[], key, path)
          continue
        }
        const want = declared.get(`${key}|${path}`)
        if (want === undefined) continue
        const got = typeOf(value)
        if (got !== 'empty' && got !== want) {
          broken.push(`  ${key}.${path}: 명세는 ${want}인데 ${got}가 왔습니다`)
        }
      }
    }
  }

  for (const source of sources) {
    const filtered = FILTERED_FIXTURES[source.key] as
      | ((params: Record<string, string>) => DataRow[])
      | undefined
    if (filtered === undefined) {
      const fixture = DASHBOARD_FIXTURES[source.key]
      if (fixture !== undefined) check(Array.isArray(fixture) ? fixture : [fixture], source.key)
      continue
    }
    try {
      check(filtered({}), source.key)
    } catch {
      // 인자가 있어야 답하는 출처는 위의 도출이 훑는다.
    }
  }

  expect(
    [...new Set(broken)].sort(),
    '개발용 응답이 명세가 적은 값의 종류를 어깁니다',
  ).toEqual([])
})

// **글로 선언됐는데 실제로는 참거짓만 담는 조각.**
//
// 앞의 검사는 선언과 값이 **맞는지**만 본다. 그래서 `actionEnabled: 'y'`는 글로
// 선언됐으니 통과했다 — 선언이 틀렸다는 것을 그 방향으로는 볼 수 없다.
//
// 실제로 그 하나를 놓쳤다. 판정 조각 열다섯을 참거짓으로 고칠 때 훑개가 `can`으로
// 시작하는 이름만 봤고, `actionEnabled`는 그 규칙 밖이라 조용히 남았다. **이름으로
// 훑으면 이름이 규칙을 벗어나는 순간 놓친다.** 값으로 훑으면 그러지 않는다.
//
// 참거짓으로 쓰이던 인코딩은 이 저장소가 실제로 쓴 것들이다 — 빈 글과 'y'(52곳),
// '예'(4곳). 늘어나면 여기 더한다.
it('참거짓만 담는 조각을 글로 선언하지 않는다', () => {
  const BOOLEAN_LOOKING = new Set(['', 'y', 'n', '예', '아니오', 'true', 'false'])
  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'))
  const sources: Array<{ key: string; fields?: Array<Record<string, unknown>> }> =
    catalog.sources ?? catalog.dataSources

  const asString = new Set<string>()
  const collect = (fields: Array<Record<string, unknown>>, key: string, prefix = '') => {
    for (const field of fields) {
      const path = prefix === '' ? String(field.key) : `${prefix}.${String(field.key)}`
      if (Array.isArray(field.fields)) {
        collect(field.fields as Array<Record<string, unknown>>, key, path)
        continue
      }
      if (field.valueType === 'string') asString.add(`${key}|${path}`)
    }
  }
  for (const source of sources) collect(source.fields ?? [], source.key)

  const seen = new Map<string, Set<string>>()
  const watch = (rows: DataRow[], key: string, prefix = '') => {
    for (const row of rows) {
      for (const [name, value] of Object.entries(row)) {
        const path = prefix === '' ? name : `${prefix}.${name}`
        if (Array.isArray(value)) {
          watch(value as DataRow[], key, path)
          continue
        }
        if (typeof value !== 'string') continue
        const at = `${key}|${path}`
        if (!asString.has(at)) continue
        const values = seen.get(at) ?? new Set<string>()
        values.add(value)
        seen.set(at, values)
      }
    }
  }
  for (const source of sources) {
    const filtered = FILTERED_FIXTURES[source.key] as
      | ((params: Record<string, string>) => DataRow[])
      | undefined
    if (filtered === undefined) {
      const fixture = DASHBOARD_FIXTURES[source.key]
      if (fixture !== undefined) watch(Array.isArray(fixture) ? fixture : [fixture], source.key)
      continue
    }
    try {
      watch(filtered({}), source.key)
    } catch {
      // 인자가 있어야 답하는 자리는 위의 도출이 훑는다.
    }
  }

  // **빈 글만 담긴 것은 참거짓이 아니다.** 아직 안 채운 초안이 그렇다 — 그것까지
  // 세면 열두 자리가 잘못 걸린다(실제로 걸렸다). 참·거짓을 실어 나르는 표시가
  // 하나라도 있어야 그 조각이 참거짓을 입고 있는 것이다.
  const MARKS = new Set(['y', 'n', '예', '아니오', 'true', 'false'])
  const wearing = [...seen.entries()]
    .filter(
      ([, values]) =>
        [...values].every((value) => BOOLEAN_LOOKING.has(value)) &&
        [...values].some((value) => MARKS.has(value)),
    )
    .map(([at]) => at)
    .sort()

  expect(
    wearing,
    '이 조각들은 참거짓만 담는데 글로 선언돼 있습니다. 받는 쪽은 무엇이 참인지 규칙을 따로 알아야 합니다',
  ).toEqual([])
})
