import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

// jsdom은 줄바꿈을 계산하지 않아, 전역 규칙이 바탕 글에 들어 있는지만 본다. 실제 효과는 390 스크린샷으로 본다.
// vitest는 CSS의 ?raw 가져오기를 빈 글로 바꾸므로 파일을 직접 읽는다.
test('바탕 글은 한글을 낱말 단위로 줄바꿈하고 띄어쓰기 없는 긴 글은 끊는다', () => {
  const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8')
  const body = /\n\s{2}body \{([^}]*)\}/.exec(css)?.[1] ?? ''
  expect(body).toMatch(/\bbg-background\b/)
  expect(body).toMatch(/\bbreak-keep\b/)
  expect(body).toMatch(/\bwrap-break-word\b/)
})
