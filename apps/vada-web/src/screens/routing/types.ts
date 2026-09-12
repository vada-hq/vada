import type { ReactElement } from 'react'
import type { ScopeDraft, ScopeStore } from '../../state/scopes'

export interface ScreenRouterProps {
  screenId: string
  // 주소가 실어 온 화면 인자. 상세 화면만 쓴다(screen.json의 params).
  screenParams?: Record<string, string>
  scopes: ScopeStore
  onChangeScope: (scopeKey: string, next: ScopeDraft) => void
  // 이동하면서 인자를 함께 넘긴다 — 칸반 카드가 '어느 업무인지'를 준다.
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  // 상태 스코프의 수명 이벤트. 제출 성공 시 action.onSuccess.scopeEvent로만 발생한다.
  onScopeEvent?: (scopeKey: string, event: 'complete' | 'cancel') => void
}

/** 공통 진입부에서 주소 인자와 수명 이벤트의 기본값을 채운다. */
export type ScreenContext = Required<ScreenRouterProps>

// 등록 함수는 JSX 연결만 한다. 훅과 화면 상태는 화면 컴포넌트가 맡는다.
export type ScreenRenderer = (context: ScreenContext) => ReactElement

export interface ScreenRegistration {
  screenIds: readonly string[]
  render: ScreenRenderer
}
