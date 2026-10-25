import { UpdateMeProfileSchema } from '@vada/contracts'
import { requiredText, withContract, type FieldErrors } from './use-form-check'

// '내 이름' 칸의 문제(누를 때 확인한다). 이름은 운영진 하나라서 들어가기와 내 이름 창이 같은 계약(운영진 이름 상한)으로 본다.
export const myNameErrors = (name: string): FieldErrors =>
  withContract({ name: requiredText(name, '이름을') }, UpdateMeProfileSchema.safeParse({ name }))
