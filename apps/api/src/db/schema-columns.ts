import { customType, date, numeric, timestamp } from 'drizzle-orm/pg-core'

// 표 정의 파일들이 같이 쓰는 칸 종류.
export const at = (name: string) => timestamp(name, { withTimezone: true })
export const day = (name: string) => date(name, { mode: 'string' })
export const won = (name: string) => numeric(name, { precision: 14, scale: 0 })
// drizzle에 없는 PostgreSQL 범위 타입. 칸과 타입만 맞춘다. 값은 '["2026-10-19 00:00:00+00",)' 같은 글자다.
export const tstzrange = customType<{ data: string; driverData: string }>({
  dataType: () => 'tstzrange',
})
