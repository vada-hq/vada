import type { DataRow } from './definitions'

/** 선택 조각을 화면에 그릴 문자열로 읽는다. 목록이거나 없으면 빈 문자열이다. */
export function scalarValue(row: DataRow, field: string | undefined): string {
  const value = row[field ?? '']
  if (value === undefined || Array.isArray(value)) {
    return ''
  }
  return String(value)
}
