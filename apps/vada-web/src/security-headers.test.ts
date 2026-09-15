import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const headers = () => readFileSync(new URL('../public/_headers', import.meta.url), 'utf8')

describe('배포된 정적 자산의 보안 헤더', () => {
  it('모든 화면을 프레임·MIME 추측·불필요한 브라우저 권한에서 지킨다', () => {
    const configured = headers()
    expect(configured).toContain('/*')
    expect(configured).toContain('X-Frame-Options: DENY')
    expect(configured).toContain('X-Content-Type-Options: nosniff')
    expect(configured).toContain('Referrer-Policy: no-referrer')
    expect(configured).toContain('Permissions-Policy: camera=(), microphone=(), geolocation=()')
    expect(configured).toContain('Strict-Transport-Security: max-age=31536000')
  })

  it('실행할 코드와 연결할 서버를 허용 목록으로 제한한다', () => {
    const configured = headers()
    expect(configured).toContain("default-src 'self'")
    expect(configured).toContain("script-src 'self'")
    expect(configured).toContain("connect-src 'self'")
    expect(configured).toContain("frame-ancestors 'none'")
    expect(configured).toContain("object-src 'none'")
  })
})
