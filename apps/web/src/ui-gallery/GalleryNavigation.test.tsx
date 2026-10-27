// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { GalleryNavigation } from './GalleryNavigation'
import { Section } from './GallerySection'

afterEach(() => {
  cleanup()
  history.replaceState(null, '', '/ui.html')
})

test('구역 제목이 정확히 맞는 시안만 그리고 목록은 중복 없이 모두 남긴다', () => {
  history.replaceState(null, '', '/ui.html?section=시안')
  render(
    <StrictMode>
      <GalleryNavigation>
        <Section title="시안">고른 내용</Section>
        <Section title="시안 둘">다른 내용</Section>
      </GalleryNavigation>
    </StrictMode>,
  )
  expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual([
    '시안',
  ])
  expect(screen.queryByText('다른 내용')).toBeNull()
  const navigation = screen.getByRole('navigation', { name: '구역 목록' })
  expect(
    within(navigation)
      .getAllByRole('link')
      .map(link => link.textContent),
  ).toEqual(['모든 구역', '시안', '시안 둘'])
})
