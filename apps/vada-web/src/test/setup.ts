import { afterEach } from 'vitest'

// setupFiles는 모든 테스트 파일에 걸린다. DOM을 쓰지 않는 테스트는
// `// @vitest-environment node`로 jsdom을 띄우지 않으므로, 여기서 DOM 도구를
// 최상위에서 import하면 그쪽이 `Element is not defined`로 죽는다.
const hasDom = typeof document !== 'undefined'

if (hasDom) {
  await import('@testing-library/jest-dom/vitest')

  // globals: false에서는 testing-library의 자동 cleanup이 등록되지 않는다.
  const { cleanup } = await import('@testing-library/react')
  afterEach(() => {
    cleanup()
  })

  // jsdom에는 scrollIntoView가 없다.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
}
