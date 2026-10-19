import { afterEach } from 'vitest'
import { configure } from '@testing-library/react'

// 파일을 병렬로 돌리면(npm test, CI) 첫 화면이 기본 대기 1초를 넘길 때가 있다. findBy·waitFor의 상한을 테스트 제한 시간 안에서 늘린다.
configure({ asyncUtilTimeout: 5_000 })

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
  const found = keyWarnings.splice(0)
  if (found.length) throw new Error(`React 키 경고: ${found.join(' / ')}`)
})
