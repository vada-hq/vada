// state-scopes.json의 onboardingDraft 스코프: 같은 스코프를 참조하는 화면
// 사이에서 입력값을 유지·복원한다. 파일럿 범위에서는 메모리 수준(App state)이다.
// labels는 select 값(id)을 화면에 다시 표시하기 위한 보조 저장이다.
export interface OnboardingDraft {
  values: Record<string, string | null>
  labels: Record<string, string>
}

export function createEmptyDraft(): OnboardingDraft {
  return { values: {}, labels: {} }
}
