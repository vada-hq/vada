import { sql, type AnyColumn } from 'drizzle-orm'

// 합은 정수 원이다. numeric은 문자열로 와서 Number로 바꾼다(14자리라 안전하다).
export const sumOf = (column: AnyColumn) => sql<number>`coalesce(sum(${column}), 0)`.mapWith(Number)
export const countAll = sql<number>`count(*)`.mapWith(Number)
