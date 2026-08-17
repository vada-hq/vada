import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// globals: false에서는 testing-library의 자동 cleanup이 등록되지 않는다.
afterEach(() => {
  cleanup()
})

// jsdom에는 scrollIntoView가 없다.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
