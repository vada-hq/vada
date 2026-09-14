import type { DataRow } from '../../data-sources/definitions'
import type { ItemListSpec } from '../../spec/types'

export function evidenceScalar(row: DataRow, field: string): string {
  const value = row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`FIN-EVID-01의 조각 '${field}'는 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

export function nestedRows(row: DataRow, spec: ItemListSpec): DataRow[] {
  if (spec.itemsField === undefined) {
    throw new Error('FIN-EVID-01의 안쪽 목록에 itemsField가 없습니다.')
  }
  const value = row[spec.itemsField]
  if (!Array.isArray(value)) {
    throw new Error(`FIN-EVID-01의 조각 '${spec.itemsField}'는 항목들이어야 합니다.`)
  }
  return value
}

export function columnField(spec: ItemListSpec, at: number): string {
  const field = spec.columns?.[at]?.fields?.[0]
  if (field === undefined) {
    throw new Error(`FIN-EVID-01의 안쪽 목록에 ${at + 1}번째 열이 없습니다.`)
  }
  return field
}
