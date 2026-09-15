import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('../', import.meta.url)

describe('정적 자산 캐시 정책', () => {
  it('내용 해시가 붙은 빌드 자산을 장기 캐시한다', () => {
    const headers = readFileSync(new URL('public/_headers', root), 'utf8')

    for (const extension of ['js', 'css', 'svg', 'png']) {
      expect(headers).toContain(
        `/assets/*.${extension}\n  Cache-Control: public, max-age=31536000, immutable`,
      )
    }
    expect(headers).not.toContain('/assets/*\n  Cache-Control:')
  })

  it('버전이 경로에 포함된 글꼴만 장기 캐시한다', () => {
    const html = readFileSync(new URL('index.html', root), 'utf8')
    const headers = readFileSync(new URL('public/_headers', root), 'utf8')

    expect(html).toContain(
      'href="/fonts/pretendard/1.3.9/pretendardvariable-dynamic-subset.css"',
    )
    expect(headers).toMatch(
      /\/fonts\/pretendard\/1\.3\.9\/\*\s+Cache-Control: public, max-age=31536000, immutable/,
    )
  })
})
