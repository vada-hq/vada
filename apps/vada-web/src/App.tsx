import { useEffect, useState } from 'react'
import { DevScreenPicker } from './components/DevScreenPicker'
import { ScreenRouter } from './screens/ScreenRouter'
import type { ScopeDraft, ScopeStore } from './state/scopes'

// 화면의 주소는 screenId다 — 이미 명세가 갖고 있으므로 따로 정하지 않는다.
// 주소로 화면을 열 수 있으면 흐름 중간 화면을 앞 단계 없이 바로 볼 수 있고,
// 브라우저의 뒤로/앞으로가 그대로 동작한다.
const FIRST_SCREEN = 'ONB-01'

function screenIdFromHash(): string {
  const hash = window.location.hash.replace(/^#\/?/, '').trim()
  return hash === '' ? FIRST_SCREEN : hash
}

function App() {
  const [screenId, setScreenId] = useState(screenIdFromHash)
  // state-scopes.json의 스코프별 초안. 화면 이동 후 복귀해도 값이 유지되고,
  // ORG-01의 note는 onboardingDraft 스코프를 읽는다(메모리 수준).
  const [scopes, setScopes] = useState<ScopeStore>({})

  // 주소창을 직접 고치거나 뒤로/앞으로를 누른 경우.
  useEffect(() => {
    function sync() {
      setScreenId(screenIdFromHash())
    }
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  function navigate(next: string) {
    setScreenId(next)
    // 주소를 화면과 맞춘다. 같은 화면이면 기록을 늘리지 않는다.
    if (screenIdFromHash() !== next) {
      window.location.hash = `#/${next}`
    }
  }

  function changeScope(scopeKey: string, next: ScopeDraft) {
    setScopes((previous) => ({ ...previous, [scopeKey]: next }))
  }

  // state-scopes.json의 clearOn: complete·cancel 시 스코프를 제거한다.
  // 수명 관리와 데이터 전송은 분리된 관심사이므로 이벤트는 action에서만 온다.
  function handleScopeEvent(scopeKey: string) {
    setScopes((previous) => {
      const next = { ...previous }
      delete next[scopeKey]
      return next
    })
  }

  return (
    <>
      <ScreenRouter
        screenId={screenId}
        scopes={scopes}
        onChangeScope={changeScope}
        onNavigate={navigate}
        onScopeEvent={handleScopeEvent}
      />
      {import.meta.env.DEV ? (
        <DevScreenPicker screenId={screenId} onNavigate={navigate} />
      ) : null}
    </>
  )
}

export default App
