// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { snapshotHtml } from '@/test-support/snapshot-html'
import KakaoBlock from './KakaoBlock'

// 앱 틀과 알림을 나누기 전의 겉 모양을 그대로 적어 둔 특성 시험이다(docs/features/r01-maintainability.md 조각 7).
// 나눈 뒤에도 이 스냅숏 파일은 바뀌지 않아야 한다.
afterEach(cleanup)
const kakao =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.0'
const location = { href: 'https://vada.test/join/ABCD2345' }

test('처음 안내', () => {
  render(
    <KakaoBlock
      userAgent={kakao}
      location={location}
      clipboard={{ writeText: vi.fn(async () => {}) }}
    />,
  )
  expect(snapshotHtml()).toMatchSnapshot()
})

test('주소를 복사했을 때', async () => {
  render(
    <KakaoBlock
      userAgent={kakao}
      location={location}
      clipboard={{ writeText: vi.fn(async () => {}) }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '주소 복사' }))
  await screen.findByText('주소를 복사했어요. 사파리나 Chrome에 붙여 넣어 주세요.')
  expect(snapshotHtml()).toMatchSnapshot()
})

test('복사가 막혔을 때', async () => {
  render(
    <KakaoBlock
      userAgent={kakao}
      location={location}
      clipboard={{
        writeText: async () => {
          throw new Error('blocked')
        },
      }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '주소 복사' }))
  await screen.findByText('주소를 복사하지 못했어요. 아래 주소를 길게 눌러 복사해 주세요.')
  expect(snapshotHtml()).toMatchSnapshot()
})
