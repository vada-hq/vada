import { z } from 'zod'

// 범주색은 의미를 갖는 상태색과 다르다. 팔레트 순서와 저장 키는 바꾸지 않는다(DEC-98).
export const DEPARTMENT_COLORS = [
  'teal',
  'violet',
  'emerald',
  'pink',
  'sky',
  'orange',
  'indigo',
  'lime',
] as const
export type DepartmentColorKey = (typeof DEPARTMENT_COLORS)[number]
export const UpdateDepartmentColorSchema = z.strictObject({ color: z.enum(DEPARTMENT_COLORS) })

const HASH_MULTIPLIER = 31
const HASH_MODULUS = 2_147_483_647
// 식별자의 기본색은 목록 순서·다른 부서의 삭제·이름 변경과 무관하다.
export function defaultDepartmentColor(id: string): DepartmentColorKey {
  let hash = 0
  for (const char of id.toLowerCase())
    hash = (hash * HASH_MULTIPLIER + char.charCodeAt(0)) % HASH_MODULUS
  return DEPARTMENT_COLORS[hash % DEPARTMENT_COLORS.length] ?? DEPARTMENT_COLORS[0]
}
