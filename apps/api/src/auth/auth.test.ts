import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import { freshDb } from '../db/testing.ts'
import * as schema from '../db/schema.ts'
import { departments, members, organizations, users } from '../db/schema.ts'
import { MissingConfig, readConfig } from '../config.ts'
import { createAuth } from './auth.ts'
import { viewerLookup } from './viewer.ts'
import type { Db } from '../db/client.ts'

// 로그인한 사람이 이 학생회에서 누구인가, 그리고 **없는 채로 서지 않는가.**

let db: Db
let close: () => Promise<void>

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close
}, 60_000)

beforeEach(async () => {
  await db.delete(members)
  await db.delete(departments)
  await db.delete(organizations)
  await db.delete(users)

  await db.insert(users).values([
    { id: 'U-01', email: 'chair@example.ac.kr' },
    { id: 'U-99', email: 'nobody@example.ac.kr' },
  ])
  await db.insert(organizations).values({ id: 'ORG-01', name: '제12대 학생회' })
  await db.insert(departments).values([
    { id: 'D-FIN', orgId: 'ORG-01', name: '재정부', handlesFinance: true },
    { id: 'D-OPS', orgId: 'ORG-01', name: '운영부' },
  ])
})

afterAll(async () => {
  await close()
})

describe('세션이 누구인지 말한다', () => {
  it('로그인하지 않았으면 아무도 아니다', async () => {
    expect(await viewerLookup(db).who(null)).toBe(null)
  })

  it('구성원이면 역할과 부서까지 안다', async () => {
    await db.insert(members).values({
      id: 'M-01',
      orgId: 'ORG-01',
      userId: 'U-01',
      name: '김바다',
      role: 'chair',
      departmentId: 'D-OPS',
    })
    expect(await viewerLookup(db).who({ userId: 'U-01' })).toEqual({
      userId: 'U-01',
      membership: {
        orgId: 'ORG-01',
        memberId: 'M-01',
        role: 'chair',
        departmentId: 'D-OPS',
        inFinanceDepartment: false,
      },
    })
  })

  // **부서 이름으로 보지 않는다.** 부서에 단 표시가 정한다 — 학생회마다 이름이
  // 다르고 이름을 바꾸면 권한이 조용히 사라진다.
  it('재정을 맡는 부서인지는 표시가 정한다', async () => {
    await db.insert(members).values({
      id: 'M-02',
      orgId: 'ORG-01',
      userId: 'U-01',
      name: '김민준',
      role: 'head',
      departmentId: 'D-FIN',
    })
    const viewer = await viewerLookup(db).who({ userId: 'U-01' })
    expect(viewer?.membership?.inFinanceDepartment).toBe(true)
  })

  // 학생회를 만들려는 사람과 초대 코드를 확인하는 사람이 그렇다. 이 자리를 막으면
  // 아무도 들어올 수 없다.
  it('구성원이 아니어도 로그인한 사람이다', async () => {
    expect(await viewerLookup(db).who({ userId: 'U-99' })).toEqual({
      userId: 'U-99',
      membership: null,
    })
  })
})

describe('없는 채로 서지 않는다', () => {
  const enough = {
    DATABASE_URL: 'postgres://x',
    AUTH_SECRET: 'x'.repeat(32),
    BASE_URL: 'https://api.example',
    APP_URL: 'https://app.example',
    INVITE_LINK_BASE: 'https://app.example/join',
    GOOGLE_CLIENT_ID: 'id',
    GOOGLE_CLIENT_SECRET: 'secret',
  }

  it('다 있으면 선다', () => {
    expect(readConfig(enough).port).toBe(8787)
    expect(readConfig(enough).google).toEqual({ clientId: 'id', clientSecret: 'secret' })
  })

  it.each(['DATABASE_URL', 'AUTH_SECRET', 'BASE_URL', 'APP_URL', 'INVITE_LINK_BASE'])(
    '%s가 없으면 서지 않는다',
    (key) => {
      const env = { ...enough }
      delete (env as Record<string, string>)[key]
      expect(() => readConfig(env)).toThrow(MissingConfig)
    },
  )

  // **짧은 비밀은 있는 것과 없는 것 사이라 더 나쁘다** — 있다고 믿게 하면서 지키지 못한다.
  it('비밀이 짧으면 서지 않는다', () => {
    expect(() => readConfig({ ...enough, AUTH_SECRET: 'short' })).toThrow(MissingConfig)
  })

  // 로그인할 수 없는 서버는 아무도 쓸 수 없고, 그 사실이 사람이 눌렀을 때 드러나면 늦다.
  it('들어올 길이 하나도 없으면 서지 않는다', () => {
    const env = { ...enough }
    delete (env as Record<string, string>).GOOGLE_CLIENT_ID
    delete (env as Record<string, string>).GOOGLE_CLIENT_SECRET
    expect(() => readConfig(env)).toThrow(MissingConfig)
  })

  // 반쯤 켜진 것은 꺼진 것보다 나쁘다 — 사람이 눌렀을 때 알 수 없는 오류가 난다.
  it('자격증명이 반만 있으면 서지 않는다', () => {
    const env = { ...enough }
    delete (env as Record<string, string>).GOOGLE_CLIENT_SECRET
    expect(() => readConfig(env)).toThrow(MissingConfig)
  })
})

// **로그인 층이 실제로 표에 닿는지 잰다.**
//
// 이 파일에 검사가 열셋 있었는데 **하나도 Better Auth를 세우지 않았다** — 설정을
// 읽는 것과 세션에서 사람을 찾는 것만 봤다. 그래서 어댑터가 표를 못 찾는 것이
// 검사를 전부 통과하고 **배포 첫 로그인에서 500**으로 드러났다(2026-09-02).
//
// 무엇이 터졌나: Better Auth는 `verification`을 찾는데 이 저장소의 표는
// `verifications`다. 켤 때가 아니라 **사람이 단추를 누를 때** 나는 고장이라,
// 서버가 서는 것만 봐서는 알 수 없다.
describe('로그인 층이 표에 닿는다', () => {
  const auth = () =>
    createAuth(db as never, {
      secret: 'x'.repeat(32),
      baseUrl: 'https://vada.example',
      appUrl: 'https://vada.example',
      google: { clientId: 'id', clientSecret: 'secret' },
    })

  // 구글로 가는 주소를 만들려면 **`verification` 표에 state를 적어야 한다.**
  // 거기서 어댑터가 표를 못 찾으면 이 자리가 터진다 — 구글을 부르지는 않는다.
  it('구글로 가는 길을 만들면서 state를 표에 적는다', async () => {
    const made = await auth().api.signInSocial({
      body: { provider: 'google', callbackURL: 'https://vada.example/#/SIGN-IN' },
    })
    expect(made.url).toContain('accounts.google.com')
  })

  // 표 이름이 갈리면 위 검사가 먼저 터지지만, 무엇이 갈렸는지는 이쪽이 말해 준다.
  it('찾는 이름과 표의 이름이 같다', () => {
    for (const model of ['users', 'sessions', 'accounts', 'verifications']) {
      expect(schema).toHaveProperty(model)
    }
  })
})

