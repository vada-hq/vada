// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useGalleryParam } from './use-gallery-param'

afterEach(() => {
  cleanup()
  history.replaceState(null, '', '/ui.html')
})

test('변형 값은 주소에서 읽고 없는 값은 기본값을 쓴다', () => {
  history.replaceState(null, '', '/ui.html?section=업무&frame=dialog')
  const { result } = renderHook(() => ({
    frame: useGalleryParam('frame', 'panel'),
    results: useGalleryParam('results', 'inline'),
  }))
  expect(result.current.frame[0]).toBe('dialog')
  expect(result.current.results[0]).toBe('inline')
})

test('고르기를 바꾸면 현재 주소를 갱신하고 새로 열어도 같은 변형을 쓴다', () => {
  const params = new URLSearchParams({
    section: '업무 상세 시안',
    frame: 'panel',
    results: 'inline',
  })
  history.replaceState({ sample: true }, '', `/ui.html?${params}#preview`)
  const length = history.length
  const { result, unmount } = renderHook(() => ({
    frame: useGalleryParam('frame', 'panel'),
    results: useGalleryParam('results', 'inline'),
  }))
  act(() => result.current.frame[1]('dialog'))
  act(() => result.current.results[1]('별도 카드 & 링크'))
  expect(result.current.frame[0]).toBe('dialog')
  expect(result.current.results[0]).toBe('별도 카드 & 링크')
  expect(Object.fromEntries(new URLSearchParams(location.search))).toEqual({
    section: '업무 상세 시안',
    frame: 'dialog',
    results: '별도 카드 & 링크',
  })
  expect(location.hash).toBe('#preview')
  expect(history.state).toEqual({ sample: true })
  expect(history.length).toBe(length)
  unmount()
  const reopened = renderHook(() => useGalleryParam('frame', 'panel'))
  expect(reopened.result.current[0]).toBe('dialog')
})
