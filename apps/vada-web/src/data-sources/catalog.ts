// specs/figma/vada-wireframe/data-sources.json 카탈로그의 소비자.
// option-sources/catalog.ts와 같은 방식이다: 계약(요청 경로·상태 문구·응답
// 조각)은 카탈로그를 단일 원본으로 읽고, 네트워크만 개발용 mock으로 대체한다.
import catalogJson from '../../../../specs/figma/vada-wireframe/data-sources.json'
import { DASHBOARD_FIXTURES } from './fixtures'

export interface DataSourceMessages {
  loading: string
  empty: string
  error: string
}

export interface DataSourceField {
  key: string
  description: string
  optional?: boolean
}

export interface DataSource {
  key: string
  shape: 'object' | 'list'
  description: string
  params: string[]
  request: { method: 'GET'; path: string }
  messages: DataSourceMessages
  fields: DataSourceField[]
}

interface DataSourceCatalog {
  schemaVersion: 1
  sources: DataSource[]
}

const catalog = catalogJson as DataSourceCatalog

export function findDataSource(key: string): DataSource {
  const source = catalog.sources.find((candidate) => candidate.key === key)
  if (!source) {
    // 조용한 대체는 화면을 빈 채로 두고 원인을 감춘다.
    throw new Error(`데이터 출처 '${key}'가 카탈로그에 없습니다.`)
  }
  return source
}

export type DataRow = Record<string, string | number>

// 개발용 mock. 실제 응답이 붙기 전까지 fixtures가 대신하며, 카탈로그가 선언한
// fields와 어긋나면 조용히 비는 대신 오류로 드러난다.
export function readDataSource(key: string): DataRow | DataRow[] {
  const source = findDataSource(key)
  const fixture = DASHBOARD_FIXTURES[key]
  if (fixture === undefined) {
    throw new Error(`데이터 출처 '${key}'의 개발용 응답이 없습니다.`)
  }

  const rows = Array.isArray(fixture) ? fixture : [fixture]
  const required = source.fields.filter((field) => field.optional !== true)
  for (const row of rows) {
    for (const field of required) {
      if (row[field.key] === undefined) {
        throw new Error(
          `데이터 출처 '${key}'의 응답에 카탈로그가 선언한 조각 '${field.key}'가 없습니다.`,
        )
      }
    }
  }

  if (Array.isArray(fixture) !== (source.shape === 'list')) {
    throw new Error(
      `데이터 출처 '${key}'는 shape가 '${source.shape}'인데 응답 모양이 다릅니다.`,
    )
  }
  return fixture
}

export function readObjectSource(key: string): DataRow {
  const value = readDataSource(key)
  if (Array.isArray(value)) {
    throw new Error(`데이터 출처 '${key}'는 목록입니다.`)
  }
  return value
}

export function readListSource(key: string): DataRow[] {
  const value = readDataSource(key)
  if (!Array.isArray(value)) {
    throw new Error(`데이터 출처 '${key}'는 목록이 아닙니다.`)
  }
  return value
}
