import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import type { Deps } from '../deps.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'
import { createTestDeps, type TestDepsOptions } from './create-test-deps.ts'

let db: Db
let close: () => Promise<void>
const NOW = new Date('2026-09-01T10:00:00+09:00')

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close
}, 60_000)

afterAll(async () => { await close() })

function scenario(): TestDepsOptions {
  let made = 0
  return {
    db,
    who: async () => null,
    invite: { linkBase: 'https://example.test/join', now: () => NOW, newCode: () => 'CODE' },
    newId: () => `TEST-${++made}`,
  }
}

describe('공통 테스트 설정의 상태 경계', () => {
  it('한 앱에 기록한 중복 요청이 다른 앱의 응답이 되지 않는다', async () => {
    const first = createTestDeps(scenario())
    const second = createTestDeps(scenario())
    await first.attempts.remember('ORG-01', 'meeting.create', 'KEY', { id: 'FIRST' })
    expect(await first.attempts.find('ORG-01', 'meeting.create', 'KEY')).toEqual({ answered: { id: 'FIRST' } })
    expect(await second.attempts.find('ORG-01', 'meeting.create', 'KEY')).toBeNull()
  })

  it('한 앱이 호출 한도를 넘겨도 다른 앱의 첫 요청은 허용된다', () => {
    const first = createTestDeps(scenario())
    const second = createTestDeps(scenario())
    const window = { ms: 60_000, weight: 1 }
    expect(first.counter.add('ADDRESS', 1, window, 0).over).toBe(false)
    expect(first.counter.add('ADDRESS', 1, window, 0).over).toBe(true)
    expect(second.counter.add('ADDRESS', 1, window, 0).over).toBe(false)
  })

  it('로그인·권한 대역과 응답 헤더를 바꿔도 다른 앱이나 다음 응답에 섞이지 않는다', async () => {
    const first = createTestDeps(scenario())
    const second = createTestDeps(scenario())
    first.signIn.open = () => ({ google: false, kakao: true })
    first.lookups.isMeetingHost = async () => true
    expect(second.signIn.open()).toEqual({ google: true, kakao: false })
    for (const lookup of Object.values(second.lookups)) {
      expect(await lookup('MEMBER', 'OBJECT')).toBe(false)
    }
    const start = await first.signIn.start('google')
    expect(start.url).toBe('https://example.test/google')
    start.headers.set('set-cookie', 'first=only')
    expect((await first.signIn.start('google')).headers.get('set-cookie')).toBeNull()
    expect((await second.signIn.start('google')).headers.get('set-cookie')).toBeNull()
    const request = new Request('https://example.test/sign-out')
    const end = await first.signIn.end(request)
    end.set('set-cookie', 'first=gone')
    expect((await first.signIn.end(request)).get('set-cookie')).toBeNull()
    expect((await second.signIn.end(request)).get('set-cookie')).toBeNull()
  })

  it('명시적으로 전달한 상태 저장소와 업무 설정을 그대로 사용한다', async () => {
    const attempts = inMemoryAttempts()
    const counter = inMemoryCounter()
    const options = { ...scenario(), attempts, counter }
    const first = createTestDeps(options)
    const second = createTestDeps(options)
    await first.attempts.remember('ORG-01', 'org.create', 'KEY', 'SHARED')
    expect(await second.attempts.find('ORG-01', 'org.create', 'KEY')).toEqual({ answered: 'SHARED' })
    expect(first.counter).toBe(counter)
    expect(first.db).toBe(db)
    expect(first.invite).toBe(options.invite)
    expect(first.invite.now()).toBe(NOW)
    expect(first.newId()).toBe('TEST-1')
    expect(second.newId()).toBe('TEST-2')
  })

  it('사용자·로그인·감사 기록의 재정의가 실제 앱 요청에 적용된다', async () => {
    const written: Parameters<Deps['audit']['write']>[0][] = []
    const options = scenario()
    const signedOut = createApp(createTestDeps(options))
    const signedIn = createApp(createTestDeps({
      ...options,
      who: async () => ({ userId: 'U-OVERRIDE', membership: null }),
      signIn: {
        open: () => ({ google: false, kakao: true }),
        start: async () => ({ url: 'https://example.test/custom', headers: new Headers() }),
        end: async () => new Headers(),
      },
      audit: { async write(entry) { written.push(entry) } },
    }))
    expect((await signedOut.request('/api/shell/organization')).status).toBe(401)
    expect((await signedIn.request('/api/shell/organization')).status).toBe(403)
    expect(await (await signedIn.request('/api/sign-in/ways')).json()).toEqual({ google: false, kakao: true })
    expect(written.some(entry => entry.userId === 'U-OVERRIDE')).toBe(true)
  })
})
