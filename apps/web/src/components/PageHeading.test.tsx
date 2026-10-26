// @vitest-environment jsdom
import { useLayoutEffect, type ReactNode } from 'react'
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

// 비동기 응답 뒤 화면을 옮기면 일반 effect는 칠한 뒤에 돌아 낡은 경로가 한 프레임 남는다.
// 자식의 layout effect는 부모의 layout effect보다 먼저 도므로, 부모가 칠하기 전에 본 값으로 확인한다.
test('칠하기 전에 머리글에 넘기고, 내려갈 때도 칠하기 전에 비운다', () => {
  const send = vi.fn()
  const seen: number[] = []
  function Frame({ children }: { children: ReactNode }) {
    useLayoutEffect(() => {
      seen.push(send.mock.calls.length)
    })
    return children
  }
  const view = (shown: boolean) => (
    <PageTrailProvider value={send}>
      <Frame>{shown && <PageHeading trail={trail}>제목</PageHeading>}</Frame>
    </PageTrailProvider>
  )
  const { rerender } = render(view(true))
  expect(seen).toEqual([1])
  expect(send).toHaveBeenLastCalledWith(trail)
  rerender(view(false))
  expect(seen).toEqual([1, 2])
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
