import { z } from 'zod'

// PostgreSQL char_length와 같은 기준(유니코드 코드 포인트)으로 센다.
export const codePoints = (value: string) => [...value].length
const nulOrLoneSurrogate = /[\u0000\uD800-\uDFFF]/u
const control = /[\u0000-\u001f\u007f\uD800-\uDFFF]/u

// 사람이 쓰는 글. 줄바꿈은 허용하고 DB가 거부하는 NUL과 깨진 문자는 막는다.
export const text = (max: number) => z.string()
  .refine(value => !nulOrLoneSurrogate.test(value))
  .trim()
  .refine(value => value.length > 0 && codePoints(value) <= max)

// 식별자·키·송장번호. 제어 문자를 허용하지 않는다.
export const token = (max: number) => z.string()
  .max(max)
  .refine(value => !control.test(value))
  .trim()
  .min(1)
