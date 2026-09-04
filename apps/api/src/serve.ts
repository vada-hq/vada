import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { randomBytes, randomUUID } from 'node:crypto'
import { meetingLookups } from './meetings/lookups.ts'
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

/**
 * 로그인하고 나서 여는 화면.
 *
 * **명세가 정한 것을 서버가 든다.** SIGN-IN의 단추가 '보내고 나면 어디로 가는지'를
 * 적어 두었고(`screens/SIGN-IN/screen.json`), 제공자에게 돌아올 자리를 붙이는 것은
 * 서버뿐이므로 그 값이 여기 온다. 화면이 스스로 만들면 자기 자신을 넘기는 일이 난다.
 */
const FIRST_SCREEN = 'ONB-01'

const root = new Hono()

// **화면이 다른 주소에 있으면 브라우저가 막는다.**
//
// 웹과 api를 한 주소에 올리면 이 층이 필요 없다. 나눠 올리면 브라우저가 먼저
// 물어보고(preflight), 답이 없으면 요청이 서버에 닿지도 못한다 — 서버 로그에는
// 아무것도 안 남으므로 원인을 찾기 어렵다.
//
// **`*`를 쓰지 않는다.** 쿠키를 함께 보내는 요청에는 브라우저가 `*`를 거절하고,
// 무엇보다 아무 곳에서나 이 api를 부를 수 있게 된다. 화면이 어디 있는지는 설정이
// 이미 알고 있다(APP_URL).
root.use(
  '*',
  cors({
    origin: config.appUrl,
    credentials: true,
    allowHeaders: ['content-type', 'idempotency-key'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
)

// **제공자가 되돌려 보내는 자리만 계약 밖이다.** 구글이 부르는 주소이고 우리 화면이
// 부르는 자리가 아니라 그림에도 명세에도 없다 — 계약은 화면이 부르는 것을 담는다.
//
// 들어오는 자리 셋(어느 길이 열렸나 · 구글로 · 카카오로)은 계약 안으로 옮겼다.
// SIGN-IN에 그림이 생겼기 때문이다.
root.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))

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
      // 행사 운영 조직 표는 생겼지만 그것을 채우는 자리(EVT-01·03B)를 아직 안 지었다.
      // **없다고 답한다** — 있다고 지어내면 조건부 권한이 전부 열린다.
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      // **회의 둘은 이제 표가 답한다.**
      //
      // 한동안 여기가 거짓이었다. 표가 없던 동안은 그것이 맞았는데, 표가 생기고
      // 회의 진행을 붙인 뒤에도 그대로였다면 **배포된 서버에서 시작·종료·안건
      // 넘기기가 전부 403**이고 화면은 그 단추를 회색으로 그린다 — 검사는 전부
      // 초록인 채로. 붙이는 자리와 여는 자리가 다른 파일이라 생기는 구멍이다.
      ...meetingLookups(db),
    },
    // 계산이 하나뿐인 동안은 프로세스 안에 둔다. 늘리면 표로 옮겨야 한다 —
    // 그 사실을 문서가 들고 있다.
    attempts: inMemoryAttempts(),
    // **돌아올 자리를 여기서 붙인다.** 화면이 정하던 동안 로그인 화면이 자기 자신을
    // 넘겼고, 구글을 다녀온 사람이 제자리로 왔다. 이제 화면은 그 값을 만들지 않는다.
    signIn: {
      open: () => openWays(config as never),
      async start(provider) {
        const made = await auth.api.signInSocial({
          body: { provider, callbackURL: `${config.appUrl}/#/${FIRST_SCREEN}` },
        })
        if (typeof made.url !== 'string') {
          throw new Error(`'${provider}'로 가는 주소를 받지 못했습니다.`)
        }
        return { url: made.url }
      },
    },
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
  process.stdout.write(`vada api ${info.port}번에서 듣습니다. 들어올 길: ${Object.entries(openWays(config as never))
      .filter(([, open]) => open)
      .map(([name]) => name)
      .join(', ') || '없음'}\n`)
})
