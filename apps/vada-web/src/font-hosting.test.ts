import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('../', import.meta.url)

describe('Pretendard 배포 자산', () => {
  it('외부 CDN 없이 같은 주소에서 글꼴을 받는다', () => {
    const html = readFileSync(new URL('index.html', root), 'utf8')
    const headers = readFileSync(new URL('public/_headers', root), 'utf8')

    expect(html).toContain('href="/fonts/pretendard/pretendardvariable-dynamic-subset.css"')
    expect(html).not.toContain('cdn.jsdelivr.net')
    expect(headers).not.toContain('cdn.jsdelivr.net')
  })

  it('고정한 v1.3.9 동적 서브셋과 라이선스를 빠짐없이 배포한다', () => {
    const fontRoot = new URL('public/fonts/pretendard/', root)
    const css = readFileSync(new URL('pretendardvariable-dynamic-subset.css', fontRoot), 'utf8')
    const files = [...css.matchAll(/url\(([^)]+\.woff2)\)/g)].map((match) => match[1])

    expect(files).toHaveLength(92)
    expect(new Set(files).size).toBe(files.length)
    expect(files.every((file) => existsSync(new URL(file, fontRoot)))).toBe(true)
    expect(existsSync(new URL('LICENSE', fontRoot))).toBe(true)
    expect(readFileSync(new URL('README.md', fontRoot), 'utf8')).toContain(
      'github.com/orioncactus/pretendard/tree/v1.3.9/',
    )
  })
})
