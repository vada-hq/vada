// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import KakaoBlock from './KakaoBlock'

afterEach(cleanup)
const kakao = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.0'

test('바깥 브라우저로 열기는 카카오톡의 바깥 브라우저 주소로 보낸다', () => {
  const location = { href: 'https://vada.test/join/ABCD2345' }
  render(<KakaoBlock userAgent={kakao} location={location} clipboard={{ writeText: vi.fn(async () => {}) }} />)
  expect(screen.getByText('카카오톡 안에서는 Google 로그인이 막혀 있어요. 바깥 브라우저로 열어 주세요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '바깥 브라우저로 열기' }))
  expect(location.href).toBe('kakaotalk://web/openExternal?url=https%3A%2F%2Fvada.test%2Fjoin%2FABCD2345')
})

test('주소를 복사하면 알린다', async () => {
  const writeText = vi.fn(async (_text: string) => {})
  render(<KakaoBlock userAgent={kakao} location={{ href: 'https://vada.test/' }} clipboard={{ writeText }} />)
  fireEvent.click(screen.getByRole('button', { name: '주소 복사' }))
  expect(await screen.findByText('주소를 복사했어요. 사파리나 Chrome에 붙여 넣어 주세요.')).toBeTruthy()
  expect(writeText).toHaveBeenCalledWith('https://vada.test/')
})

test('복사가 막히면 주소를 글자로 보여 길게 눌러 고르게 한다', async () => {
  render(<KakaoBlock userAgent={kakao} location={{ href: 'https://vada.test/' }}
    clipboard={{ writeText: async () => { throw new Error('denied') } }} />)
  fireEvent.click(screen.getByRole('button', { name: '주소 복사' }))
  expect(await screen.findByText('주소를 복사하지 못했어요. 아래 주소를 길게 눌러 복사해 주세요.')).toBeTruthy()
  expect(screen.getByText('https://vada.test/').className).toContain('select-all')
})
