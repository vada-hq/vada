import { useEffect, useState } from 'react'
import { DevScreenPicker } from './components/DevScreenPicker'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ScreenRouter } from './screens/ScreenRouter'
import { FIRST_SCREEN } from './screens/routes'
import { apiBaseUrl, browserFetch, servingFromServer } from './data-sources/server'
import { APP_START_PATH, parseAppStartResponse } from './data-sources/app-start'
import type { ScopeDraft, ScopeStore } from './state/scopes'

// 화면의 주소는 screenId다 — 이미 명세가 갖고 있으므로 따로 정하지 않는다.
// 주소로 화면을 열 수 있으면 흐름 중간 화면을 앞 단계 없이 바로 볼 수 있고,
// 브라우저의 뒤로/앞으로가 그대로 동작한다.
//
// **앱을 열면 어디부터인가는 `routes.ts`가 든다.** 그림이 답하지 않는 자리라
// 명세에서 오지 않는다 — 로그인 화면과 달리 이것은 그릴 것이 없는 결정이다.

// 주소는 `#/<screenId>`이고, 상세 화면은 뒤에 인자가 붙는다(`#/EVT-TASK-02?taskId=T-03`).
// 인자를 주소에 두는 이유는 화면의 주소로 여는 성질을 지키기 위해서다 — 상세를
// 열려면 앞 화면을 반드시 거쳐야 한다면 그 화면만 따로 볼 수 없다.
/**
 * 주소가 가리키는 화면. **주소가 비었으면 빈 글이다 — 아직 모른다는 뜻이다.**
 *
 * 한동안 이 자리에서 곧바로 `ONB-01`을 골랐다. 그러면 서버에게 묻기도 전에 화면이
 * 하나 그려지고, 답이 온 뒤 다른 화면으로 튄다 — 로그인한 사람이 소속 입력 화면을
 * 한 번 보고 집으로 가는 모양이었다.
 */
function routeFromHash(): { screenId: string; params: Record<string, string> } {
  const hash = window.location.hash.replace(/^#\/?/, '').trim()
  const [id, query] = hash.split('?')
  return {
    screenId: id ?? '',
    params: Object.fromEntries(new URLSearchParams(query ?? '')),
  }
}

/**
 * **주소를 안 주고 열었으면 서버에게 어디부터인지 묻는다.**
 *
 * 로그인했는지와 이미 어느 학생회에 속했는지는 세션이 정하고 그것은 서버에 있다 —
 * 화면은 세션을 못 읽으므로 스스로 판정할 수가 없다.
 *
 * 한동안 무조건 `ONB-01`(소속 입력)로 갔다. 이미 들어온 사람도 열 때마다 그 화면부터
 * 봤고, 로그인 화면으로 데려가는 길은 아예 없어 주소를 직접 쳐야 했다
 * (2026-09-08에 사람이 겪었다).
 *
 * **주소가 있으면 건드리지 않는다.** 화면의 주소로 여는 성질이 이 저장소의 규칙이라,
 * 사람이 가리킨 자리를 서버의 답으로 덮으면 그 규칙이 깨진다.
 */
function useStartScreen(
  unknown: boolean,
  go: (route: { screenId: string; params: Record<string, string> }) => void,
) {
  useEffect(() => {
    if (!unknown) return
    // 서버에 안 붙은 빌드(개발용 응답·시나리오 검사)는 물을 곳이 없다. 그때는
    // 지금까지처럼 첫 화면이다.
    if (!servingFromServer()) {
      go({ screenId: FIRST_SCREEN, params: {} })
      return
    }
    let live = true
    // **부르는 길은 하나다**(`browserFetch`). 맨 `fetch`는 쿠키를 안 싣고, 그러면
    // 방금 로그인한 사람도 서버에게는 로그인하지 않은 사람으로 보인다 — 웹과 api가
    // 다른 주소에 있을 때 특히 그렇다.
    void browserFetch(`${apiBaseUrl()}${APP_START_PATH}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: unknown) => {
        if (!live) return
        const said = parseAppStartResponse(body)
        // 못 물었으면 지금까지처럼 첫 화면이다 — 갈 곳 없이 세워 두지 않는다.
        const to = said === null ? FIRST_SCREEN : said.screenId
        go({ screenId: to, params: {} })
        window.location.hash = `#/${to}`
      })
      .catch(() => {
        if (live) go({ screenId: FIRST_SCREEN, params: {} })
      })
    return () => {
      live = false
    }
  }, [unknown, go])
}

function App() {
  const [route, setRoute] = useState(routeFromHash)
  const { screenId, params: screenParams } = route
  // 주소가 비었으면 아직 모른다. 서버가 답할 때까지 아무 화면도 그리지 않는다.
  useStartScreen(screenId === '', setRoute)
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

  // **모르는 동안은 지어내지 않는다.** 화면 하나를 골라 그리면 답이 온 뒤 튀고,
  // 사람은 자기와 상관없는 화면을 한 번 본다.
  if (screenId === '') {
    return (
      <div
        role="status"
        className="flex min-h-screen items-center justify-center text-sm text-gray-500"
      >
        여는 중입니다
      </div>
    )
  }

  return (
    <>
      {/* 렌더 중 throw가 백지가 되지 않게 받는다. 이 저장소는 명세의 구멍을
          조용히 넘기지 않고 던지므로, 받는 자리가 없으면 그 던짐이 가장 안
          보이는 모양이 된다. 화면을 옮기면 경계가 다시 그려 본다. */}
      <ErrorBoundary screenId={screenId}>
        <ScreenRouter
          screenId={screenId}
          screenParams={screenParams}
          scopes={scopes}
          onChangeScope={changeScope}
          onNavigate={navigate}
          onScopeEvent={handleScopeEvent}
        />
      </ErrorBoundary>
      {import.meta.env.DEV ? (
        <DevScreenPicker screenId={screenId} onNavigate={navigate} />
      ) : null}
    </>
  )
}

export default App
