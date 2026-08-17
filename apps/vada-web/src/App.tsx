import { useState } from 'react'
import { ScreenRouter } from './screens/ScreenRouter'
import type { ScopeDraft, ScopeStore } from './state/scopes'

function App() {
  const [screenId, setScreenId] = useState('ONB-01')
  // state-scopes.json의 스코프별 초안. 화면 이동 후 복귀해도 값이 유지되고,
  // ORG-01의 note는 onboardingDraft 스코프를 읽는다(메모리 수준).
  const [scopes, setScopes] = useState<ScopeStore>({})

  function changeScope(scopeKey: string, next: ScopeDraft) {
    setScopes((previous) => ({ ...previous, [scopeKey]: next }))
  }

  return (
    <ScreenRouter
      screenId={screenId}
      scopes={scopes}
      onChangeScope={changeScope}
      onNavigate={setScreenId}
    />
  )
}

export default App
