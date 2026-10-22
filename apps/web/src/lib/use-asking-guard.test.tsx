// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { useAskingGuard } from './use-asking-guard'

afterEach(cleanup)

type Props = { asking: boolean; reason: 'gone' | null }
const setup = (initialProps: Props) => {
  const gone = vi.fn()
  const view = renderHook(({ asking, reason }: Props) => useAskingGuard(asking, reason, gone), {
    initialProps,
  })
  return { gone, ...view }
}

test('확인을 연 동안 막는 이유가 생기면 한 번 알린다', () => {
  const { gone, rerender } = setup({ asking: true, reason: null })
  rerender({ asking: true, reason: 'gone' })
  rerender({ asking: true, reason: 'gone' })
  expect(gone).toHaveBeenCalledExactlyOnceWith('gone')
})

test('확인이 닫혀 있으면 알리지 않는다', () => {
  const { gone, rerender } = setup({ asking: false, reason: null })
  rerender({ asking: false, reason: 'gone' })
  expect(gone).not.toHaveBeenCalled()
})

test('내 요청이 돌려준 값으로 동작이 빠진 것은 확인을 닫기 전에 렌더돼도 알리지 않는다', async () => {
  const { gone, result, rerender } = setup({ asking: true, reason: null })
  let release!: () => void
  const sent = result.current(
    () => new Promise<string>(resolve => (release = () => resolve('done'))),
    outcome => outcome === 'done',
  )
  // 값이 먼저 놓이고 확인은 나중에 닫힌다. 순서와 상관없이 알리지 않는다.
  rerender({ asking: true, reason: 'gone' })
  release()
  await sent
  rerender({ asking: true, reason: 'gone' })
  rerender({ asking: false, reason: 'gone' })
  expect(gone).not.toHaveBeenCalled()
  // 닫히면 표시가 풀려, 다음에 연 확인은 다시 지킨다.
  rerender({ asking: true, reason: 'gone' })
  expect(gone).toHaveBeenCalledOnce()
})

test('요청이 값을 바꾸지 못했으면 다시 지켜 뒤의 사라짐을 알린다', async () => {
  const { gone, result, rerender } = setup({ asking: true, reason: null })
  await result.current(
    async () => 'failed',
    outcome => outcome !== 'failed',
  )
  rerender({ asking: true, reason: 'gone' })
  expect(gone).toHaveBeenCalledOnce()
})
