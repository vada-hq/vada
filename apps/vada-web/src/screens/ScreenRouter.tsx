import { PageCard } from '../components/PageCard'
import { ONB01Screen } from './ONB01Screen'
import { ONB02Screen } from './ONB02Screen'
import { ORG01Screen } from './ORG01Screen'
import { onb01, org01 } from '../spec/screens'
import { readScopeDraft } from '../state/scopes'
import type { ScopeDraft, ScopeStore } from '../state/scopes'

interface ScreenRouterProps {
  screenId: string
  scopes: ScopeStore
  onChangeScope: (scopeKey: string, next: ScopeDraft) => void
  onNavigate: (screenId: string) => void
}

// 내비게이션 계약(element-types.md): 스펙의 targetScreenId가 구현에 등록되지
// 않은 화면이면 조용한 대체 없이 명시적 오류를 표시한다.
// 각 화면에는 자기 stateScopeKey의 초안만 전달한다. 다른 스코프를 읽는 요소
// (note)는 scopes 전체를 받는다.
export function ScreenRouter({ screenId, scopes, onChangeScope, onNavigate }: ScreenRouterProps) {
  if (screenId === 'ONB-01') {
    return (
      <ONB01Screen
        draft={readScopeDraft(scopes, onb01.stateScopeKey)}
        onChangeDraft={(next) => onChangeScope(onb01.stateScopeKey ?? '', next)}
        onNavigate={onNavigate}
      />
    )
  }
  if (screenId === 'ONB-02') {
    return <ONB02Screen onNavigate={onNavigate} />
  }
  if (screenId === 'ORG-01') {
    return (
      <ORG01Screen
        draft={readScopeDraft(scopes, org01.stateScopeKey)}
        scopes={scopes}
        onChangeDraft={(next) => onChangeScope(org01.stateScopeKey ?? '', next)}
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <PageCard>
      <h1 className="text-lg font-semibold text-red-500">구현에 등록되지 않은 화면입니다</h1>
      <p className="pt-1 text-sm text-gray-500">
        스펙이 <code className="text-gray-800">{screenId}</code> 화면으로 이동을 선언했지만, 이
        화면은 아직 구현에 등록되지 않았습니다.
      </p>
      <div className="pt-6">
        <button
          type="button"
          onClick={() => onNavigate('ONB-01')}
          className="w-full rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          처음 화면으로 돌아가기
        </button>
      </div>
    </PageCard>
  )
}
