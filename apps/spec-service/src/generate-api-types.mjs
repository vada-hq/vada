import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import openapiTS, { astToString } from 'openapi-typescript'

const METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'])

/** 연결한 API만 생성한다. 제품별 경로와 operationId 목록은 호출부에서 전달한다. */
export async function generateApiTypes(document, operationIds) {
  if (!Array.isArray(operationIds) || operationIds.length === 0) {
    throw new Error('타입으로 연결할 API가 하나 이상 필요합니다')
  }
  const wanted = new Set(operationIds)
  if (wanted.size !== operationIds.length) throw new Error('선택한 API에 중복이 있습니다')
  const selected = structuredClone(document)
  const paths = {}
  const found = new Set()
  for (const [path, item] of Object.entries(selected.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (!METHODS.has(method) || !wanted.has(operation.operationId)) continue
      if (found.has(operation.operationId)) throw new Error(`OpenAPI에 '${operation.operationId}' 중복이 있습니다`)
      found.add(operation.operationId)
      paths[path] ??= item.parameters === undefined ? {} : { parameters: item.parameters }
      paths[path][method] = operation
    }
  }
  for (const operationId of wanted) {
    if (!found.has(operationId)) throw new Error(`OpenAPI에서 '${operationId}'를 찾지 못했습니다`)
  }
  selected.paths = paths
  const declarations = astToString(await openapiTS(selected))
  return `// 자동 생성: npm run api:types. 직접 수정하지 않는다.\n${declarations}
/** 선택한 API의 JSON 성공 응답. 응답 본문이 없는 계약은 never다. */
export type ApiResponse<Id extends keyof operations> =
    operations[Id] extends { responses: { 200: { content: { "application/json": infer Body } } } }
        ? Body
        : never;
`
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input, selection, output] = process.argv.slice(2)
  if (!input || !selection || !output) {
    throw new Error('사용법: generate-api-types.mjs <openapi.json> <operation-ids.json> <output.d.ts>')
  }
  const document = JSON.parse(readFileSync(input, 'utf8'))
  const operationIds = JSON.parse(readFileSync(selection, 'utf8'))
  writeFileSync(output, await generateApiTypes(document, operationIds), 'utf8')
  process.stdout.write(`API 타입 생성: ${operationIds.join(', ')} → ${output}\n`)
}
