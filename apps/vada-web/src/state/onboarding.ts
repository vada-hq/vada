// onboardingDraft 스코프의 별칭. 스코프 일반화(scopes.ts) 이전에 쓰던 이름을
// 유지해 ONB-01 구현이 그대로 동작하게 한다.
export type { ScopeDraft as OnboardingDraft } from './scopes'
export { createEmptyScopeDraft as createEmptyDraft } from './scopes'
