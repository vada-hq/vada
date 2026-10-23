// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import PageActions, { PageActionsProvider } from './PageActions'

afterEach(cleanup)

test('머리글 자리가 있으면 페이지 행동을 그 자리에 그린다', () => {
  const slot = document.createElement('div')
  document.body.append(slot)
  render(
    <PageActionsProvider value={slot}>
      <main>
        <PageActions>
          <button type="button">행사 만들기</button>
        </PageActions>
      </main>
    </PageActionsProvider>,
  )
  expect(slot.contains(screen.getByRole('button', { name: '행사 만들기' }))).toBe(true)
  expect(screen.getByRole('main').textContent).toBe('')
  slot.remove()
})

test('머리글 자리가 없으면 그 자리에 그린다', () => {
  render(
    <main>
      <PageActions>
        <button type="button">행사 만들기</button>
      </PageActions>
    </main>,
  )
  expect(screen.getByRole('main').textContent).toBe('행사 만들기')
})
