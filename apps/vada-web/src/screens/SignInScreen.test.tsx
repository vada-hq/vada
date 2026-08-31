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

  // 세션이 쿠키에 있으므로 이것이 빠지면 로그인해도 다음 요청이 남남이다.
  it('쿠키를 함께 보낸다', async () => {
    const fetching = answering([{ provider: 'google', label: '구글로 계속하기' }])
    vi.stubGlobal('fetch', fetching)
    render(<SignInScreen />)
    await screen.findByRole('button', { name: '구글로 계속하기' })
    expect(fetching.mock.calls[0]![1]).toMatchObject({ credentials: 'include' })
  })
})
