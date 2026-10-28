import { z } from 'zod'

// PostgreSQL char_length와 같은 기준(유니코드 코드 포인트)으로 센다.
export const codePoints = (value: string) => Array.from(value).length
// oxlint-disable-next-line no-control-regex -- 입력에서 NUL을 거르는 것이 이 식의 목적이다
export const nulOrLoneSurrogate = /[\u0000\uD800-\uDFFF]/u
// oxlint-disable-next-line no-control-regex -- 입력에서 제어 문자를 거르는 것이 이 식의 목적이다
const control = /[\u0000-\u001f\u007f\uD800-\uDFFF]/u

// 기록 번호(uuid) 형식. 서버의 경로 번호 검사와 본문 번호 검사가 같이 쓴다.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const UUID_LENGTH = 36
export const isUuid = (value: string) => uuid.test(value)

// 사람이 쓰는 글. 줄바꿈은 허용하고 DB가 거부하는 NUL과 깨진 문자는 막는다.
export const text = (max: number) =>
  z
    .string()
    .refine(value => !nulOrLoneSurrogate.test(value))
    .trim()
    .refine(value => value.length > 0 && codePoints(value) <= max)

// 요청 본문은 모르는 키를 조용히 버리지 않도록 z.strictObject여야 한다.
export const isStrictObject = (schema: unknown) =>
  schema instanceof z.ZodObject && schema.def.catchall instanceof z.ZodNever

// 식별자·키·송장번호. 제어 문자를 허용하지 않는다.
export const token = (max: number) =>
  z
    .string()
    .max(max)
    .refine(value => !control.test(value))
    .trim()
    .min(1)

// 본문에 받을 값이 없는 변경(코드 바꾸기, 내보내기, 없애기)도 빈 strictObject를 받는다. 공통 가드의 경계 검사가 모든 변경 라우트에 걸린다.
export const EmptyRequestSchema = z.strictObject({})

// 명령 번호: 화면이 보내기 전에 만드는 UUID v4다(DEC-84). 같은 번호를 다시 보내면 신청이나 지출은 하나만 남는다. 신청에서는 토큰을 다시 받을 수 있는 값이라 토큰처럼 다룬다.
export const commandIdInput = z.uuid({ version: 'v4' })
