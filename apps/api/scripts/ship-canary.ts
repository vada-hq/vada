import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from '../src/app.ts'
import {
  departments,
  events,
  meetings,
  members,
  organizations,
  students,
  tasks,
  users,
} from '../src/db/schema.ts'
import { freshDb } from '../src/db/testing.ts'
import { inMemoryAttempts } from '../src/idempotency.ts'
import { meetingLookups } from '../src/meetings/lookups.ts'
import { inMemoryCounter } from '../src/public/rate-limit.ts'

// 카나리가 여는 세상. 까닭은 `ship-canary-server.mjs`에 있다.
//
// **학생회를 둘 둔다.** 하나만 두면 '남의 것이 안 보인다'를 잴 수가 없다 — 안 보이는
// 것이 울타리 덕인지 애초에 없어서인지 갈리지 않는다.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DIST = join(ROOT, 'apps', 'vada-web', 'dist')
const NOW = new Date('2026-09-05T09:00:00+09:00')

/**
 * 이 값들이 화면에 보여야 한다(A) / 한 글자도 안 보여야 한다(B).
 *
 * **둘이 같은 모양이라야 한다.** A는 흔한 말이고 B는 이상한 말이면, B가 안 보이는
 * 것이 울타리 덕인지 그냥 그런 말이 없어서인지 모른다.
 */
export const MINE = {
  org: '카나리 학생회',
  event: '카나리 봄 축제',
  meeting: '카나리 정기회의',
  task: '카나리 포스터 시안',
  member: '카나리김',
}
export const THEIRS = {
  org: '옆집 학생회',
  event: '옆집 봄 축제',
  meeting: '옆집 정기회의',
  task: '옆집 포스터 시안',
  member: '옆집김',
}

async function seed() {
  const fresh = await freshDb()
  const db = fresh.db

  await db.insert(organizations).values([
    { id: 'ORG-A', name: MINE.org, term: '2026' },
    { id: 'ORG-B', name: THEIRS.org, term: '2026' },
  ])
  await db.insert(departments).values([
    { id: 'D-A', orgId: 'ORG-A', name: '기획부' },
    { id: 'D-B', orgId: 'ORG-B', name: '기획부' },
  ])
  await db.insert(users).values({ id: 'U-A', email: 'canary@example.ac.kr' })
  await db.insert(members).values([
    { id: 'M-A', orgId: 'ORG-A', name: MINE.member, role: 'chair', departmentId: 'D-A', userId: 'U-A' },
    { id: 'M-B', orgId: 'ORG-B', name: THEIRS.member, role: 'chair', departmentId: 'D-B' },
  ])
  await db.insert(students).values([
    { id: 'S-A', orgId: 'ORG-A', name: MINE.member, studentNumber: '2026000001', duesStatus: 'paid' },
    { id: 'S-B', orgId: 'ORG-B', name: THEIRS.member, studentNumber: '2026000002', duesStatus: 'paid' },
  ])
  await db.insert(events).values([
    { id: 'E-A', orgId: 'ORG-A', title: MINE.event, status: 'planning', updatedAt: NOW },
    { id: 'E-B', orgId: 'ORG-B', title: THEIRS.event, status: 'planning', updatedAt: NOW },
  ])
  await db.insert(meetings).values([
    { id: 'MTG-A', orgId: 'ORG-A', title: MINE.meeting, status: 'scheduled', scheduledAt: NOW, creatorMemberId: 'M-A' },
    { id: 'MTG-B', orgId: 'ORG-B', title: THEIRS.meeting, status: 'scheduled', scheduledAt: NOW, creatorMemberId: 'M-B' },
  ])
  await db.insert(tasks).values([
    { id: 'T-A', orgId: 'ORG-A', title: MINE.task, status: 'planned', departmentId: 'D-A', assigneeMemberId: 'M-A' },
    { id: 'T-B', orgId: 'ORG-B', title: THEIRS.task, status: 'planned', departmentId: 'D-B', assigneeMemberId: 'M-B' },
  ])
  return db
}

const db = await seed()

const api = createApp({
  audit: { async write() {} },
  db: db as never,
  // **신원은 고정이다.** 구글을 다녀오는 길은 `serve.ts`가 붙이고 여기서는 그 자리에
  // 사람을 하나 놓는다 — 이 카나리가 아직 안 재는 것이 그것이다.
  who: async () => ({
    userId: 'U-A',
    membership: {
      orgId: 'ORG-A',
      memberId: 'M-A',
      role: 'chair',
      departmentId: 'D-A',
      inFinanceDepartment: false,
    },
  }),
  lookups: {
    isEventStaff: async () => false,
    isEventStaffManager: async () => false,
    ...meetingLookups(db as never),
  },
  signIn: {
    open: () => ({ google: true, kakao: false }),
    start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
  },
  attempts: inMemoryAttempts(),
  counter: inMemoryCounter(),
  invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CANARY01' },
  newId: () => `X-${Math.random().toString(36).slice(2, 10)}`,
})

// **같은 자리에서 준다.** 나가는 묶음은 api 주소를 안 물고 있어서(상대 경로) 화면과
// api가 같은 곳에 있어야 사람이 여는 그대로가 된다.
const app = new Hono()
const index = readFileSync(join(DIST, 'index.html'), 'utf8')
// **api를 먼저 가르고 나머지를 화면으로 준다.** 통째로 이어 붙이면 api의 권한
// 미들웨어가 첫 장까지 잡아 403을 낸다 — 계약에 없는 주소이기 때문이다.
app.all('/api/*', (c) => api.fetch(c.req.raw))
app.use('/assets/*', serveStatic({ root: './apps/vada-web/dist' }))
// 주소는 해시가 든다(`/#/HOME-01K`). 나머지는 전부 첫 장이다.
app.get('*', (c) => c.html(index))

const port = Number(process.env.CANARY_PORT ?? 4180)
serve({ fetch: app.fetch, port }, () => {
  console.log(`[카나리] 나가는 묶음을 http://localhost:${port} 에서 연다`)
})
