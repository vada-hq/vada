import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { buildOpenApi } from '../apps/spec-service/src/generate-openapi.mjs'
import { generateApiTypes } from '../apps/spec-service/src/generate-api-types.mjs'

const root = new URL('../specs/figma/vada-wireframe/', import.meta.url)
const operationIds = JSON.parse(readFileSync(new URL('api-type-operations.json', root), 'utf8'))
const ts = createRequire(new URL('../apps/spec-service/package.json', import.meta.url))('typescript')

test('생성 타입이 API와 웹의 증분 검사 입력에 포함된다', () => {
  const generated = resolve(fileURLToPath(new URL('api-types.d.ts', root)))
  for (const file of ['../apps/api/tsconfig.json', '../apps/vada-web/tsconfig.app.json']) {
    const configPath = fileURLToPath(new URL(file, import.meta.url))
    const read = ts.readConfigFile(configPath, ts.sys.readFile)
    assert.equal(read.error, undefined)
    const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(configPath))
    assert.deepEqual(parsed.errors, [])
    assert.ok(parsed.fileNames.some(name => resolve(name) === generated), `${file}: 생성 타입이 검사 입력에서 빠졌습니다`)
  }
})

test('공유 API 타입이 원본 카탈로그에서 다시 생성한 결과와 같다', async () => {
  const generated = await generateApiTypes(buildOpenApi(), operationIds)
  const saved = readFileSync(new URL('api-types.d.ts', root), 'utf8')
  assert.equal(saved, generated, '공유 API 타입이 명세와 갈렸습니다. npm run openapi로 다시 만드세요.')
})

test('선택한 API만 타입에 포함하고 원본 OpenAPI를 바꾸지 않는다', async () => {
  const document = buildOpenApi()
  const original = structuredClone(document)
  const generated = await generateApiTypes(document, ['app.start'])
  assert.match(generated, /"app\.start"/)
  assert.doesNotMatch(generated, /"auth\.ways"/)
  assert.deepEqual(document, original)
})

test('API 선택이 비었거나 누락·중복되면 빈 타입을 생성하지 않는다', async () => {
  const document = buildOpenApi()
  await assert.rejects(generateApiTypes(document, []), /하나 이상/)
  await assert.rejects(generateApiTypes(document, ['missing.operation']), /찾지 못했습니다/)
  await assert.rejects(generateApiTypes(document, ['app.start', 'app.start']), /중복/)
  const duplicated = structuredClone(document)
  duplicated.paths['/duplicate'] = structuredClone(document.paths['/api/app/start'])
  await assert.rejects(generateApiTypes(duplicated, ['app.start']), /중복/)
})

test('응답 필드 이름·종류·필수 여부의 변경이 생성 타입에 반영된다', async () => {
  const document = buildOpenApi()
  const schema = document.paths['/api/app/start'].get.responses['200'].content['application/json'].schema
  schema.properties = { destination: { type: 'number' } }
  schema.required = ['destination']
  const required = await generateApiTypes(document, ['app.start'])
  assert.match(required, /destination: number/)
  assert.doesNotMatch(required, /screenId:/)
  schema.required = []
  const optional = await generateApiTypes(document, ['app.start'])
  assert.match(optional, /destination\?: number/)
})
