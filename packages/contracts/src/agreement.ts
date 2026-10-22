import { z } from 'zod'
import { token } from './input.js'

// 가입 동의(DEC-51). 판은 시행일(YYYY-MM-DD)이다. 이용약관이나 처리방침이 바뀌면 이 값을 올려, 모든 운영진이 다음에 열 때 다시 동의한다.
// 주소는 문서 작업(이슈 #32)이 끝나 공개 주소가 정해질 때 채운다. 비어 있으면 서버는 묻지도 막지도 않는다(동의할 약관이 없다).
export type Terms = {
  termsVersion: string
  privacyVersion: string
  termsUrl: string
  privacyUrl: string
}
export const CURRENT_TERMS: Terms = {
  termsVersion: '2026-11-01',
  privacyVersion: '2026-11-01',
  termsUrl: '',
  privacyUrl: '',
}
export const isTermsRequired = (terms: Terms) => terms.termsUrl !== '' && terms.privacyUrl !== ''

// 판 문자열 길이(YYYY-MM-DD). 모르는 판은 형식이 아니라 값으로 가려 409로 답하므로 상한만 건다.
export const TERMS_VERSION_MAX = 10

// 화면이 보여 준 판을 그대로 돌려 보낸다. 그사이 판이 바뀌었으면 서버가 409로 알린다.
export const AgreeSchema = z.strictObject({
  termsVersion: token(TERMS_VERSION_MAX),
  privacyVersion: token(TERMS_VERSION_MAX),
})
export type AgreeRequest = z.infer<typeof AgreeSchema>

export type AgreementResponse = Terms & {
  // 주소가 정해져 동의를 받아야 하는 때만 true다.
  required: boolean
  // 이 사람이 지금 판 둘에 동의했는지.
  agreed: boolean
}
