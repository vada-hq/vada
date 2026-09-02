import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignInScreen } from './SignInScreen'

// **명세에서 나오지 않은 유일한 화면이다.** 그래서 준수 검사도 design 대조도 이 자리를
// 보지 않는다 — 여기가 이 화면을 재는 유일한 곳이다.

function answering(ways: unknown, ok = true) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void init
    if (String(input).endsWith('/api/auth-ways')) {
      return new Response(JSON.stringify({ ways }), {
        status: ok ? 200 : 500,
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ url: 'https://accounts.example/authorize' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('들어오는 자리', () => {
  it('서버가 연 길만 그린다', async () => {
    vi.stubGlobal('fetch', answering([{ provider: 'google', label: '구글로 계속하기' }]))
    render(<SignInScreen />)

    expect(await screen.findByRole('button', { name: '구글로 계속하기' })).toBeInTheDocument()
    // 서버가 열지 않은 길은 그리지 않는다 — 그리면 누른 사람이 알 수 없는 오류를 본다.
    expect(screen.queryByRole('button', { name: /카카오/ })).not.toBeInTheDocument()
  })

  it('단추의 글을 화면이 지어내지 않는다', async () => {
    // 서버가 다른 글을 주면 그 글이 그려진다. 화면이 '구글'을 들고 있으면 이 검사가
    // 실패한다 — 길이 늘 때 화면을 고쳐야 한다는 뜻이기 때문이다.
    vi.stubGlobal('fetch', answering([{ provider: 'kakao', label: '카카오톡으로 시작' }]))
    render(<SignInScreen />)
    expect(await screen.findByRole('button', { name: '카카오톡으로 시작' })).toBeInTheDocument()
  })

  // 빈 화면은 고장과 구분되지 않는다.
  it('길이 하나도 없으면 그 사실을 말한다', async () => {
    vi.stubGlobal('fetch', answering([]))
    render(<SignInScreen />)
    expect(await screen.findByText(/들어올 길이 아직 열리지 않았습니다/)).toBeInTheDocument()
  })

  it('길을 확인하지 못하면 말한다', async () => {
    vi.stubGlobal('fetch', answering([], false))
    render(<SignInScreen />)
    expect(await screen.findByText(/확인하지 못했습니다/)).toBeInTheDocument()
  })

  // **주소를 화면이 지어내지 않는다.** 제공자마다 다르고 바뀌면 조용히 틀린 곳으로 보낸다.
  it('갈 곳은 서버가 알려 준 주소다', async () => {
    const fetching = answering([{ provider: 'google', label: '구글로 계속하기' }])
    vi.stubGlobal('fetch', fetching)
    const assign = vi.fn()
    vi.stubGlobal('location', { href: 'http://localhost/#/SIGN-IN', assign })

    render(<SignInScreen />)
    await userEvent.click(await screen.findByRole('button', { name: '구글로 계속하기' }))

    await waitFor(() => {
      const calls = fetching.mock.calls.map((call) => String(call[0]))
      expect(calls.some((url) => url.endsWith('/api/auth/sign-in/social'))).toBe(true)
    })
  })

  // **로그인 뒤 제자리로 돌려보내지 않는다.**
  //
  // '보고 있던 곳으로 돌아온다'고 적어 두고 `window.location.href`를 그대로 넘겼는데,
  // 로그인 화면에서 누르면 **보고 있던 곳이 로그인 화면**이다. 그래서 구글을 다녀온
  // 사람이 다시 로그인 화면을 보고, 화면은 아무 오류도 내지 않는다 — 로그인은 실제로
  // 됐으므로 조용하다.
  async function callbackFor(href: string): Promise<string> {
    const fetching = answering([{ provider: 'google', label: '구글로 계속하기' }])
    vi.stubGlobal('fetch', fetching)
    vi.stubGlobal('location', { href, assign: vi.fn() })
    render(<SignInScreen />)
    await userEvent.click(await screen.findByRole('button', { name: '구글로 계속하기' }))
    const call = await waitFor(() => {
      const found = fetching.mock.calls.find((one) => String(one[0]).endsWith('/sign-in/social'))
      expect(found).toBeDefined()
      return found!
    })
    return JSON.parse(String((call[1] as RequestInit).body)).callbackURL as string
  }

  it('로그인 화면에서 왔으면 첫 화면으로 돌려보낸다', async () => {
    expect(await callbackFor('http://localhost/#/SIGN-IN')).toBe('http://localhost/#/ONB-01')
  })

  // 인자를 달고 온 것도 로그인 화면이다. 앞에 붙은 것만 보면 놓친다.
  it('인자가 붙어 있어도 로그인 화면이면 첫 화면으로 보낸다', async () => {
    expect(await callbackFor('http://localhost/#/SIGN-IN?from=x')).toBe(
      'http://localhost/#/ONB-01',
    )
  })

  // 다른 화면에서 왔으면 그리로 돌아간다 — 그 자리를 없애는 것이 아니다.
  it('다른 화면에서 왔으면 그리로 돌아간다', async () => {
    expect(await callbackFor('http://localhost/#/EVT-02?eventId=E-01')).toBe(
      'http://localhost/#/EVT-02?eventId=E-01',
    )
  })

  // 세션이 쿠키에 있으므로 이것이 빠지면 로그인해도 다음 요청이 남남이다.
  it('쿠키를 함께 보낸다', async () => {
    const fetching = answering([{ provider: 'google', label: '구글로 계속하기' }])
    vi.stubGlobal('fetch', fetching)
    render(<SignInScreen />)
    await screen.findByRole('button', { name: '구글로 계속하기' })
    expect(fetching.mock.calls[0]![1]).toMatchObject({ credentials: 'include' })
  })
})
