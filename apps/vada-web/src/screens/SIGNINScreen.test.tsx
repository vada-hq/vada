import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { configureServer } from '../data-sources/server'
import { ScreenRouter } from './ScreenRouter'

// **누르면 브라우저가 떠나는가.**
//
// 서버는 제공자로 가는 주소를 답한다. 그 주소로 브라우저를 보내지 않으면 **아무 일도
// 일어나지 않는다** — 보내는 동안의 글이 잠깐 떴다가 원래 글로 돌아올 뿐이고, 오류도
// 나지 않는다. 실제로 그랬다(2026-09-02). 사람이 눌러 보고서야 알았다.
//
// 오늘 하루 잡아 온 것과 같은 계열이다: **보냈는데 아무 일도 안 일어나고 화면은 조용하다.**

const WENT_TO = 'https://accounts.google.example/o/oauth2?state=xyz'

let back: (() => void) | null = null

afterEach(() => {
  back?.()
  back = null
  cleanup()
  vi.unstubAllGlobals()
})

/** 서버 대신 답한다. 길 목록은 GET, 들어가기는 POST다. */
function serverAnswering(
  ways: { google: boolean; kakao: boolean },
  answer: unknown = { url: WENT_TO },
  status = 200,
) {
  const sent: string[] = []
  back = configureServer({
    baseUrl: '',
    fetch: async (input, init) => {
      const url = String(input)
      if ((init?.method ?? 'GET') === 'GET') return Response.json(ways)
      sent.push(url)
      return Response.json(answer, { status })
    },
  })
  return sent
}

describe('들어오는 자리', () => {
  it.each([
    { provider: 'google', label: '구글로 계속하기' },
    { provider: 'kakao', label: '카카오로 계속하기' },
  ])('$provider 단추를 누르면 서버가 준 주소로 브라우저가 떠난다', async ({ provider, label }) => {
    const sent = serverAnswering({ google: true, kakao: true })
    const assign = vi.fn()
    vi.stubGlobal('location', { href: 'http://localhost/#/SIGN-IN', assign })

    render(
      <ScreenRouter screenId="SIGN-IN" scopes={{}} onChangeScope={() => {}} onNavigate={() => {}} />,
    )
    await userEvent.click(await screen.findByRole('button', { name: label }))

    // 어느 길인지는 자리가 정한다 — 화면이 제공자 이름을 본문에 싣지 않는다.
    await waitFor(() => expect(sent).toEqual([`/api/sign-in/${provider}`]))
    // **그리고 떠나야 한다.** 여기가 비어 있던 자리다.
    await waitFor(() => expect(window.location.href).toBe(WENT_TO))
  })

  it('URL이 문자열이 아닌 응답에는 현재 화면을 유지한다', async () => {
    serverAnswering({ google: true, kakao: false }, { url: 12 })
    const current = 'http://localhost/#/SIGN-IN'
    vi.stubGlobal('location', { href: current })
    render(
      <ScreenRouter screenId="SIGN-IN" scopes={{}} onChangeScope={() => {}} onNavigate={() => {}} />,
    )
    await userEvent.click(await screen.findByRole('button', { name: '구글로 계속하기' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '구글로 계속하기' })).toBeEnabled())
    expect(window.location.href).toBe(current)
  })

  it('요청이 실패하면 이동하지 않고 서버의 오류 메시지를 표시한다', async () => {
    serverAnswering({ google: true, kakao: false }, { message: '잠시 후 다시 시도해 주세요' }, 429)
    const current = 'http://localhost/#/SIGN-IN'
    vi.stubGlobal('location', { href: current })
    render(
      <ScreenRouter screenId="SIGN-IN" scopes={{}} onChangeScope={() => {}} onNavigate={() => {}} />,
    )
    await userEvent.click(await screen.findByRole('button', { name: '구글로 계속하기' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('잠시 후 다시 시도해 주세요')
    expect(window.location.href).toBe(current)
  })

  // **닫힌 길은 그리지 않는다.** 카카오 열쇠를 안 넣은 배포에서 그 단추를 그리면
  // 눌러도 안 되고, 사람은 자기 잘못인 줄 안다.
  it('열려 있는 길만 그린다', async () => {
    serverAnswering({ google: true, kakao: false })
    render(
      <ScreenRouter screenId="SIGN-IN" scopes={{}} onChangeScope={() => {}} onNavigate={() => {}} />,
    )
    expect(await screen.findByRole('button', { name: '구글로 계속하기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '카카오로 계속하기' })).not.toBeInTheDocument()
  })

  it('둘 다 열렸으면 둘 다 그린다', async () => {
    serverAnswering({ google: true, kakao: true })
    render(
      <ScreenRouter screenId="SIGN-IN" scopes={{}} onChangeScope={() => {}} onNavigate={() => {}} />,
    )
    expect(await screen.findByRole('button', { name: '구글로 계속하기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '카카오로 계속하기' })).toBeInTheDocument()
  })
})
