import { useEffect, useState } from 'react'
import { navigationsOf } from './outside-spec'
import { SIGN_IN } from './routes'
import { AppHeader } from '../components/AppHeader'
import { PageCard } from '../components/PageCard'
import { apiBaseUrl } from '../data-sources/server'

// 들어오는 자리.
//
// **이 화면은 명세에서 나오지 않았다.** 와이어프레임은 이미 들어온 사람만 그리고,
// 그래서 그림도 명세도 이 자리를 갖고 있지 않다. 그런데 사람이 들어오려면 무언가는
// 그려야 하므로, 여기서만 예외를 둔다 — `docs/decisions/product-decisions.md`에 적었다.
//
// 예외를 두되 **지어내지는 않는다.**
//
// · 어느 길이 열렸는지는 서버가 말한다(`/api/auth-ways`). 화면이 '구글'을 들고 있으면
//   자격증명이 없는 날에도 단추가 그려지고, 누른 사람은 알 수 없는 오류를 본다.
// · 단추의 글도 서버가 준다. 길이 하나 늘 때 화면을 고치지 않기 위해서다.
// · 길이 하나도 없으면 **그 사실을 말한다.** 빈 화면은 고장과 구분되지 않는다.

interface Way {
  provider: string
  label: string
}

type State =
  | { at: 'loading' }
  | { at: 'ready'; ways: Way[] }
  | { at: 'error'; message: string }

/**
 * 로그인 뒤 돌아올 자리.
 *
 * 보고 있던 곳으로 돌아온다 — **로그인 화면만 빼고.** 오랫동안 `window.location.href`를
 * 그대로 넘겼는데, 이 화면에서 누르면 보고 있던 곳이 이 화면이라 구글을 다녀온 사람이
 * 다시 로그인 화면을 봤다. **로그인은 실제로 됐으므로 아무 오류도 안 났다** — 사람은
 * 실패한 줄 알고 다시 누른다.
 *
 * 앞에 붙은 것만 보면 인자를 달고 온 것(`#/SIGN-IN?from=x`)을 놓친다.
 */
function callbackUrl(): string {
  const here = new URL(window.location.href)
  const screenId = here.hash.replace(/^#\/?/, '').split('?')[0]
  if (screenId !== SIGN_IN) return here.href
  // **어디로 갈지는 이 화면이 정하지 않는다.** 명세 있는 화면이 `action.targetScreenId`를
  // 읽듯, 명세 밖인 이 화면은 `outside-spec.ts`에 적힌 것을 읽는다. 코드와 검사가 같은
  // 곳에서 나와야 둘이 조용히 갈라지지 않는다.
  here.hash = `#/${navigationsOf(SIGN_IN)[0]!.to}`
  return here.href
}

export function SignInScreen() {
  const [state, setState] = useState<State>({ at: 'loading' })
  const [going, setGoing] = useState<string | null>(null)
  const base = apiBaseUrl()

  useEffect(() => {
    let cancelled = false
    fetch(`${base}/api/auth-ways`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`)
        return (await res.json()) as { ways: Way[] }
      })
      .then((body) => {
        if (!cancelled) setState({ at: 'ready', ways: body.ways })
      })
      .catch(() => {
        if (!cancelled) {
          setState({ at: 'error', message: '들어오는 길을 확인하지 못했습니다.' })
        }
      })
    return () => {
      cancelled = true
    }
  }, [base])

  // Better Auth가 갈 곳을 알려 주면 그리로 간다. 주소를 화면이 지어내지 않는다 —
  // 제공자마다 다르고, 바뀌면 화면이 조용히 틀린 곳으로 보낸다.
  async function go(way: Way) {
    setGoing(way.provider)
    try {
      const res = await fetch(`${base}/api/auth/sign-in/social`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider: way.provider, callbackURL: callbackUrl() }),
      })
      const body = (await res.json()) as { url?: string }
      if (!res.ok || typeof body.url !== 'string') throw new Error('no url')
      window.location.href = body.url
    } catch {
      setGoing(null)
      setState({ at: 'error', message: `${way.label.replace(/로 계속하기$/, '')}로 들어가지 못했습니다.` })
    }
  }

  return (
    <PageCard>
      <AppHeader />
      <h1 className="pt-6 text-lg font-semibold text-gray-900">학생회 도구에 들어가기</h1>
      <p className="pt-1 text-sm text-gray-500">
        평소 쓰는 계정으로 들어옵니다. 비밀번호를 따로 만들지 않습니다.
      </p>

      <div className="flex flex-col gap-3 pt-6">
        {state.at === 'loading' && (
          <p className="text-sm text-gray-500">들어오는 길을 확인하는 중입니다</p>
        )}

        {state.at === 'error' && (
          <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {state.message}
          </p>
        )}

        {state.at === 'ready' && state.ways.length === 0 && (
          // **고장이 아니라 설정이다.** 그 말을 해 주지 않으면 여는 사람이
          // 빈 화면을 보고 무엇이 잘못됐는지 알 수 없다.
          <p className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            들어올 길이 아직 열리지 않았습니다. 서버에 구글이나 카카오 자격증명이 없습니다.
          </p>
        )}

        {state.at === 'ready' &&
          state.ways.map((way) => (
            <button
              key={way.provider}
              type="button"
              disabled={going !== null}
              onClick={() => void go(way)}
              className="w-full rounded-md border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none disabled:opacity-60"
            >
              {going === way.provider ? '들어가는 중입니다' : way.label}
            </button>
          ))}
      </div>

      <p className="pt-6 text-xs text-gray-400">
        들어온 뒤 초대 코드로 학생회에 들어가거나 새 학생회를 만들 수 있습니다.
      </p>
    </PageCard>
  )
}
