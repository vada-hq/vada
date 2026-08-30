import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { randomBytes, randomUUID } from 'node:crypto'
import { createApp } from './app.ts'
import { createAuth, openWays } from './auth/auth.ts'
import { viewerLookup } from './auth/viewer.ts'
import { databaseAudit } from './audit-sink.ts'
import { readConfig } from './config.ts'
import { connect } from './db/client.ts'
import { inMemoryAttempts } from './idempotency.ts'
import { inMemoryCounter } from './public/rate-limit.ts'

// 서버를 세운다.
//
// **여기까지가 '도는 서버'다.** 오랫동안 이 파일이 없었고, 그래서 모든 것이 검사 안에서
// `app.request`로만 돌았다 — 진짜 요청을 한 번도 받아본 적이 없는 코드였다.
//
// 이 파일이 하는 일은 **잇는 것뿐**이다. 판단은 전부 다른 층에 있고 여기서 새로 정하는
// 것은 없다. 그래야 이 파일이 커지지 않는다.

const config = readConfig()
const db = connect(config.databaseUrl)
const auth = createAuth(db, {
  secret: config.authSecret,
  baseUrl: config.baseUrl,
  appUrl: config.appUrl,
  ...(config.google === undefined ? {} : { google: config.google }),
  ...(config.kakao === undefined ? {} : { kakao: config.kakao }),
})
const viewers = viewerLookup(db)

const root = new Hono()

// **로그인 자리는 계약 밖이다.** 명세에 로그인 화면이 없으므로 이 자리들은
// `openapi.json`에 없고, 그래서 권한 미들웨어보다 앞에 둔다 — 뒤에 두면
// '계약에 없는 자리'로 막힌다.
root.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))

// 어느 길로 들어올 수 있는가. 화면이 단추를 그릴지 정한다.
root.get('/api/auth-ways', (c) => c.json({ ways: openWays(config as never) }))

root.route(
  '/',
  createApp({
    audit: databaseAudit(db, { newId: () => randomUUID() }),
    db,
    async who(c) {
      // 세션은 쿠키에 있고 그 값이 표를 가리킨다. **쿠키만으로는 아무것도 아니다** —
      // 표에 없거나 만료됐으면 로그인하지 않은 것과 같다.
      const session = await auth.api.getSession({ headers: c.req.raw.headers })
      return viewers.who(session === null ? null : { userId: session.user.id })
    },
    lookups: {
      // 행사 운영 조직·회의 진행 권한자 표가 아직 없다. **없다고 답한다** —
      // 있다고 지어내면 조건부 권한이 전부 열린다.
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
    },
    // 계산이 하나뿐인 동안은 프로세스 안에 둔다. 늘리면 표로 옮겨야 한다 —
    // 그 사실을 문서가 들고 있다.
    attempts: inMemoryAttempts(),
    invite: {
      linkBase: config.inviteLinkBase,
      now: () => new Date(),
      // 추측할 수 없어야 한다. 초대 코드는 학생회에 들어오는 열쇠다.
      newCode: () => randomBytes(9).toString('base64url'),
    },
    newId: () => randomUUID(),
    // 계산이 하나인 동안은 프로세스 안에 센다. 늘리면 캐시로 옮겨야 한다.
    counter: inMemoryCounter(),
  }),
)

serve({ fetch: root.fetch, port: config.port }, (info) => {
  process.stdout.write(`vada api ${info.port}번에서 듣습니다. 들어올 길: ${openWays(config as never).join(', ')}\n`)
})
