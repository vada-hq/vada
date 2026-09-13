import type { ApiResponse, operations } from '../../../../specs/figma/vada-wireframe/api-types'
import { readDataSource } from './catalog'
import { findDataSource, type DataSourceField } from './definitions'

type HomeSource = Extract<keyof operations, `home.${string}`>

function matchesRow(value: unknown, fields: DataSourceField[]): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return fields.every(field => {
    const cell = row[field.key]
    if (cell === undefined) return field.optional === true
    if (field.fields !== undefined) {
      return Array.isArray(cell) && cell.every(item => matchesRow(item, field.fields!))
    }
    return typeof cell === field.valueType && (typeof cell !== 'number' || Number.isFinite(cell))
  })
}

/** 명세의 연결을 확인하고 기존 조회·캐시 경로에서 읽는다. 필드 규칙도 명세를 사용한다. */
export function readHomeSource<Id extends HomeSource>(key: string | undefined, expected: Id): ApiResponse<Id> {
  if (key !== expected) throw new Error(`홈 데이터 연결이 다릅니다: ${expected} → ${key}`)
  const source = findDataSource(key)
  const value = readDataSource(key)
  const valid = source.shape === 'list'
    ? Array.isArray(value) && value.every(row => matchesRow(row, source.fields))
    : matchesRow(value, source.fields)
  if (!valid) throw new Error(`홈 데이터 '${key}'의 응답이 명세와 다릅니다.`)
  // 같은 카탈로그에서 생성한 타입이다. 확인하지 않은 네트워크 값에 타입만 붙이지 않는다.
  return value as ApiResponse<Id>
}

/** 화면 명세가 동적으로 고른 필드. 고정 필드 접근은 생성 타입이 컴파일 때 검사한다. */
export function homeField<Row extends object>(row: Row, field: string | undefined): Row[keyof Row] {
  if (field === undefined || !Object.hasOwn(row, field)) {
    throw new Error(`홈 데이터에 명세가 지정한 필드 '${field}'가 없습니다.`)
  }
  return row[field as keyof Row]
}
