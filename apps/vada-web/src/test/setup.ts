import { afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'

// 이 파일은 dom 프로젝트(.tsx 테스트)에서만 돌므로 DOM이 항상 있다.
// 동적 import로 미루지 않는다 — setupFiles에서 await 뒤에 훅을 걸면
// vitest가 수집 문맥을 이미 닫아 간헐적으로 죽는다.

// globals: false에서는 testing-library의 자동 cleanup이 등록되지 않는다.
afterEach(() => {
  cleanup()
})

// jsdom에는 scrollIntoView가 없다.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
