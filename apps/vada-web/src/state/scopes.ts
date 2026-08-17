// state-scopes.json의 스코프별 입력 초안. 같은 스코프를 참조하는 화면 사이에서
// 값을 유지·복원하고, note는 *다른* 스코프의 값을 읽는다(ORG-01의 소속 정보).
// 파일럿 범위에서는 메모리 수준(App state)이다.
// labels는 select 값(id)을 화면에 다시 표시하기 위한 보조 저장이다.
export interface ScopeDraft {
  values: Record<string, string | null>
  labels: Record<string, string>
}

export type ScopeStore = Record<string, ScopeDraft>

const EMPTY_DRAFT: ScopeDraft = { values: {}, labels: {} }

export function createEmptyScopeDraft(): ScopeDraft {
  return { values: {}, labels: {} }
}

export function readScopeDraft(store: ScopeStore, scopeKey: string | undefined): ScopeDraft {
  return (scopeKey && store[scopeKey]) || EMPTY_DRAFT
}

// note.fieldRefs 해석: 값이 없으면 null, 있으면 표시 라벨(없으면 값 자체).
export function readScopeDisplayValue(
  store: ScopeStore,
  scopeKey: string,
  fieldKey: string,
): string | null {
  const draft = store[scopeKey]
  if (!draft) {
    return null
  }
  const value = draft.values[fieldKey]
  if (value === null || value === undefined || value.trim() === '') {
    return null
  }
  return draft.labels[fieldKey] ?? value
}
