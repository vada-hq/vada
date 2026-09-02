import { useEffect, useState } from 'react'
import { DevScreenPicker } from './components/DevScreenPicker'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ScreenRouter } from './screens/ScreenRouter'
import { SignInScreen } from './screens/SignInScreen'
import { FIRST_SCREEN, SIGN_IN } from './screens/routes'
import type { ScopeDraft, ScopeStore } from './state/scopes'

// 화면의 주소는 screenId다 — 이미 명세가 갖고 있으므로 따로 정하지 않는다.
// 주소로 화면을 열 수 있으면 흐름 중간 화면을 앞 단계 없이 바로 볼 수 있고,
// 브라우저의 뒤로/앞으로가 그대로 동작한다.
//
// **계약 밖의 이름 둘은 `routes.ts`에 있다.** 로그인 화면이 같은 이름을 알아야 하고,
// 각자 들고 있으면 한쪽만 고쳐도 아무 오류가 안 난다.

// 주소는 `#/<screenId>`이고, 상세 화면은 뒤에 인자가 붙는다(`#/EVT-TASK-02?taskId=T-03`).
// 인자를 주소에 두는 이유는 화면의 주소로 여는 성질을 지키기 위해서다 — 상세를
// 열려면 앞 화면을 반드시 거쳐야 한다면 그 화면만 따로 볼 수 없다.
function routeFromHash(): { screenId: string; params: Record<string, string> } {
  const hash = window.location.hash.replace(/^#\/?/, '').trim()
  const [id, query] = hash.split('?')
  return {
    screenId: id === '' ? FIRST_SCREEN : id,
    params: Object.fromEntries(new URLSearchParams(query ?? '')),
  }
}

function App() {
  const [route, setRoute] = useState(routeFromHash)
  const { screenId, params: screenParams } = route
  // state-scopes.json의 스코프별 초안. 화면 이동 후 복귀해도 값이 유지되고,
  // ORG-01의 note는 onboardingDraft 스코프를 읽는다(메모리 수준).
  const [scopes, setScopes] = useState<ScopeStore>({})

  // 주소창을 직접 고치거나 뒤로/앞으로를 누른 경우.
  useEffect(() => {
    function sync() {
      setRoute(routeFromHash())
    }
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  function navigate(next: string, params: Record<string, string> = {}) {
    setRoute({ screenId: next, params })
    // 주소를 화면과 맞춘다. 같은 자리면 기록을 늘리지 않는다.
    const query = new URLSearchParams(params).toString()
    const target = query === '' ? `#/${next}` : `#/${next}?${query}`
    if (window.location.hash !== target) {
      window.location.hash = target
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
      {/* 렌더 중 throw가 백지가 되지 않게 받는다. 이 저장소는 명세의 구멍을
          조용히 넘기지 않고 던지므로, 받는 자리가 없으면 그 던짐이 가장 안
          보이는 모양이 된다. 화면을 옮기면 경계가 다시 그려 본다. */}
      <ErrorBoundary screenId={screenId}>
        {screenId === SIGN_IN ? (
          <SignInScreen />
        ) : (
        <ScreenRouter
          screenId={screenId}
          screenParams={screenParams}
          scopes={scopes}
          onChangeScope={changeScope}
          onNavigate={navigate}
          onScopeEvent={handleScopeEvent}
        />
        )}
      </ErrorBoundary>
      {import.meta.env.DEV ? (
        <DevScreenPicker screenId={screenId} onNavigate={navigate} />
      ) : null}
    </>
  )
}

export default App
