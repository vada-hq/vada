// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import PageHeading, { PageTrailProvider, type PageTrail } from './PageHeading'

afterEach(cleanup)

const trail: PageTrail = {
  title: '신입생 환영회',
  crumbs: [
    { label: '신입생 환영회', truncate: true },
    { label: '업무', truncate: false },
  ],
}

test('머리글이 있으면 제목과 경로 칸을 머리글에 넘기고 그 자리에는 그리지 않는다', () => {
  const send = vi.fn()
  const { unmount } = render(
    <PageTrailProvider value={send}>
      <main>
        <PageHeading trail={trail}>
          <h2>신입생 환영회</h2>
        </PageHeading>
      </main>
    </PageTrailProvider>,
  )
  expect(send).toHaveBeenLastCalledWith(trail)
  expect(screen.getByRole('main').textContent).toBe('')
  unmount()
  expect(send).toHaveBeenLastCalledWith(null)
})

test('같은 경로로 다시 그려도 다시 넘기지 않는다', () => {
  const send = vi.fn()
  const view = (value: PageTrail) => (
    <PageTrailProvider value={send}>
      <PageHeading trail={value}>제목</PageHeading>
    </PageTrailProvider>
  )
  const { rerender } = render(view(trail))
  rerender(view({ ...trail, crumbs: [...trail.crumbs] }))
  expect(send).toHaveBeenCalledTimes(1)
})

test('머리글이 없으면(시험, 부품 확인 화면) 그 자리에 제목을 그린다', () => {
  render(
    <main>
      <PageHeading trail={trail}>
        <h2>신입생 환영회</h2>
      </PageHeading>
    </main>,
  )
  expect(screen.getByRole('heading', { name: '신입생 환영회' })).toBeTruthy()
})
