import type { AgreementResponse } from '@vada/contracts'

// 동의 상태 응답. 기본은 동의가 필요 없는 때(주소 상수가 빈 동안)다.
export const agreementResponse = (over: Partial<AgreementResponse> = {}): AgreementResponse => ({
  termsVersion: '2026-11-01',
  privacyVersion: '2026-11-01',
  termsUrl: 'https://docs.example.test/terms',
  privacyUrl: 'https://docs.example.test/privacy',
  required: false,
  agreed: false,
  ...over,
})
