import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  koreanDateOf,
  type CreateCouncilResponse,
  type InviteCodeResponse,
  type MessagePageResponse,
  type RoomListResponse,
  type TeamResponse,
} from '@vada/contracts'
import { appModulesOf } from '../app-modules.js'
import { createApp } from '../app.js'
import { createAuth } from '../auth/auth.js'
import { createTestDb } from '../db/test-db.js'
import { createPurchaseWriteLimiter } from '../purchases/write-limit.js'
import { fakeGoogleLogin } from '../test-support/google-login.js'

const YEAR_LENGTH = 4

// 실제 better-auth 로그인으로 본다: 탈퇴한 뒤 그 쿠키는 401이고, 같은 Google 계정으로 다시 로그인하면 새 계정이다(DEC-64).
test('탈퇴한 뒤 같은 Google 계정으로 다시 로그인하면 학생회 없는 새 계정이고, 초대로 들어오면 새 운영진이다', async t => {
  const { pg, db, close } = await createTestDb()
  const baseURL = 'http://127.0.0.1:5180'
  try {
    const auth = createAuth(db, {
      secret: 'local-test-only-secret-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      baseURL,
      googleClientId: 'test-client',
      googleClientSecret: 'test-secret',
    })
    // 세션을 만든 시각은 better-auth가 실제 시계로 적는다. 탈퇴의 24시간 검사가 같은 시계를 쓰게 앱의 시계도 실제 시계다.
    const clock = () => new Date()
    const modules = appModulesOf(db, headers => auth.api.getSession({ headers }), {
      clock,
      writeLimiter: createPurchaseWriteLimiter(),
      receiptKey: 'test-receipt-key',
    })
    const app = createApp({ auth, trustedOrigin: baseURL, ...modules })
    const request = (path: string, init?: RequestInit) => app.request(`${baseURL}${path}`, init)
    const get = (path: string, cookie: string) => request(path, { headers: { Cookie: cookie } })
    const post = (path: string, cookie: string, body: unknown = {}) =>
      request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: baseURL, Cookie: cookie },
        body: JSON.stringify(body),
      })
    const read = async <T>(response: Response | Promise<Response>) => {
      const done = await response
      assert.ok(done.ok, await done.clone().text())
      return (await done.json()) as T
    }
    const googleLogin = fakeGoogleLogin(t, baseURL, request)
    const userIdOf = async (cookie: string) =>
      (await read<{ user: { id: string } } | null>(get('/api/auth/get-session', cookie)))?.user
        .id ?? null

    const chief = await googleLogin({ sub: 'sub-chief', email: 'chief@example.test', name: '회장' })
    const { council } = await read<CreateCouncilResponse>(
      post('/api/organizations/create', chief.cookie, {
        name: '컴퓨터학부 학생회',
        unit: 'department',
        schoolName: '한양대학교 ERICA',
        year: Number(koreanDateOf(clock()).slice(0, YEAR_LENGTH)),
      }),
    )
    const org = `/api/organizations/${council.id}`
    const { code } = await read<InviteCodeResponse>(get(`${org}/invite`, chief.cookie))
    const profile = { sub: 'sub-member', email: 'member@example.test', name: '부원' }
    const first = await googleLogin(profile)
    const firstUserId = await userIdOf(first.cookie)
    assert.equal((await post('/api/organizations/join', first.cookie, { code })).status, 200)
    const rooms = await read<RoomListResponse>(get(`${org}/rooms`, first.cookie))
    const all = rooms.rooms.find(room => room.type === 'all_members')!.id
    await read(post(`${org}/rooms/${all}/messages`, first.cookie, { body: '먼저 쓴 글' }))

    const withdrawn = await post('/api/me/withdrawal', first.cookie)
    assert.equal(withdrawn.status, 200)
    assert.ok(withdrawn.headers.getSetCookie().some(item => /Max-Age=0/i.test(item)))
    assert.equal(await userIdOf(first.cookie), null)
    assert.equal((await get('/api/me/councils', first.cookie)).status, 401)

    const again = await googleLogin(profile)
    const againUserId = await userIdOf(again.cookie)
    assert.ok(againUserId && againUserId !== firstUserId, '다시 로그인하면 새 계정이다')
    const mine = await read<{ councils: unknown[] }>(get('/api/me/councils', again.cookie))
    assert.deepEqual(mine.councils, [])
    assert.equal((await post('/api/organizations/join', again.cookie, { code })).status, 200)
    const team = await read<TeamResponse>(get(`${org}/members`, chief.cookie))
    assert.deepEqual(team.members.map(member => member.name).sort(), ['부원', '회장'])
    // 이전 계정의 글은 '떠난 운영진 1'로 남고 새 운영진과 잇지 않는다.
    const page = await read<MessagePageResponse>(get(`${org}/rooms/${all}/messages`, chief.cookie))
    const earlier = page.messages.find(message => message.body === '먼저 쓴 글')
    assert.equal(earlier?.senderName, '떠난 운영진 1')
    const newMember = team.members.find(member => member.name === '부원')
    assert.notEqual(earlier?.senderId, newMember?.id)
    const { rows } = await pg.query('SELECT 1 FROM users WHERE id = $1', [firstUserId])
    assert.equal(rows.length, 0)
  } finally {
    await close()
  }
})
