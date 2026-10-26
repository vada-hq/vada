import { afterEach } from 'vitest'
import { configure } from '@testing-library/react'
import { resetDrafts } from '@/chat/composer-drafts'

// 파일을 병렬로 돌리면(pnpm test, CI) 첫 화면이 기본 대기 1초를 넘길 때가 있다. findBy·waitFor의 상한을 테스트 제한 시간 안에서 늘린다.
configure({ asyncUtilTimeout: 5_000 })

// jsdom은 크기를 재지 않는다. Radix 라디오의 폼 연결용 숨은 입력이 쓰는 브라우저 API만 제공한다.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// React의 키 경고(형제끼리 같은 키, 목록에 키 없음)는 화면 테스트를 실패시킨다.
// 키가 겹치면 부품 상태가 섞일 수 있는데, 경고는 콘솔에만 남아 테스트가 통과해 버린다(2026-10-10 예산 마감 묶음).
const keyWarnings: string[] = []
const consoleError = console.error.bind(console)
console.error = (...args: unknown[]) => {
  const message = String(args[0])
  if (
    message.includes('Encountered two children with the same key') ||
    message.includes('should have a unique "key" prop')
  )
    keyWarnings.push(message)
  consoleError(...args)
}
afterEach(() => {
  // 보내지 않은 글(메모리)이 다음 시험의 입력칸에 남지 않게 한다.
  resetDrafts()
  // 이 기기가 마지막에 본 주소(lib/last-address.ts)가 다음 시험의 '/' 시작을 바꾸지 않게 한다. node 환경 시험에는 window가 없다.
  if (typeof window !== 'undefined') {
    window.localStorage.clear()
    window.sessionStorage.clear()
  }
  const found = keyWarnings.splice(0)
  if (found.length) throw new Error(`React 키 경고: ${found.join(' / ')}`)
})
