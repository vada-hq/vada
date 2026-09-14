import type { DataRow, DataValue } from '../../data-sources/definitions'

export function cancelledMeetingScalar(row: DataRow, field: string | undefined): string {
  const value: DataValue | undefined = field === undefined ? undefined : row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`OPS-MEET-09의 '${field}' 조각은 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}
