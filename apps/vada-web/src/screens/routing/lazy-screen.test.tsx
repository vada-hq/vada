import { Suspense, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { lazyScreen } from './lazy-screen'
import { ScreenCodeBoundary } from './ScreenCodeBoundary'
import { ErrorBoundary } from '../../components/ErrorBoundary'

afterEach(() => vi.restoreAllMocks())

function Sample({ variant }: { variant: string }) {
  const [value, setValue] = useState('')
  return <input aria-label={variant} value={value} onChange={(event) => setValue(event.target.value)} />
}

it('처음 그릴 때만 파일을 받고, 로딩 후 변형을 바꿔도 입력을 유지한다', async () => {
  let finish!: (component: typeof Sample) => void
  const load = vi.fn(() => new Promise<typeof Sample>((resolve) => { finish = resolve }))
  const Lazy = lazyScreen(load)
  expect(load).not.toHaveBeenCalled()
  const view = (variant: string) => (
    <ScreenCodeBoundary screenId={variant}>
      <Suspense fallback={<div role="status">화면 파일 로딩</div>}>
        <Lazy variant={variant} />
      </Suspense>
    </ScreenCodeBoundary>
  )
  const { rerender } = render(view('처음'))
  expect(screen.getByRole('status')).toHaveTextContent('화면 파일 로딩')
  expect(load).toHaveBeenCalledTimes(1)
  await act(async () => finish(Sample))
  const input = screen.getByRole('textbox', { name: '처음' })
  fireEvent.change(input, { target: { value: '입력한 초안' } })
  rerender(view('변형'))
  expect(screen.getByRole('textbox', { name: '변형' })).toBe(input)
  expect(input).toHaveValue('입력한 초안')
  expect(load).toHaveBeenCalledTimes(1)
})

it('파일 로딩 실패에는 새로고침 안내를 보여주며, 다른 화면으로 이동할 수 있다', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const Failed = lazyScreen(async () => { throw new TypeError('Failed to fetch dynamically imported module') })
  const { rerender } = render(
    <ScreenCodeBoundary screenId="실패한 화면">
      <Suspense fallback={<div role="status">로딩</div>}><Failed /></Suspense>
    </ScreenCodeBoundary>,
  )
  expect(await screen.findByRole('alert')).toHaveTextContent('화면을 불러오지 못했습니다')
  expect(screen.getByRole('button', { name: '새로고침' })).toBeEnabled()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  rerender(<ScreenCodeBoundary screenId="다른 화면"><Sample variant="이동 성공" /></ScreenCodeBoundary>)
  expect(screen.getByRole('textbox', { name: '이동 성공' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('화면의 실제 렌더 오류는 파일 로딩 오류로 바꾸지 않는다', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  function Broken(): never { throw new Error('화면 내부 오류') }
  render(
    <ErrorBoundary screenId="고장">
      <ScreenCodeBoundary screenId="고장"><Broken /></ScreenCodeBoundary>
    </ErrorBoundary>,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('화면 내부 오류')
  expect(screen.queryByRole('button', { name: '새로고침' })).not.toBeInTheDocument()
})
