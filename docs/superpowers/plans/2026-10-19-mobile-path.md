# 휴대폰 길 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영진이 카톡 단톡방 링크를 누른 순간부터 첫 휴대폰 알림을 받기까지의 길(바깥 브라우저, 로그인, 홈 화면, 알림 켜기, 시험 알림)을 지금 vada 위에 만들어, 실제 아이폰과 갤럭시로 확인할 수 있게 한다.

**Architecture:** 표와 마이그레이션을 쓰지 않는다. 서버는 새 모듈 `apps/api/src/push/`(열쇠 설정, 알림 서버 거르기, 보내기, 경로 둘)를 두고 `/api/me/*`에 공통 가드를 건다. 화면은 `apps/web/public/`(manifest, 아이콘, 서비스 워커), `src/auth/`(카톡 안 로그인, 홈 화면 앱 안 로그인), `src/push/`(상태 계산, 브라우저 감싸기, 대화상자)를 둔다. 알림 받을 기기는 저장하지 않고, 시험 알림을 보낼 때만 구독을 받아 쓰고 버린다.

**Tech Stack:** Hono, better-auth 1.7.6, web-push 3.6.7, zod 계약 패키지 `@vada/contracts`, React 19, Tailwind, Vite(`public` 폴더), vitest + testing-library, node:test(tsx).

**Spec:** `docs/superpowers/specs/2026-10-19-mobile-path-design.md` (다시 만들기 전체: `docs/superpowers/specs/2026-10-19-rebuild-design.md`)

## Global Constraints

- 표, 마이그레이션, DB를 바꾸지 않는다. 알림 받을 기기(구독)를 저장하지 않는다.
- 새 의존성은 둘뿐이고 정확한 판으로 고정한다: `web-push` 3.6.7(api 의존성), `@types/web-push` 3.6.4(api 개발 의존성).
- 알림 열쇠 환경 변수는 `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`(`mailto:` 또는 `https:`)다. 셋이 모두 있거나 모두 없어야 한다. 모두 없으면 알림 경로를 만들지 않는다.
- 알림 서버 허용 목록: `fcm.googleapis.com`, `web.push.apple.com`, `updates.push.services.mozilla.com`, `.notify.windows.com`으로 끝나는 호스트. `https:`, 기본 포트, 사용자 정보 없음.
- 시험 알림: 5000ms 기다린 뒤 한 번 보낸다. 내용 `{ title: 'VADA', body: '시험 알림이에요. 누르면 VADA가 열려요.', url: '/' }`, `TTL` 60, `urgency` `'high'`, `timeout` 10000. 알림 서버가 404·410이면 `expired`, 그 밖의 실패는 `rejected`.
- 경로는 `GET /api/me/push`, `POST /api/me/push/test`다. `json()`을 인증보다 앞에 둔다.
- 알림 구독 주소(endpoint)와 요청 본문은 로그와 응답에 넣지 않는다. 결과의 종류만 남긴다.
- manifest: `id`·`start_url`·`scope` `/`, `name`·`short_name` `VADA`, `display` `standalone`, `lang` `ko`, `theme_color` `#155dfc`(`--primary`), `background_color` `#ffffff`, 아이콘 192·512·마스크용 512.
- 화면 규칙(AGENTS.md): `components/ui` 부품만 쓰고, Tailwind 표준 스케일과 테마 토큰만 쓴다. 긴 글에는 `wrap-anywhere`를 준다. 새 화면 모양은 `/ui.html`에 더한다.
- 화면 문구는 이 계획의 코드에 적힌 그대로 쓴다(spec과 같다).
- 카톡 안 로그인 화면과 휴대폰 알림 대화상자는 와이어프레임(Figma)에 같은 화면이 없다. Figma 비교 대신 `/ui.html`과 휴대폰 폭(390px)에서 눈으로 확인한다.
- 커밋: 작업마다 로컬에만 커밋한다. 제목은 50자 이내 명령형 한국어이고, AI 서명·Co-Authored-By를 붙이지 않는다. push(곧 Render 배포)는 사용자가 반영하라고 할 때만 한다.
- `.env`는 읽거나 출력하지 않는다.
- 이 PC에서 API 테스트 여러 파일은 `--test-concurrency=2`로 돌린다.

## Review Focus

- 시험 알림을 기다리는 5초 동안 화면을 끄면 iOS가 요청을 끊을 수 있다 → "시험 알림을 보내지 못했어요" 대신 "결과를 받지 못했어요. 알림이 왔다면 잘 된 거예요."가 보여야 한다 → Task 7 `PushSettings.test.tsx`에 고정한다.
- 서비스 워커가 준비되지 않으면(사생활 보호 모드, 등록 실패) `navigator.serviceWorker.ready`가 끝나지 않는다 → 10초 뒤 "알림 설정을 불러오지 못했어요."와 [다시 시도]가 보여야 한다 → Task 7 `push-client.test.ts`(시간 제한)와 `PushSettings.test.tsx`(다시 시도)에 고정한다.
- 허락 창을 닫아 `subscribe`가 실패한다 → 화면이 멈추지 않고 "알림을 켜지 못했어요. 다시 눌러 주세요."와 [알림 켜기]가 남아야 한다 → Task 7에 고정한다.
- 시험 알림 버튼을 연달아 누른다 → 보내는 동안 버튼을 막고 요청은 한 번만 가야 한다 → Task 7에 고정한다.
- 서버 열쇠가 바뀐 뒤 남은 옛 구독 → '켜기 전'으로 보이고, 켜면 옛 구독을 지운 뒤 새로 구독해야 한다 → Task 7에 고정한다.

---

### Task 1: 계약 — 알림 구독 스키마와 응답 타입

**Files:**
- Create: `packages/contracts/src/push.ts`
- Create: `packages/contracts/src/push.test.ts`
- Modify: `packages/contracts/src/index.ts` (내보내기 한 줄)
- Modify: `packages/contracts/package.json` (`test` 스크립트 끝에 `src/push.test.ts`)

**Interfaces:**
- Produces:
  - `PUSH_ENDPOINT_MAX = 1024`
  - `PushSubscriptionSchema`: `z.strictObject({ endpoint: string(https 주소, 1024자 이하), expirationTime?: number | null, keys: { p256dh: string(200 이하), auth: string(100 이하) } })`
  - `type PushSubscriptionRequest = z.infer<typeof PushSubscriptionSchema>`
  - `PUSH_TEST_RESULTS = ['sent', 'expired', 'rejected'] as const`, `type PushTestResult`
  - `type PushKeyResponse = { publicKey: string }`, `type PushTestResponse = { result: PushTestResult }`

- [ ] **Step 0: 의존성을 다시 설치하고 출발점을 확인한다**

루트 `node_modules/@vada`의 링크가 옛 폴더(`C:/Users/82108/vada-m1`)를 가리켜, 테스트가 옛 코드를 읽는다.

Run: `npm ci`
Then: `ls -la node_modules/@vada`
Expected: `api`, `contracts`, `web`이 이 저장소의 `apps/api`, `packages/contracts`, `apps/web`을 가리킨다(`vada-m1`이 없다).

Run: `npm test --workspace @vada/contracts`
Expected: PASS

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`packages/contracts/src/push.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PUSH_ENDPOINT_MAX, PushSubscriptionSchema } from './push.js'

const valid = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  expirationTime: null,
  keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) },
}

test('PushSubscriptionSchema: 브라우저 구독(toJSON) 모양을 받는다', () => {
  assert.equal(PushSubscriptionSchema.safeParse(valid).success, true)
  const { expirationTime: _, ...withoutExpiration } = valid
  assert.equal(PushSubscriptionSchema.safeParse(withoutExpiration).success, true)
  assert.equal(PushSubscriptionSchema.safeParse({ ...valid, expirationTime: 1_760_000_000_000 }).success, true)
})

test('PushSubscriptionSchema: 빠진 값, 빈 값, 상한+1, 제어 문자, 모르는 키, https가 아닌 주소를 거절한다', () => {
  const prefix = 'https://fcm.googleapis.com/'
  const longest = `${prefix}${'a'.repeat(PUSH_ENDPOINT_MAX - prefix.length)}`
  assert.equal(PushSubscriptionSchema.safeParse({ ...valid, endpoint: longest }).success, true)
  const bad: unknown[] = [
    {},
    { ...valid, endpoint: undefined },
    { ...valid, keys: undefined },
    { ...valid, keys: { p256dh: valid.keys.p256dh } },
    { ...valid, endpoint: '' },
    { ...valid, endpoint: '   ' },
    { ...valid, keys: { ...valid.keys, auth: ' ' } },
    { ...valid, endpoint: `${longest}a` },
    { ...valid, endpoint: `${longest.slice(0, -1)}😀` },
    { ...valid, keys: { ...valid.keys, p256dh: 'B'.repeat(201) } },
    { ...valid, keys: { ...valid.keys, auth: 'a'.repeat(101) } },
    { ...valid, endpoint: 'https://fcm.googleapis.com/\u0000' },
    { ...valid, keys: { ...valid.keys, auth: '\uD800' } },
    { ...valid, extra: 1 },
    { ...valid, keys: { ...valid.keys, extra: 'x' } },
    { ...valid, endpoint: 'http://fcm.googleapis.com/fcm/send/abc' },
    { ...valid, endpoint: 'not a url' },
    { ...valid, expirationTime: -1 },
    { ...valid, expirationTime: 1.5 },
    { ...valid, expirationTime: '1' },
  ]
  for (const value of bad) assert.equal(PushSubscriptionSchema.safeParse(value).success, false, JSON.stringify(value))
})
```

- [ ] **Step 2: 테스트가 실패하는지 본다**

Run: `cd packages/contracts && npx tsx --test src/push.test.ts`
Expected: FAIL (`Cannot find module './push.js'`)

- [ ] **Step 3: 스키마를 만든다**

`packages/contracts/src/push.ts`:

```ts
import { z } from 'zod'
import { token } from './input.js'

// 휴대폰 알림(웹 푸시). 브라우저 PushSubscription.toJSON()의 모양이다.
// 구독 주소는 기기를 가리키는 비밀 주소라 로그와 응답에 넣지 않는다.
export const PUSH_ENDPOINT_MAX = 1024
const isHttpsUrl = (value: string) => {
  try { return new URL(value).protocol === 'https:' } catch { return false }
}

export const PushSubscriptionSchema = z.strictObject({
  endpoint: token(PUSH_ENDPOINT_MAX).refine(isHttpsUrl),
  // 브라우저는 대개 null을 보낸다.
  expirationTime: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  keys: z.strictObject({ p256dh: token(200), auth: token(100) }),
})
export type PushSubscriptionRequest = z.infer<typeof PushSubscriptionSchema>

export const PUSH_TEST_RESULTS = ['sent', 'expired', 'rejected'] as const
export type PushTestResult = typeof PUSH_TEST_RESULTS[number]
export type PushKeyResponse = { publicKey: string }
export type PushTestResponse = { result: PushTestResult }
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

Run: `cd packages/contracts && npx tsx --test src/push.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 내보내고 테스트 목록에 더한다**

`packages/contracts/src/index.ts`의 `export { MESSAGE_CONTENT_MAX, ... } from './chat.js'` 줄 바로 아래에 더한다:

```ts
export { PUSH_ENDPOINT_MAX, PUSH_TEST_RESULTS, PushSubscriptionSchema, type PushSubscriptionRequest, type PushTestResult,
  type PushKeyResponse, type PushTestResponse } from './push.js'
```

`packages/contracts/package.json`의 `test` 스크립트 끝(`src/reports.test.ts` 뒤)에 ` src/push.test.ts`를 더한다.

Run: `npm test --workspace @vada/contracts && npm run typecheck --workspace @vada/contracts`
Expected: PASS, 타입 오류 없음

- [ ] **Step 6: 커밋**

```bash
git add packages/contracts/src/push.ts packages/contracts/src/push.test.ts packages/contracts/src/index.ts packages/contracts/package.json
git commit -m "휴대폰 알림 구독 계약 더하기"
```

---

### Task 2: 서버 — 알림 열쇠 설정, 알림 서버 거르기, 보내기

**Files:**
- Modify: `apps/api/package.json` (의존성 둘, `test` 스크립트 끝에 새 테스트 파일 셋)
- Create: `apps/api/src/push/config.ts`, `apps/api/src/push/config.test.ts`
- Create: `apps/api/src/push/endpoint.ts`, `apps/api/src/push/endpoint.test.ts`
- Create: `apps/api/src/push/sender.ts`, `apps/api/src/push/sender.test.ts`

**Interfaces:**
- Consumes: `PushTestResult` (Task 1)
- Produces:
  - `interface PushConfig { publicKey: string; privateKey: string; subject: string }`
  - `pushConfigFrom(env: NodeJS.ProcessEnv): PushConfig | null` (일부만 있거나 형식이 틀리면 값 없이 던진다)
  - `isKnownPushService(endpoint: string): boolean`
  - `type PushMessage = { title: string; body: string; url: string }`
  - `type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } }`
  - `type PushSender = (target: PushTarget, message: PushMessage) => Promise<PushTestResult>`
  - `createPushSender(config: PushConfig, send?: Send): PushSender`

- [ ] **Step 1: 의존성을 더한다**

Run:
```bash
npm install web-push@3.6.7 --workspace @vada/api --save-exact
npm install @types/web-push@3.6.4 --workspace @vada/api --save-dev --save-exact
```
Expected: `apps/api/package.json`의 `dependencies`에 `"web-push": "3.6.7"`, `devDependencies`에 `"@types/web-push": "3.6.4"`가 생긴다. 다른 줄은 바뀌지 않는다(`git diff apps/api/package.json`으로 본다).

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`apps/api/src/push/config.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import webpush from 'web-push'
import { pushConfigFrom } from './config.js'

const keys = webpush.generateVAPIDKeys()
const env = { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: 'mailto:team@vada.test' }

test('알림 열쇠가 하나도 없으면 알림을 끈다', () => {
  assert.equal(pushConfigFrom({}), null)
  assert.equal(pushConfigFrom({ VAPID_PUBLIC_KEY: ' ', VAPID_PRIVATE_KEY: '', VAPID_SUBJECT: '' }), null)
})

test('셋이 모두 맞으면 알림을 켠다', () => {
  assert.deepEqual(pushConfigFrom(env), { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: 'mailto:team@vada.test' })
  assert.equal(pushConfigFrom({ ...env, VAPID_SUBJECT: ' https://vada.test/contact ' })?.subject, 'https://vada.test/contact')
})

test('일부만 있거나 형식이 틀리면 값을 드러내지 않고 시작을 막는다', () => {
  const broken = [
    { VAPID_PUBLIC_KEY: keys.publicKey },
    { ...env, VAPID_PRIVATE_KEY: '' },
    { ...env, VAPID_SUBJECT: '' },
    { ...env, VAPID_PUBLIC_KEY: keys.privateKey },
    { ...env, VAPID_PRIVATE_KEY: keys.publicKey },
    { ...env, VAPID_PUBLIC_KEY: `${keys.publicKey}=` },
    { ...env, VAPID_SUBJECT: 'team@vada.test' },
    { ...env, VAPID_SUBJECT: 'http://vada.test' },
  ]
  for (const value of broken) {
    assert.throws(() => pushConfigFrom(value), error => {
      assert.ok(error instanceof Error)
      assert.ok(!error.message.includes(keys.privateKey) && !error.message.includes(keys.publicKey))
      return true
    }, JSON.stringify(Object.keys(value)))
  }
})
```

`apps/api/src/push/endpoint.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isKnownPushService } from './endpoint.js'

test('알려진 브라우저 알림 서버로만 보낸다', () => {
  for (const known of [
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://web.push.apple.com/QGx',
    'https://updates.push.services.mozilla.com/wpush/v2/x',
    'https://wns2-par02p.notify.windows.com/w/?token=x',
    'https://FCM.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com:443/fcm/send/abc',
  ]) assert.equal(isKnownPushService(known), true, known)
  for (const unknown of [
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com.evil.test/x',
    'https://evil.test/fcm.googleapis.com',
    'https://notify.windows.com/x',
    'https://evilnotify.windows.com/x',
    'https://127.0.0.1/x',
    'https://localhost/x',
    'https://user:pass@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x',
    'not a url',
    '',
  ]) assert.equal(isKnownPushService(unknown), false, unknown)
})
```

`apps/api/src/push/sender.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import webpush from 'web-push'
import { createPushSender } from './sender.js'

const keys = webpush.generateVAPIDKeys()
const config = { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: 'mailto:team@vada.test' }
const target = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p', auth: 'a' } }
const message = { title: 'VADA', body: '시험', url: '/' }

test('정한 설정으로 한 번 보내고 sent를 돌려준다', async () => {
  const calls: unknown[][] = []
  const send = createPushSender(config, async (...args) => { calls.push(args) })
  assert.equal(await send(target, message), 'sent')
  assert.deepEqual(calls, [[target, JSON.stringify(message), {
    vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
    TTL: 60, urgency: 'high', timeout: 10_000,
  }]])
})

test('404·410은 expired, 그 밖의 실패는 rejected다', async () => {
  for (const [statusCode, expected] of [[404, 'expired'], [410, 'expired'], [400, 'rejected'], [403, 'rejected'], [429, 'rejected'], [500, 'rejected']] as const) {
    const send = createPushSender(config, async () => { throw Object.assign(new Error('push failed'), { statusCode }) })
    assert.equal(await send(target, message), expected, String(statusCode))
  }
  const offline = createPushSender(config, async () => { throw new Error('ECONNRESET') })
  assert.equal(await offline(target, message), 'rejected')
})
```

- [ ] **Step 3: 테스트가 실패하는지 본다**

Run: `cd apps/api && npx tsx --test --test-concurrency=2 src/push/config.test.ts src/push/endpoint.test.ts src/push/sender.test.ts`
Expected: FAIL (`Cannot find module './config.js'` 등)

- [ ] **Step 4: 설정, 거르기, 보내기를 만든다**

`apps/api/src/push/config.ts`:

```ts
// 휴대폰 알림(웹 푸시)의 서버 열쇠(VAPID). 셋이 모두 있어야 켠다.
// 일부만 있으면 설정 실수이므로 서버를 시작하지 않는다. 오류에 값을 넣지 않는다.
export interface PushConfig { publicKey: string; privateKey: string; subject: string }

// URL용 base64(패딩 없음)만 받는다.
const bytesOf = (value: string) => /^[A-Za-z0-9_-]+$/.test(value) ? Buffer.from(value, 'base64url') : null

export function pushConfigFrom(env: NodeJS.ProcessEnv): PushConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim() ?? ''
  const privateKey = env.VAPID_PRIVATE_KEY?.trim() ?? ''
  const subject = env.VAPID_SUBJECT?.trim() ?? ''
  const given = [publicKey, privateKey, subject].filter(Boolean).length
  if (given === 0) return null
  if (given < 3) throw new Error('알림 열쇠 설정(VAPID) 세 값을 모두 넣거나 모두 빼세요.')
  // 공개 열쇠는 P-256 점(65바이트, 0x04로 시작), 비밀 열쇠는 32바이트다.
  const point = bytesOf(publicKey)
  if (!point || point.length !== 65 || point[0] !== 4 || bytesOf(privateKey)?.length !== 32) {
    throw new Error('알림 열쇠(VAPID) 형식을 확인하세요.')
  }
  if (!/^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/.test(subject)) throw new Error('VAPID_SUBJECT는 mailto: 또는 https: 주소여야 합니다.')
  return { publicKey, privateKey, subject }
}
```

`apps/api/src/push/endpoint.ts`:

```ts
// 사용자가 준 주소로 서버가 요청을 보내므로 알려진 브라우저 알림 서버로만 보낸다(내부 주소를 찌르는 요청 위조 방지).
// 삼성 인터넷의 알림 서버는 확인하지 못했다. 실제 기기 확인에서 막히면 그 호스트를 여기에 더한다(휴대폰 길 spec).
const exactHosts = new Set(['fcm.googleapis.com', 'web.push.apple.com', 'updates.push.services.mozilla.com'])
const hostSuffixes = ['.notify.windows.com']

export function isKnownPushService(endpoint: string) {
  let url: URL
  try { url = new URL(endpoint) } catch { return false }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false
  const host = url.hostname
  return exactHosts.has(host) || hostSuffixes.some(suffix => host.endsWith(suffix) && host.length > suffix.length)
}
```

`apps/api/src/push/sender.ts`:

```ts
import webpush, { type RequestOptions } from 'web-push'
import type { PushTestResult } from '@vada/contracts'
import type { PushConfig } from './config.js'

export type PushMessage = { title: string; body: string; url: string }
export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } }
export type PushSender = (target: PushTarget, message: PushMessage) => Promise<PushTestResult>
type Send = (target: PushTarget, payload: string, options: RequestOptions) => Promise<unknown>

const sendWithLibrary: Send = (target, payload, options) => webpush.sendNotification(target, payload, options)

// 알림 서버가 404·410을 주면 그 구독은 끝났다. 그 밖의 실패(거절, 시간 초과, 연결 실패)는 받지 않은 것으로 본다.
// 예상한 실패라 던지지 않고 결과로 돌려준다.
export function createPushSender(config: PushConfig, send: Send = sendWithLibrary): PushSender {
  const options: RequestOptions = {
    vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
    TTL: 60, urgency: 'high', timeout: 10_000,
  }
  return async (target, message) => {
    try {
      await send(target, JSON.stringify(message), options)
      return 'sent'
    } catch (error) {
      const status = (error as { statusCode?: unknown }).statusCode
      return status === 404 || status === 410 ? 'expired' : 'rejected'
    }
  }
}
```

- [ ] **Step 5: 테스트가 통과하는지 본다**

Run: `cd apps/api && npx tsx --test --test-concurrency=2 src/push/config.test.ts src/push/endpoint.test.ts src/push/sender.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: 테스트 목록에 더하고 타입을 검사한다**

`apps/api/package.json`의 `test` 스크립트 끝(`src/http/sentry.test.ts` 뒤)에 ` src/push/config.test.ts src/push/endpoint.test.ts src/push/sender.test.ts`를 더한다.

Run: `npm run typecheck --workspace @vada/api`
Expected: 타입 오류 없음

- [ ] **Step 7: 커밋**

```bash
git add apps/api/package.json package-lock.json apps/api/src/push/config.ts apps/api/src/push/config.test.ts apps/api/src/push/endpoint.ts apps/api/src/push/endpoint.test.ts apps/api/src/push/sender.ts apps/api/src/push/sender.test.ts
git commit -m "휴대폰 알림 열쇠 설정과 보내기 더하기"
```

---

### Task 3: 서버 — 알림 경로, `/api/me` 가드, 서버 연결, CI

**Files:**
- Create: `apps/api/src/push/routes.ts`, `apps/api/src/push/routes.test.ts`
- Modify: `apps/api/src/app.ts` (`AppOptions.push`, `/api/me/*` 가드, 경로 연결)
- Modify: `apps/api/src/http/boundary.test.ts` (`guarded`에 `/api/me/`, 모듈 표에 `push`)
- Modify: `apps/api/src/serve.ts` (설정 읽기, 보내기 만들기, `createApp`에 넘기기)
- Modify: `apps/api/package.json` (`test` 스크립트 끝에 `src/push/routes.test.ts`)
- Modify: `.github/workflows/ci.yml` (운영 모드 시작 검사에 알림 열쇠)
- Modify: `AGENTS.md` (새 API 절과 로그·비밀 절에 한 줄씩)

**Interfaces:**
- Consumes: `PushSubscriptionSchema`, `PushKeyResponse`, `PushTestResponse` (Task 1), `isKnownPushService`, `PushSender`, `PushMessage`, `pushConfigFrom`, `createPushSender` (Task 2), `requireSession`, `SessionReader`, `SessionEnv` (`auth/require-session.ts`), `json` (`http/validate.ts`), `ApiError` (`http/errors.ts`)
- Produces:
  - `TEST_MESSAGE: PushMessage`, `TEST_DELAY_MS = 5_000`
  - `createPushRoutes(getSession: SessionReader, publicKey: string, send: PushSender, wait?: (ms: number) => Promise<void>): Hono<SessionEnv>`
  - `AppOptions.push?: ReturnType<typeof createPushRoutes>`
  - HTTP: `GET /api/me/push` → `PushKeyResponse` | 401 | 404, `POST /api/me/push/test` → `PushTestResponse` | 400 `PUSH_SERVICE_UNSUPPORTED` | 400 `INVALID_INPUT` | 401

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`apps/api/src/push/routes.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from '../app.js'
import { createPushRoutes, TEST_DELAY_MS, TEST_MESSAGE } from './routes.js'
import type { PushSender } from './sender.js'

const origin = 'http://127.0.0.1:5180'
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  expirationTime: null,
  keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) },
}

function setup(result: Awaited<ReturnType<PushSender>> = 'sent') {
  let userId: string | null = 'u1'
  const sent: Parameters<PushSender>[] = []
  const waits: number[] = []
  const push = createPushRoutes(async () => userId ? { user: { id: userId } } : null, 'PUBLIC',
    async (...args) => { sent.push(args); return result }, async ms => { waits.push(ms) })
  const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, push })
  const post = (body: unknown) => app.request('/api/me/push/test', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body),
  })
  return { app, post, sent, waits, logout: () => { userId = null } }
}

test('공개 열쇠는 로그인한 사람에게만 준다', async () => {
  const { app, logout } = setup()
  const response = await app.request('/api/me/push')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { publicKey: 'PUBLIC' })
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  logout()
  assert.equal((await app.request('/api/me/push')).status, 401)
})

test('시험 알림은 5초 기다린 뒤 정한 문구로 그 구독에만 보낸다', async () => {
  const { post, sent, waits } = setup()
  const response = await post(subscription)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { result: 'sent' })
  assert.deepEqual(waits, [TEST_DELAY_MS])
  assert.deepEqual(sent, [[{ endpoint: subscription.endpoint, keys: subscription.keys }, TEST_MESSAGE]])
})

test('보내기 결과 expired·rejected를 그대로 돌려준다', async () => {
  for (const result of ['expired', 'rejected'] as const) {
    const { post } = setup(result)
    assert.deepEqual(await (await post(subscription)).json(), { result })
  }
})

test('모르는 알림 서버면 기다리지도 보내지도 않고 400이다', async () => {
  const { post, sent, waits } = setup()
  const response = await post({ ...subscription, endpoint: 'https://evil.test/push' })
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'PUSH_SERVICE_UNSUPPORTED' })
  assert.deepEqual(sent, [])
  assert.deepEqual(waits, [])
})

test('로그인하지 않으면 401이고 보내지 않는다', async () => {
  const { post, sent, logout } = setup()
  logout()
  assert.equal((await post(subscription)).status, 401)
  assert.deepEqual(sent, [])
})

test('알림 열쇠가 없어 경로를 만들지 않으면 404다', async () => {
  const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin })
  assert.equal((await app.request('/api/me/push')).status, 404)
  const response = await app.request('/api/me/push/test', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(subscription),
  })
  assert.equal(response.status, 404)
})
```

- [ ] **Step 2: 테스트가 실패하는지 본다**

Run: `cd apps/api && npx tsx --test src/push/routes.test.ts`
Expected: FAIL (`Cannot find module './routes.js'`)

- [ ] **Step 3: 경로를 만든다**

`apps/api/src/push/routes.ts`:

```ts
import { Hono } from 'hono'
import { PushSubscriptionSchema, type PushKeyResponse, type PushTestResponse } from '@vada/contracts'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import { isKnownPushService } from './endpoint.js'
import type { PushMessage, PushSender } from './sender.js'

export const TEST_MESSAGE: PushMessage = { title: 'VADA', body: '시험 알림이에요. 누르면 VADA가 열려요.', url: '/' }
export const TEST_DELAY_MS = 5_000
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// 휴대폰 알림. 이번에는 기기를 저장하지 않고, 시험 알림을 보낼 때만 구독을 받아 쓰고 버린다(휴대폰 길 spec).
export function createPushRoutes(getSession: SessionReader, publicKey: string, send: PushSender, wait: (ms: number) => Promise<void> = sleep) {
  const routes = new Hono<SessionEnv>()
  const authenticated = requireSession(getSession)
  routes.get('/me/push', authenticated, c => c.json({ publicKey } satisfies PushKeyResponse))
  // 5초 기다렸다 보낸다. 그동안 사용자가 화면을 끄거나 홈으로 나가 잠금 화면의 알림을 본다.
  routes.post('/me/push/test', json(PushSubscriptionSchema), authenticated, async c => {
    const { endpoint, keys } = c.req.valid('json')
    if (!isKnownPushService(endpoint)) throw new ApiError('PUSH_SERVICE_UNSUPPORTED', 400)
    await wait(TEST_DELAY_MS)
    const result = await send({ endpoint, keys }, TEST_MESSAGE)
    // 구독 주소는 기기를 가리키는 비밀 주소라 남기지 않는다. 결과의 종류만 남긴다.
    if (result !== 'sent') console.warn(JSON.stringify({ event: 'push_test_failed', result }))
    return c.json({ result } satisfies PushTestResponse)
  })
  return routes
}
```

- [ ] **Step 4: 앱에 잇고 `/api/me/*`에 가드를 건다**

`apps/api/src/app.ts`:

1. `import type { createHomeRoutes } from './home/routes.js'` 아래에 더한다:
```ts
import type { createPushRoutes } from './push/routes.js'
```
2. `AppOptions`의 `home?: ...` 줄 아래에 더한다:
```ts
  // 휴대폰 알림. 알림 열쇠(VAPID)가 없으면 만들지 않는다.
  push?: ReturnType<typeof createPushRoutes>
```
3. `createApp`의 구조 분해에 `push`를 더한다(`tasks, reports, home, organization, webhook` → `tasks, reports, home, push, organization, webhook`).
4. `app.use('/api/organizations/*', mutationGuard(trustedOrigin))` 바로 아래에 더한다:
```ts
  // 로그인한 사람 자신의 것(휴대폰 알림)도 같은 가드를 건다.
  app.use('/api/me/*', mutationGuard(trustedOrigin))
```
5. `if (home) app.route('/api', home)` 아래에 더한다:
```ts
  if (push) app.route('/api', push)
```

- [ ] **Step 5: 경로 테스트가 통과하는지 본다**

Run: `cd apps/api && npx tsx --test src/push/routes.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: 경계 테스트가 새 경로를 검사하게 한다**

`apps/api/src/http/boundary.test.ts`:

1. `import { createHomeRoutes } from '../home/routes.js'` 아래에 더한다:
```ts
import { createPushRoutes } from '../push/routes.js'
```
2. 가드 목록을 바꾼다:
```ts
// 공통 가드가 거는 곳: 로그인한 구성원의 경로, 로그인한 사람 자신의 경로(휴대폰 알림), 로그인 없이 쓰는 공개 경로
const guarded = ['/api/organizations/', '/api/me/', '/api/public/']
```
3. `modules` 표의 `home: createHomeRoutes(db, session),` 아래에 더한다:
```ts
      push: createPushRoutes(session, 'PUBLIC', async () => 'sent', async () => {}),
```

Run: `cd apps/api && npx tsx --test src/http/boundary.test.ts`
Expected: PASS. `POST /api/me/push/test`가 출처 403, 형식 415, 크기 413, 깨진 JSON 400, 모르는 키 400을 인증 전에 받는다.

- [ ] **Step 7: 서버 시작 때 잇는다**

`apps/api/src/serve.ts`:

1. `import { createHomeRoutes } from './home/routes.js'` 아래에 더한다:
```ts
import { pushConfigFrom } from './push/config.js'
import { createPushRoutes } from './push/routes.js'
import { createPushSender } from './push/sender.js'
```
2. `const home = createHomeRoutes(...)` 줄 아래에 더한다:
```ts
  // 휴대폰 알림 열쇠는 서버에서만 쓴다. 없으면 알림 경로를 만들지 않는다.
  const pushConfig = pushConfigFrom(env)
  if (pushConfig) console.log('휴대폰 알림 켜짐 (Web Push)')
  const push = pushConfig
    ? createPushRoutes((headers) => auth.api.getSession({ headers }), pushConfig.publicKey, createPushSender(pushConfig))
    : undefined
```
3. `createApp({ ... registrations, fees, tasks, reports, home, organization, webhook })`를 `... reports, home, push, organization, webhook })`로 바꾼다.

`apps/api/package.json`의 `test` 스크립트 끝에 ` src/push/routes.test.ts`를 더한다.

Run: `npm run typecheck --workspace @vada/api`
Expected: 타입 오류 없음

- [ ] **Step 8: CI의 운영 모드 시작 검사가 알림을 켠 채로 뜨는지 보게 한다**

`.github/workflows/ci.yml`의 `Start in production mode` 단계에서 `run: |` 아래 내용을 다음으로 바꾼다(`env:` 블록은 그대로 둔다):

```yaml
        run: |
          # 알림 열쇠는 형식 검사를 받으므로 실행할 때마다 새로 만든다. 어디에도 남지 않는다.
          eval "$(node -e "const k=require('web-push').generateVAPIDKeys();console.log('export VAPID_PUBLIC_KEY='+k.publicKey+' VAPID_PRIVATE_KEY='+k.privateKey)")"
          export VAPID_SUBJECT=mailto:ci@vada.invalid
          npm start > start.log 2>&1 &
          for i in $(seq 1 90); do
            if curl -sf http://127.0.0.1:8899/api/health > /dev/null; then
              echo "started in ${i}s"; cat start.log
              grep -q '휴대폰 알림 켜짐' start.log || { echo "push routes were not enabled"; exit 1; }
              exit 0
            fi
            sleep 1
          done
          echo "server did not answer /api/health within 90s"; cat start.log; exit 1
```

Run(로컬에서 같은 명령이 키를 만드는지만 본다): `node -e "const k=require('web-push').generateVAPIDKeys();console.log(k.publicKey.length, k.privateKey.length)"`
Expected: `87 43`

- [ ] **Step 9: 저장소 규칙에 한 줄씩 더한다**

`AGENTS.md`의 "새 API를 만들 때" 절에서 다음 문장을

```
- 변경 라우트는 `/api/organizations/` 아래에 둔다. 출처·형식·크기 검사는 공통 가드(`apps/api/src/http/guard.ts`)가 맡으므로 라우트에서 다시 구현하지 않는다.
```

다음으로 바꾼다(문장 뒤의 "그 밖에 둘 수밖에 없는 라우트…"는 그대로 둔다):

```
- 변경 라우트는 `/api/organizations/` 아래에 둔다. 로그인한 사람 자신의 것(휴대폰 알림)은 `/api/me/` 아래에 둔다. 출처·형식·크기 검사는 두 곳 모두 공통 가드(`apps/api/src/http/guard.ts`)가 맡으므로 라우트에서 다시 구현하지 않는다.
```

"로그·비밀" 절의 `.env` 줄 위에 더한다:

```
- 휴대폰 알림의 구독 주소(endpoint)는 기기를 가리키는 비밀 주소다. 로그와 응답에 넣지 않는다.
```

- [ ] **Step 10: API 테스트 전체를 돌린다**

Run: `cd apps/api && npx tsx --test --test-concurrency=2 $(node -p "require('./package.json').scripts.test.replace('tsx --test ', '')")`
Expected: PASS (실패 0)

- [ ] **Step 11: 커밋**

```bash
git add apps/api/src/push/routes.ts apps/api/src/push/routes.test.ts apps/api/src/app.ts apps/api/src/http/boundary.test.ts apps/api/src/serve.ts apps/api/package.json .github/workflows/ci.yml AGENTS.md
git commit -m "휴대폰 알림 경로와 /api/me 가드 더하기"
```

---

### Task 4: 화면 바탕 — 홈 화면 설정, 아이콘, 서비스 워커

**Files:**
- Create: `apps/web/scripts/make-icons.mjs`
- Create(스크립트가 만든다): `apps/web/public/icons/icon-192.png`, `apps/web/public/icons/icon-512.png`, `apps/web/public/icons/maskable-512.png`, `apps/web/public/apple-touch-icon.png`
- Create: `apps/web/public/manifest.webmanifest`
- Create: `apps/web/public/sw.js`
- Create: `apps/web/src/manifest.test.ts`, `apps/web/src/sw.test.ts`
- Create: `apps/web/src/lib/service-worker.ts`, `apps/web/src/lib/service-worker.test.ts`
- Modify: `apps/web/index.html`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/api/src/web.ts`, `apps/api/src/web.test.ts`

**Interfaces:**
- Produces:
  - 정적 파일 `/sw.js`, `/manifest.webmanifest`, `/icons/*.png`, `/apple-touch-icon.png`
  - 서비스 워커가 받는 푸시 내용: `{ title: string; body: string; url: string }`(`url`은 `/`로 시작하는 같은 사이트 경로)
  - `registerServiceWorker(container?: { register: (url: string) => Promise<unknown> }): void`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`apps/web/src/manifest.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const publicFile = (path: string) => new URL(`../public/${path}`, import.meta.url)
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

test('홈 화면 설정은 VADA를 앱처럼 연다', () => {
  const manifest = JSON.parse(readFileSync(publicFile('manifest.webmanifest'), 'utf8'))
  expect(manifest).toMatchObject({ id: '/', name: 'VADA', short_name: 'VADA', lang: 'ko', start_url: '/', scope: '/',
    display: 'standalone', theme_color: '#155dfc', background_color: '#ffffff' })
  expect(manifest.icons).toEqual([
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ])
})

test('아이콘 파일은 PNG이고 적힌 크기와 같다', () => {
  for (const [path, size] of [['icons/icon-192.png', 192], ['icons/icon-512.png', 512], ['icons/maskable-512.png', 512],
    ['apple-touch-icon.png', 180]] as const) {
    const bytes = readFileSync(publicFile(path))
    expect(bytes.subarray(0, 8)).toEqual(PNG)
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([size, size])
  }
})

test('페이지가 홈 화면 설정과 아이콘을 잇는다', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  for (const tag of ['<link rel="manifest" href="/manifest.webmanifest" />', '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
    '<meta name="theme-color" content="#155dfc" />', '<meta name="apple-mobile-web-app-title" content="VADA" />', '<title>VADA</title>']) {
    expect(html).toContain(tag)
  }
})
```

`apps/web/src/sw.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, test, vi } from 'vitest'

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
type Client = { url: string; focus: () => Promise<unknown>; navigate: (url: string) => Promise<unknown> }

// 가짜 서비스 워커 전역(self)에 sw.js를 불러 이벤트를 보낸다.
function load(windows: Client[] = []) {
  const listeners = new Map<string, (event: unknown) => void>()
  const self = {
    location: { origin: 'https://vada.test' },
    addEventListener: (type: string, listener: (event: unknown) => void) => { listeners.set(type, listener) },
    skipWaiting: vi.fn(),
    registration: { showNotification: vi.fn(async (_title: string, _options: unknown) => {}) },
    clients: { claim: vi.fn(async () => {}), matchAll: vi.fn(async () => windows), openWindow: vi.fn(async (_url: string) => null) },
  }
  runInNewContext(source, { self, URL })
  const fire = async (type: string, event: Record<string, unknown>) => {
    let pending: unknown = undefined
    listeners.get(type)!({ ...event, waitUntil: (promise: unknown) => { pending = promise } })
    await pending
  }
  return { self, fire }
}

test('푸시를 받으면 받은 내용으로 알림을 띄운다', async () => {
  const { self, fire } = load()
  await fire('push', { data: { json: () => ({ title: 'VADA', body: '시험 알림이에요.', url: '/' }) } })
  expect(self.registration.showNotification).toHaveBeenCalledWith('VADA',
    { body: '시험 알림이에요.', data: { url: '/' }, icon: '/icons/icon-192.png', lang: 'ko' })
})

test('내용을 못 읽어도 알림은 띄우고, 다른 사이트 주소는 받지 않는다', async () => {
  const { self, fire } = load()
  await fire('push', { data: { json: () => { throw new SyntaxError('bad') } } })
  await fire('push', { data: null })
  await fire('push', { data: { json: () => ({ title: 'x', body: 'y', url: '//evil.test/' }) } })
  await fire('push', { data: { json: () => ({ title: 'x', body: 'y', url: 'https://evil.test/' }) } })
  const calls = self.registration.showNotification.mock.calls
  expect(calls.map(call => call[0])).toEqual(['VADA', 'VADA', 'x', 'x'])
  expect(calls.map(call => (call[1] as { data: { url: string } }).data.url)).toEqual(['/', '/', '/', '/'])
})

test('알림을 누르면 열린 VADA 창을 앞으로 가져와 그 주소로 보낸다', async () => {
  const window: Client = { url: 'https://vada.test/', focus: vi.fn(async () => window), navigate: vi.fn(async () => window) }
  const { self, fire } = load([window])
  const close = vi.fn()
  await fire('notificationclick', { notification: { close, data: { url: '/?from=push' } } })
  expect(close).toHaveBeenCalled()
  expect(window.focus).toHaveBeenCalled()
  expect(window.navigate).toHaveBeenCalledWith('https://vada.test/?from=push')
  expect(self.clients.openWindow).not.toHaveBeenCalled()
})

test('열린 창이 없으면 새로 연다', async () => {
  const { self, fire } = load()
  await fire('notificationclick', { notification: { close: vi.fn(), data: { url: '/' } } })
  expect(self.clients.openWindow).toHaveBeenCalledWith('https://vada.test/')
})

test('새 서비스 워커는 기다리지 않고 바로 맡는다', async () => {
  const { self, fire } = load()
  await fire('install', {})
  await fire('activate', {})
  expect(self.skipWaiting).toHaveBeenCalled()
  expect(self.clients.claim).toHaveBeenCalled()
})
```

`apps/web/src/lib/service-worker.test.ts`:

```ts
import { expect, test, vi } from 'vitest'
import { registerServiceWorker } from './service-worker'

test('서비스 워커를 맨 위 경로로 등록한다', () => {
  const register = vi.fn(async (_url: string) => ({}))
  registerServiceWorker({ register })
  expect(register).toHaveBeenCalledWith('/sw.js')
})

test('서비스 워커가 없거나 등록이 실패해도 화면을 막지 않는다', async () => {
  expect(() => registerServiceWorker(undefined)).not.toThrow()
  const register = vi.fn(async (_url: string) => { throw new Error('denied') })
  expect(() => registerServiceWorker({ register })).not.toThrow()
  await Promise.resolve()
  expect(register).toHaveBeenCalled()
})
```

- [ ] **Step 2: 테스트가 실패하는지 본다**

Run: `cd apps/web && npx vitest run src/manifest.test.ts src/sw.test.ts src/lib/service-worker.test.ts`
Expected: FAIL (`public/manifest.webmanifest`, `public/sw.js`, `./service-worker`가 없다)

- [ ] **Step 3: 아이콘을 만드는 스크립트를 쓰고 돌린다**

`apps/web/scripts/make-icons.mjs`:

```js
// 앱 아이콘을 만든다: 파란 정사각형(--primary) 안의 흰 V. 로고(BrandMark)와 같은 모양이다.
// 의존성 없이 PNG를 쓴다. 모양을 바꿀 때만 다시 돌린다: node apps/web/scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BLUE = [0x15, 0x5d, 0xfc]
const WHITE = [0xff, 0xff, 0xff]
const SAMPLES = 4 // 한 픽셀을 4×4로 나눠 가장자리를 부드럽게 한다.

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(bytes) {
  let c = 0xffffffff
  for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

// 점에서 선분까지의 거리
function distance(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

// V의 두 획. 단위 정사각형(0~1) 좌표다. scale은 가운데를 기준으로 줄인다(마스크용 아이콘의 안전 영역).
function inV(u, v, scale) {
  const at = (x, y) => [0.5 + (x - 0.5) * scale, 0.5 + (y - 0.5) * scale]
  const bottom = at(0.5, 0.7)
  const half = 0.065 * scale
  return distance(u, v, at(0.3, 0.3), bottom) <= half || distance(u, v, at(0.7, 0.3), bottom) <= half
}

function icon(size, scale) {
  const row = size * 3 + 1 // 줄마다 맨 앞 1바이트는 필터(0)다.
  const raw = Buffer.alloc(size * row)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          if (inV((x + (sx + 0.5) / SAMPLES) / size, (y + (sy + 0.5) / SAMPLES) / size, scale)) hits++
        }
      }
      const cover = hits / (SAMPLES * SAMPLES)
      for (let c = 0; c < 3; c++) raw[y * row + 1 + x * 3 + c] = Math.round(BLUE[c] + (WHITE[c] - BLUE[c]) * cover)
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // 채널당 8비트
  header[9] = 2 // RGB
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const publicDir = new URL('../public/', import.meta.url)
mkdirSync(new URL('icons/', publicDir), { recursive: true })
for (const [path, size, scale] of [['icons/icon-192.png', 192, 1], ['icons/icon-512.png', 512, 1],
  ['icons/maskable-512.png', 512, 0.8], ['apple-touch-icon.png', 180, 1]]) {
  writeFileSync(new URL(path, publicDir), icon(size, scale))
  console.log(`${path} ${size}px`)
}
```

Run: `node apps/web/scripts/make-icons.mjs`
Expected: 네 줄(`icons/icon-192.png 192px` … `apple-touch-icon.png 180px`)이 찍히고 파일 넷이 생긴다. `apps/web/public/icons/icon-512.png`를 열어 파란 바탕에 흰 V가 가운데 있는지 눈으로 본다.

- [ ] **Step 4: 홈 화면 설정, 서비스 워커, 등록 함수를 만든다**

`apps/web/public/manifest.webmanifest`:

```json
{
  "id": "/",
  "name": "VADA",
  "short_name": "VADA",
  "lang": "ko",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#155dfc",
  "background_color": "#ffffff",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

`apps/web/public/sw.js`:

```js
// VADA 서비스 워커: 휴대폰 알림을 띄우고, 알림을 누르면 VADA를 연다. 파일을 캐시하지 않는다(오프라인 없음).
self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()) })

// 아이폰은 알림을 띄우지 않는 푸시가 거듭되면 허락을 거둘 수 있다. 내용을 못 읽어도 늘 띄운다.
self.addEventListener('push', event => {
  let message = {}
  try { message = event.data ? event.data.json() : {} } catch { message = {} }
  const title = typeof message.title === 'string' && message.title ? message.title : 'VADA'
  const body = typeof message.body === 'string' ? message.body : ''
  // 같은 사이트 경로만 연다. '//다른곳'이나 전체 주소는 맨 앞 화면으로 바꾼다.
  const url = typeof message.url === 'string' && /^\/(?!\/)/.test(message.url) ? message.url : '/'
  event.waitUntil(self.registration.showNotification(title, { body, data: { url }, icon: '/icons/icon-192.png', lang: 'ko' }))
})

// 알림을 누르면 열린 VADA 창을 앞으로 가져와 그 주소로 보내고, 없으면 새로 연다.
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = new URL(event.notification.data?.url ?? '/', self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = windows.find(client => new URL(client.url).origin === self.location.origin)
    if (open) {
      await open.focus()
      if (open.url !== url) await open.navigate(url).catch(() => {})
      return
    }
    await self.clients.openWindow(url)
  })())
})
```

`apps/web/src/lib/service-worker.ts`:

```ts
// 휴대폰 알림을 받으려면 서비스 워커가 있어야 한다. 실패해도 화면은 그대로 쓴다.
type Registrar = { register: (url: string) => Promise<unknown> }
const browserRegistrar = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? navigator.serviceWorker : undefined

export function registerServiceWorker(container: Registrar | undefined = browserRegistrar()) {
  if (!container) return
  void container.register('/sw.js').catch(() => {})
}
```

`apps/web/index.html`의 `<head>`를 다음으로 바꾼다:

```html
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#155dfc" />
    <meta name="apple-mobile-web-app-title" content="VADA" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <title>VADA</title>
  </head>
```

`apps/web/src/main.tsx`:

1. `import { openOutsideKakao } from '@/lib/in-app-browser'` 아래에 더한다:
```ts
import { registerServiceWorker } from '@/lib/service-worker'
```
2. `if (shouldLeaveKakao(route, navigator.userAgent)) openOutsideKakao(navigator.userAgent, window.location)` 줄 아래에 더한다:
```ts
// 휴대폰 알림을 받을 서비스 워커. 로그인이 없는 공개 화면(참가 신청)에서는 등록하지 않는다.
if (route === null) registerServiceWorker()
```

- [ ] **Step 5: 화면 테스트가 통과하는지 본다**

Run: `cd apps/web && npx vitest run src/manifest.test.ts src/sw.test.ts src/lib/service-worker.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 6: 서버가 새 파일을 내주게 한다 — 실패하는 테스트**

`apps/api/src/web.test.ts`의 첫 테스트를 고친다.

1. `writeFileSync(join(root, 'private.txt'), 'not-public')` 줄 아래에 더한다:
```ts
    mkdirSync(join(root, 'icons'))
    writeFileSync(join(root, 'sw.js'), 'self.addEventListener("push", () => {})')
    writeFileSync(join(root, 'manifest.webmanifest'), '{"name":"VADA"}')
    writeFileSync(join(root, 'icons', 'icon-192.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    writeFileSync(join(root, 'apple-touch-icon.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
```
2. `assert.equal((await app.request('/assets/missing.js')).headers.get('Cache-Control'), null)` 줄 아래에 더한다:
```ts
    // 서비스 워커와 홈 화면 설정은 바뀌면 바로 받도록 캐시하지 않는다. 아이콘은 하루 캐시한다.
    const worker = await app.request('/sw.js')
    assert.equal(worker.status, 200)
    assert.match(worker.headers.get('Content-Type')!, /javascript/)
    assert.equal(worker.headers.get('Cache-Control'), 'no-cache')
    const manifest = await app.request('/manifest.webmanifest')
    assert.equal(manifest.status, 200)
    assert.equal(manifest.headers.get('Content-Type'), 'application/manifest+json')
    assert.equal(manifest.headers.get('Cache-Control'), 'no-cache')
    for (const path of ['/icons/icon-192.png', '/apple-touch-icon.png']) {
      const icon = await app.request(path)
      assert.equal(icon.status, 200, path)
      assert.equal(icon.headers.get('Content-Type'), 'image/png', path)
      assert.equal(icon.headers.get('Cache-Control'), 'public, max-age=86400', path)
    }
    assert.equal((await app.request('/icons/missing.png')).headers.get('Cache-Control'), null)
```
3. 404 목록(`for (const path of ['/api/missing', ...`)에 `'/icons/', '/icons/a/b', '/icons/missing.png', '/sw.js/x'`를 더한다.

Run: `cd apps/api && npx tsx --test src/web.test.ts`
Expected: FAIL (`/sw.js`가 404)

- [ ] **Step 7: 서버가 새 파일을 내준다**

`apps/api/src/web.ts`의 `/assets/*` 블록 위에 더한다:

```ts
  // 서비스 워커와 홈 화면 설정은 바뀌면 바로 받아야 하므로 캐시하지 않는다. 서비스 워커는 맨 위 경로에 있어야 앱 전체를 맡는다.
  app.on(['GET', 'HEAD'], ['/sw.js', '/manifest.webmanifest'], async (context, next) => {
    await next()
    if (context.res.status === 200) context.res.headers.set('Cache-Control', 'no-cache')
  }, serveStatic({ root }))
  // 앱 아이콘. 이름에 해시가 없으므로 하루만 캐시한다.
  app.on(['GET', 'HEAD'], ['/icons/:file', '/apple-touch-icon.png'], async (context, next) => {
    await next()
    if (context.res.status === 200) context.res.headers.set('Cache-Control', 'public, max-age=86400')
  }, serveStatic({ root }))
```

Run: `cd apps/api && npx tsx --test src/web.test.ts`
Expected: PASS

- [ ] **Step 8: 빌드에 새 파일이 들어가는지 본다**

Run: `npm run build --workspace @vada/web && ls apps/web/dist/sw.js apps/web/dist/manifest.webmanifest apps/web/dist/apple-touch-icon.png apps/web/dist/icons`
Expected: 빌드 성공, 네 경로가 모두 있다(`icons` 안에 PNG 셋)

- [ ] **Step 9: 커밋**

```bash
git add apps/web/scripts/make-icons.mjs apps/web/public apps/web/src/manifest.test.ts apps/web/src/sw.test.ts apps/web/src/lib/service-worker.ts apps/web/src/lib/service-worker.test.ts apps/web/index.html apps/web/src/main.tsx apps/api/src/web.ts apps/api/src/web.test.ts
git commit -m "홈 화면 설정과 아이콘, 서비스 워커 더하기"
```

---

### Task 5: 화면 — 기기 판별과 카톡 안 로그인 화면

**Files:**
- Create: `apps/web/src/lib/platform.ts`, `apps/web/src/lib/platform.test.ts`
- Create: `apps/web/src/auth/KakaoBlock.tsx`, `apps/web/src/auth/KakaoBlock.test.tsx`
- Create: `apps/web/src/auth/LoginPanel.tsx`, `apps/web/src/auth/LoginPanel.test.tsx`
- Modify: `apps/web/src/App.tsx` (로그인 화면 가운데를 `LoginPanel`로)
- Modify: `apps/web/src/App.test.tsx` (카톡 테스트의 문구)

**Interfaces:**
- Consumes: `openOutsideKakao(userAgent, location)`, `isKakaoInAppBrowser(userAgent)` (`lib/in-app-browser.ts`)
- Produces:
  - `type Device = 'ios' | 'android' | 'other'`
  - `deviceOf(userAgent: string, maxTouchPoints?: number): Device`
  - `isIosHomeScreenApp(navigator: { standalone?: boolean }): boolean`
  - `KakaoBlock` (기본 내보내기) `{ userAgent?: string; location?: { href: string }; clipboard?: Pick<Clipboard, 'writeText'> }`
  - `LoginPanel` (기본 내보내기) `{ kakao: boolean; busy: boolean; onLogin: () => void }` — Task 6이 `homeScreenApp`, `onLoginInApp`을 더한다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`apps/web/src/lib/platform.test.ts`:

```ts
import { expect, test } from 'vitest'
import { deviceOf, isIosHomeScreenApp } from './platform'

const ua = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneKakao: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.0',
  ipadDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
}

test('사용자 에이전트로 아이폰, 안드로이드, 그 밖을 가린다', () => {
  expect(deviceOf(ua.iphoneSafari)).toBe('ios')
  expect(deviceOf(ua.iphoneKakao)).toBe('ios')
  expect(deviceOf(ua.ipadDesktop, 5)).toBe('ios')
  expect(deviceOf(ua.ipadDesktop, 0)).toBe('other')
  expect(deviceOf(ua.androidChrome)).toBe('android')
  expect(deviceOf(ua.samsung)).toBe('android')
  expect(deviceOf(ua.windowsChrome)).toBe('other')
})

test('iOS 홈 화면 앱에서만 참이다', () => {
  expect(isIosHomeScreenApp({ standalone: true })).toBe(true)
  expect(isIosHomeScreenApp({ standalone: false })).toBe(false)
  expect(isIosHomeScreenApp({})).toBe(false)
})
```

`apps/web/src/auth/KakaoBlock.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import KakaoBlock from './KakaoBlock'

afterEach(cleanup)
const kakao = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.0'

test('바깥 브라우저로 열기는 카카오톡의 바깥 브라우저 주소로 보낸다', () => {
  const location = { href: 'https://vada.test/join/ABCD2345' }
  render(<KakaoBlock userAgent={kakao} location={location} clipboard={{ writeText: vi.fn(async () => {}) }} />)
  expect(screen.getByText('카카오톡 안에서는 Google 로그인이 막혀 있어요. 바깥 브라우저로 열어 주세요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '바깥 브라우저로 열기' }))
  expect(location.href).toBe('kakaotalk://web/openExternal?url=https%3A%2F%2Fvada.test%2Fjoin%2FABCD2345')
})

test('주소를 복사하면 알린다', async () => {
  const writeText = vi.fn(async (_text: string) => {})
  render(<KakaoBlock userAgent={kakao} location={{ href: 'https://vada.test/' }} clipboard={{ writeText }} />)
  fireEvent.click(screen.getByRole('button', { name: '주소 복사' }))
  expect(await screen.findByText('주소를 복사했어요. 사파리나 Chrome에 붙여 넣어 주세요.')).toBeTruthy()
  expect(writeText).toHaveBeenCalledWith('https://vada.test/')
})

test('복사가 막히면 주소를 글자로 보여 길게 눌러 고르게 한다', async () => {
  render(<KakaoBlock userAgent={kakao} location={{ href: 'https://vada.test/' }}
    clipboard={{ writeText: async () => { throw new Error('denied') } }} />)
  fireEvent.click(screen.getByRole('button', { name: '주소 복사' }))
  expect(await screen.findByText('주소를 복사하지 못했어요. 아래 주소를 길게 눌러 복사해 주세요.')).toBeTruthy()
  expect(screen.getByText('https://vada.test/').className).toContain('select-all')
})
```

`apps/web/src/auth/LoginPanel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import LoginPanel from './LoginPanel'

afterEach(cleanup)

test('카카오톡 안에서는 Google 로그인 대신 바깥 브라우저로 가는 길을 보여 준다', () => {
  render(<LoginPanel kakao busy={false} onLogin={vi.fn()} />)
  expect(screen.getByRole('button', { name: '바깥 브라우저로 열기' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Google로 로그인' })).toBeNull()
})

test('바깥 브라우저에서는 Google 로그인을 부르고, 로그인 중에는 막는다', () => {
  const onLogin = vi.fn()
  const view = render(<LoginPanel kakao={false} busy={false} onLogin={onLogin} />)
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
  expect(onLogin).toHaveBeenCalledTimes(1)
  view.rerender(<LoginPanel kakao={false} busy onLogin={onLogin} />)
  expect((screen.getByRole('button', { name: 'Google로 이동 중…' }) as HTMLButtonElement).disabled).toBe(true)
})
```

- [ ] **Step 2: 테스트가 실패하는지 본다**

Run: `cd apps/web && npx vitest run src/lib/platform.test.ts src/auth/KakaoBlock.test.tsx src/auth/LoginPanel.test.tsx`
Expected: FAIL (모듈이 없다)

- [ ] **Step 3: 기기 판별, 카톡 안내, 로그인 가운데를 만든다**

`apps/web/src/lib/platform.ts`:

```ts
// 휴대폰 길에서 기기마다 안내를 달리할 곳을 가린다. 사용자 에이전트로만 정한다.
export type Device = 'ios' | 'android' | 'other'

export function deviceOf(userAgent: string, maxTouchPoints = 0): Device {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios'
  // iPadOS 사파리는 맥으로 자신을 알린다. 터치가 되는 맥은 아이패드다.
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return 'ios'
  if (/Android/.test(userAgent)) return 'android'
  return 'other'
}

// iOS 홈 화면 앱에서만 참이다. 사파리 탭에서는 false이고, 다른 기기에는 이 값이 없다.
export const isIosHomeScreenApp = (navigator: { standalone?: boolean }) => navigator.standalone === true
```

`apps/web/src/auth/KakaoBlock.tsx`:

```tsx
import { useState } from 'react'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { openOutsideKakao } from '@/lib/in-app-browser'

type Props = { userAgent?: string; location?: { href: string }; clipboard?: Pick<Clipboard, 'writeText'> }

// 카카오톡 안에서는 Google 로그인이 403으로 막힌다. 로그인 버튼 대신 바깥 브라우저로 넘어가는 길을 보여 준다.
// 처음 열 때의 자동 넘기기가 막혔어도, 사용자가 누른 동작으로는 넘어갈 수 있다.
export default function KakaoBlock({ userAgent = navigator.userAgent, location = window.location, clipboard = navigator.clipboard }: Props) {
  const [pageUrl] = useState(() => location.href)
  const [copied, setCopied] = useState<'done' | 'failed' | null>(null)
  async function copy() {
    try {
      if (!clipboard) throw new Error('Clipboard unavailable')
      await clipboard.writeText(pageUrl)
      setCopied('done')
    } catch {
      setCopied('failed')
    }
  }
  return <div className="flex flex-col gap-3">
    <Alert tone="warning">카카오톡 안에서는 Google 로그인이 막혀 있어요. 바깥 브라우저로 열어 주세요.</Alert>
    <Button onClick={() => { openOutsideKakao(userAgent, location) }}>바깥 브라우저로 열기</Button>
    <Button variant="outline" onClick={() => { void copy() }}>주소 복사</Button>
    {copied === 'done' && <StateMessage kind="notice">주소를 복사했어요. 사파리나 Chrome에 붙여 넣어 주세요.</StateMessage>}
    {copied === 'failed' && <>
      <StateMessage kind="error">주소를 복사하지 못했어요. 아래 주소를 길게 눌러 복사해 주세요.</StateMessage>
      <p className="text-sm wrap-anywhere text-gray-900 select-all">{pageUrl}</p>
    </>}
    <p className="text-xs text-gray-500">안 되면 오른쪽 위나 아래의 메뉴(··· 또는 ⋮)에서 '다른 브라우저로 열기'를 눌러 주세요.</p>
  </div>
}
```

`apps/web/src/auth/LoginPanel.tsx`:

```tsx
import { Button } from '@/components/ui/button'
import KakaoBlock from './KakaoBlock'

type Props = { kakao: boolean; busy: boolean; onLogin: () => void }

// 로그인 화면의 가운데. 카카오톡 안에서는 Google 로그인이 막히므로 버튼 대신 바깥 브라우저로 넘어가는 길을 보여 준다.
export default function LoginPanel({ kakao, busy, onLogin }: Props) {
  if (kakao) return <KakaoBlock />
  return <div className="flex flex-col gap-3">
    <p className="text-sm text-gray-500">Google 계정으로 로그인해 주세요.</p>
    <Button disabled={busy} onClick={onLogin}>{busy ? 'Google로 이동 중…' : 'Google로 로그인'}</Button>
  </div>
}
```

- [ ] **Step 4: 새 테스트가 통과하는지 본다**

Run: `cd apps/web && npx vitest run src/lib/platform.test.ts src/auth/KakaoBlock.test.tsx src/auth/LoginPanel.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 5: 로그인 화면이 `LoginPanel`을 쓰게 한다**

`apps/web/src/App.tsx`:

1. `import { isKakaoInAppBrowser } from '@/lib/in-app-browser'` 아래에 더한다:
```ts
import LoginPanel from './auth/LoginPanel'
```
2. 로그인 화면의 다음 세 줄을
```tsx
      {isKakaoInAppBrowser(navigator.userAgent) && <Alert tone="warning">카카오톡 안에서는 Google 로그인이 막혀 있어요. 메뉴에서 '다른 브라우저로 열기'를 눌러 주세요.</Alert>}
      <p className="text-sm text-gray-500">Google 계정으로 로그인해 주세요.</p>
      <Button disabled={busy} onClick={() => { void login() }}>{busy ? 'Google로 이동 중…' : 'Google로 로그인'}</Button>
```
다음 한 줄로 바꾼다(초대 링크 `Alert` 줄은 그대로 둔다):
```tsx
      <LoginPanel kakao={isKakaoInAppBrowser(navigator.userAgent)} busy={busy} onLogin={() => { void login() }} />
```

`apps/web/src/App.test.tsx`의 `KakaoTalk in-app browser explains how to open another browser` 테스트를 다음으로 바꾼다:

```tsx
test('KakaoTalk in-app browser offers the outside browser instead of Google login', () => {
  const agent = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 14) KAKAOTALK/10.9.0')
  try {
    render(<App />)
    expect(screen.getByText('카카오톡 안에서는 Google 로그인이 막혀 있어요. 바깥 브라우저로 열어 주세요.')).toBeTruthy()
    expect(screen.getByRole('button', { name: '바깥 브라우저로 열기' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Google로 로그인' })).toBeNull()
  } finally {
    agent.mockRestore()
  }
})
```

Run: `cd apps/web && npx vitest run src/App.test.tsx src/App.integration.test.tsx && npx tsc --noEmit`
Expected: PASS, 타입 오류 없음

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/lib/platform.ts apps/web/src/lib/platform.test.ts apps/web/src/auth/KakaoBlock.tsx apps/web/src/auth/KakaoBlock.test.tsx apps/web/src/auth/LoginPanel.tsx apps/web/src/auth/LoginPanel.test.tsx apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "카톡 안 로그인 화면에 바깥 브라우저 길 더하기"
```

---

### Task 6: 화면 — 아이폰 홈 화면 앱 안의 로그인

**Files:**
- Create: `apps/web/src/auth/popup-login.ts`, `apps/web/src/auth/popup-login.test.ts`
- Create: `apps/web/src/auth/AuthDone.tsx`, `apps/web/src/auth/AuthDone.test.tsx`
- Modify: `apps/web/src/auth/LoginPanel.tsx`, `apps/web/src/auth/LoginPanel.test.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/main.tsx` (`/auth-done` 화면)
- Modify: `apps/api/src/web.ts`, `apps/api/src/web.test.ts` (`/auth-done` 진입점)

**Interfaces:**
- Consumes: `isIosHomeScreenApp` (Task 5), `authClient.signIn.social` (better-auth 1.7.6, `disableRedirect: true`이면 `{ data: { url, redirect: false } }`를 돌려주고 화면을 옮기지 않는다)
- Produces:
  - `AUTH_CHANNEL = 'vada-auth'`, `AUTH_DONE_PATH = '/auth-done'`
  - `startPopupLogin(open: () => Opened, signIn: SignIn): Promise<'opened' | 'blocked' | 'failed'>`
  - `finishPopupLogin(channel: { postMessage(message: string): void; close(): void } | null, closeWindow: () => void): void`
  - `AuthDone` (기본 내보내기) `{ failed: boolean }`
  - `LoginPanel` props: `{ kakao; homeScreenApp: boolean; busy; onLogin; onLoginInApp: () => void }`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`apps/web/src/auth/popup-login.test.ts`:

```ts
import { expect, test, vi } from 'vitest'
import { finishPopupLogin, startPopupLogin } from './popup-login'

const popupOf = () => ({ location: { href: 'about:blank' }, close: vi.fn() })

test('누른 순간 앱 안 창을 먼저 열고, 받은 Google 주소로 그 창을 보낸다', async () => {
  const order: string[] = []
  const popup = popupOf()
  const result = await startPopupLogin(() => { order.push('open'); return popup },
    async () => { order.push('sign-in'); return { data: { url: 'https://accounts.google.com/o/oauth2/auth?x=1' }, error: null } })
  expect(order).toEqual(['open', 'sign-in'])
  expect(result).toBe('opened')
  expect(popup.location.href).toBe('https://accounts.google.com/o/oauth2/auth?x=1')
})

test('창이 막히면 로그인을 시작하지 않는다', async () => {
  const signIn = vi.fn(async () => ({ data: { url: 'https://accounts.google.com/' }, error: null }))
  expect(await startPopupLogin(() => null, signIn)).toBe('blocked')
  expect(signIn).not.toHaveBeenCalled()
})

test('Google 주소를 받지 못하면 연 창을 닫는다', async () => {
  for (const signIn of [
    async () => ({ data: null, error: { status: 500 } }),
    async () => ({ data: {}, error: null }),
    async () => { throw new Error('network') },
  ]) {
    const popup = popupOf()
    expect(await startPopupLogin(() => popup, signIn)).toBe('failed')
    expect(popup.close).toHaveBeenCalled()
  }
})

test('로그인이 끝난 창은 본 창에 알리고 닫는다', () => {
  const channel = { postMessage: vi.fn(), close: vi.fn() }
  const closeWindow = vi.fn()
  finishPopupLogin(channel, closeWindow)
  expect(channel.postMessage).toHaveBeenCalledWith('signed-in')
  expect(channel.close).toHaveBeenCalled()
  expect(closeWindow).toHaveBeenCalled()
  expect(() => finishPopupLogin(null, closeWindow)).not.toThrow()
})
```

`apps/web/src/auth/AuthDone.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import AuthDone from './AuthDone'
import { AUTH_CHANNEL } from './popup-login'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

test('로그인이 끝나면 본 창에 알리고 창을 닫는다', () => {
  const posted: [string, string][] = []
  vi.stubGlobal('BroadcastChannel', class {
    name: string
    constructor(name: string) { this.name = name }
    postMessage(message: string) { posted.push([this.name, message]) }
    close() {}
  })
  const close = vi.spyOn(window, 'close').mockImplementation(() => {})
  render(<AuthDone failed={false} />)
  expect(posted).toEqual([[AUTH_CHANNEL, 'signed-in']])
  expect(close).toHaveBeenCalled()
  expect(screen.getByText('로그인했어요. 이 창을 닫아 주세요.')).toBeTruthy()
})

test('로그인이 실패하면 알리지 않고 안내만 한다', () => {
  const posted: string[] = []
  vi.stubGlobal('BroadcastChannel', class {
    postMessage(message: string) { posted.push(message) }
    close() {}
  })
  render(<AuthDone failed />)
  expect(posted).toEqual([])
  expect(screen.getByText('로그인이 완료되지 않았어요. 이 창을 닫고 다시 시도해 주세요.')).toBeTruthy()
})
```

`apps/web/src/auth/LoginPanel.test.tsx`를 다음으로 바꾼다:

```tsx
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import LoginPanel from './LoginPanel'

afterEach(cleanup)
const handlers = () => ({ onLogin: vi.fn(), onLoginInApp: vi.fn() })

test('카카오톡 안에서는 Google 로그인 대신 바깥 브라우저로 가는 길을 보여 준다', () => {
  render(<LoginPanel kakao homeScreenApp={false} busy={false} {...handlers()} />)
  expect(screen.getByRole('button', { name: '바깥 브라우저로 열기' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Google로 로그인' })).toBeNull()
})

test('바깥 브라우저에서는 Google 로그인을 부르고, 로그인 중에는 막는다', () => {
  const props = handlers()
  const view = render(<LoginPanel kakao={false} homeScreenApp={false} busy={false} {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
  expect(props.onLogin).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: '다른 방법으로 로그인' })).toBeNull()
  view.rerender(<LoginPanel kakao={false} homeScreenApp={false} busy {...props} />)
  expect((screen.getByRole('button', { name: 'Google로 이동 중…' }) as HTMLButtonElement).disabled).toBe(true)
})

test('아이폰 홈 화면 앱은 앱 안 창 로그인을 기본으로, 지금 방식을 둘째로 둔다', () => {
  const props = handlers()
  render(<LoginPanel kakao={false} homeScreenApp busy={false} {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
  expect(props.onLoginInApp).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: '다른 방법으로 로그인' }))
  expect(props.onLogin).toHaveBeenCalledTimes(1)
  expect(screen.getByText('로그인이 안 되면 사파리에서 VADA에 로그인한 뒤, 홈 화면의 VADA를 지우고 다시 추가해 주세요.')).toBeTruthy()
})
```

`apps/web/src/App.test.tsx` 끝에 더한다:

```tsx
test('iOS home-screen app opens an in-app window before asking for the Google URL', async () => {
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
  const popup = { location: { href: 'about:blank' }, close: vi.fn() }
  const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
  auth.social.mockResolvedValue({ data: { url: 'https://accounts.google.com/x', redirect: false }, error: null })
  try {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
    expect(open).toHaveBeenCalledWith('about:blank', '_blank')
    await waitFor(() => expect(popup.location.href).toBe('https://accounts.google.com/x'))
    expect(auth.social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/auth-done', errorCallbackURL: '/auth-done?error=1', disableRedirect: true })
    expect(screen.getByRole('button', { name: '다른 방법으로 로그인' })).toBeTruthy()
  } finally {
    open.mockRestore()
    delete (navigator as { standalone?: boolean }).standalone
  }
})

test('iOS home-screen app rechecks the session when the login window reports back', () => {
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
  const listeners: (() => void)[] = []
  vi.stubGlobal('BroadcastChannel', class {
    set onmessage(listener: () => void) { listeners.push(listener) }
    postMessage() {}
    close() {}
  })
  try {
    render(<App />)
    expect(listeners).toHaveLength(1)
    listeners[0]!()
    expect(auth.refetch).toHaveBeenCalled()
  } finally {
    vi.unstubAllGlobals()
    delete (navigator as { standalone?: boolean }).standalone
  }
})
```

`apps/api/src/web.test.ts`의 진입점 목록 `for (const path of ['/apply/ABCD2345', '/r'])`를 `for (const path of ['/apply/ABCD2345', '/r', '/auth-done'])`로 바꾼다.

- [ ] **Step 2: 테스트가 실패하는지 본다**

Run: `cd apps/web && npx vitest run src/auth src/App.test.tsx`
Expected: FAIL (`./popup-login`, `./AuthDone`이 없고, `LoginPanel`에 홈 화면 앱 길이 없다)

Run: `cd apps/api && npx tsx --test src/web.test.ts`
Expected: FAIL (`/auth-done`이 404)

- [ ] **Step 3: 앱 안 창 로그인과 완료 화면을 만든다**

`apps/web/src/auth/popup-login.ts`:

```ts
// iOS 홈 화면 앱은 사파리와 쿠키를 따로 쓴다. 앱 안에서 바깥 주소(Google)로 넘어가면 사파리 쪽 창에서 로그인이 끝나 앱은 모른다.
// Apple은 window.open으로 연 창은 홈 화면 앱 안에 머문다고 안내한다(WWDC23). 그래서 누른 순간 앱 안 창을 먼저 열고 그 창을 Google로 보낸다.
// 실제 기기에서 되는지는 확인 전이다(휴대폰 길 spec, 판단 절차 3).
export const AUTH_CHANNEL = 'vada-auth'
export const AUTH_DONE_PATH = '/auth-done'

type Opened = { location: { href: string }; close: () => void } | null
type SignIn = () => Promise<{ data?: { url?: string } | null; error?: unknown }>

export async function startPopupLogin(open: () => Opened, signIn: SignIn): Promise<'opened' | 'blocked' | 'failed'> {
  // 기다리기 전에 연다. 기다린 뒤에 열면 누른 동작이 아니어서 막힌다.
  const popup = open()
  if (!popup) return 'blocked'
  try {
    const result = await signIn()
    const url = result.data?.url
    if (result.error || !url) throw new Error('Sign-in URL missing')
    popup.location.href = url
    return 'opened'
  } catch {
    popup.close()
    return 'failed'
  }
}

// 로그인이 끝난 창(/auth-done)이 본 창에 알리고 스스로 닫는다.
export function finishPopupLogin(channel: { postMessage: (message: string) => void; close: () => void } | null, closeWindow: () => void) {
  channel?.postMessage('signed-in')
  channel?.close()
  closeWindow()
}
```

`apps/web/src/auth/AuthDone.tsx`:

```tsx
import { useEffect } from 'react'
import { AuthCard } from '@/components/AuthCard'
import { AUTH_CHANNEL, finishPopupLogin } from './popup-login'

// 홈 화면 앱 안 창에서 Google 로그인이 끝나면 오는 곳. 본 창에 알리고 닫는다. 닫히지 않으면 안내만 남는다.
export default function AuthDone({ failed }: { failed: boolean }) {
  useEffect(() => {
    if (failed) return
    finishPopupLogin(typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(AUTH_CHANNEL), () => window.close())
  }, [failed])
  return <main className="flex min-h-dvh items-center justify-center p-4">
    <AuthCard>
      <p className="text-sm text-gray-900">{failed ? '로그인이 완료되지 않았어요. 이 창을 닫고 다시 시도해 주세요.' : '로그인했어요. 이 창을 닫아 주세요.'}</p>
    </AuthCard>
  </main>
}
```

`apps/web/src/auth/LoginPanel.tsx`를 다음으로 바꾼다:

```tsx
import { Button } from '@/components/ui/button'
import KakaoBlock from './KakaoBlock'

type Props = { kakao: boolean; homeScreenApp: boolean; busy: boolean; onLogin: () => void; onLoginInApp: () => void }

// 로그인 화면의 가운데. 카카오톡 안에서는 Google 로그인이 막히므로 버튼 대신 바깥 브라우저로 넘어가는 길을 보여 준다.
// iOS 홈 화면 앱은 앱 안 창 로그인을 기본으로, 지금처럼 넘기는 로그인을 둘째로 둔다. 둘 다 안 될 때의 길도 늘 적어 둔다.
export default function LoginPanel({ kakao, homeScreenApp, busy, onLogin, onLoginInApp }: Props) {
  if (kakao) return <KakaoBlock />
  const label = busy ? 'Google로 이동 중…' : 'Google로 로그인'
  if (homeScreenApp) return <div className="flex flex-col gap-3">
    <p className="text-sm text-gray-500">Google 계정으로 로그인해 주세요.</p>
    <Button disabled={busy} onClick={onLoginInApp}>{label}</Button>
    <Button variant="link" disabled={busy} onClick={onLogin}>다른 방법으로 로그인</Button>
    <p className="text-xs text-gray-500">로그인이 안 되면 사파리에서 VADA에 로그인한 뒤, 홈 화면의 VADA를 지우고 다시 추가해 주세요.</p>
  </div>
  return <div className="flex flex-col gap-3">
    <p className="text-sm text-gray-500">Google 계정으로 로그인해 주세요.</p>
    <Button disabled={busy} onClick={onLogin}>{label}</Button>
  </div>
}
```

- [ ] **Step 4: 앱과 진입점에 잇는다**

`apps/web/src/App.tsx`:

1. 첫 줄 `import { useState, type ReactNode } from 'react'`를 다음으로 바꾼다:
```ts
import { useEffect, useState, type ReactNode } from 'react'
```
2. `import LoginPanel from './auth/LoginPanel'` 아래에 더한다:
```ts
import { AUTH_CHANNEL, AUTH_DONE_PATH, startPopupLogin } from './auth/popup-login'
import { isIosHomeScreenApp } from '@/lib/platform'
```
3. `const [creating, setCreating] = useState(false)` 아래에 더한다:
```tsx
  const [homeScreenApp] = useState(() => isIosHomeScreenApp(navigator as { standalone?: boolean }))
  // iOS 홈 화면 앱: 로그인 창이 알리거나 앱이 다시 보이면 세션을 다시 읽는다.
  useEffect(() => {
    if (!homeScreenApp || session) return
    const recheck = () => { void refetch() }
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(AUTH_CHANNEL)
    if (channel) channel.onmessage = recheck
    const onVisible = () => { if (document.visibilityState === 'visible') recheck() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { channel?.close(); document.removeEventListener('visibilitychange', onVisible) }
  }, [homeScreenApp, session, refetch])
```
4. `async function logout() {` 바로 위에 더한다:
```tsx
  // iOS 홈 화면 앱: 누른 순간 앱 안 창을 열고 그 창에서 Google 로그인을 한다(휴대폰 길 spec 길 B).
  async function loginInApp() {
    setBusy(true)
    setMessage('')
    const result = await startPopupLogin(() => window.open('about:blank', '_blank'),
      () => authClient.signIn.social({ provider: 'google', callbackURL: AUTH_DONE_PATH, errorCallbackURL: `${AUTH_DONE_PATH}?error=1`, disableRedirect: true }))
    setBusy(false)
    if (result === 'blocked') setMessage('로그인 창을 열지 못했어요. 다른 방법으로 로그인해 주세요.')
    if (result === 'failed') setMessage('로그인을 시작하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')
  }
```
5. Task 5에서 넣은 `<LoginPanel … />` 줄을 다음으로 바꾼다:
```tsx
      <LoginPanel kakao={isKakaoInAppBrowser(navigator.userAgent)} homeScreenApp={homeScreenApp} busy={busy}
        onLogin={() => { void login() }} onLoginInApp={() => { void loginInApp() }} />
```

`apps/web/src/main.tsx`:

1. `import { publicRoute, shouldLeaveKakao } from './public/public-route'` 아래에 더한다:
```ts
import { AUTH_DONE_PATH } from './auth/popup-login'
```
2. `const PublicApp = lazy(() => import('./public/PublicApp'))` 아래에 더한다:
```ts
const AuthDone = lazy(() => import('./auth/AuthDone'))
```
3. `const route = publicRoute(window.location.pathname)` 아래부터 `createRoot` 전까지를 다음으로 바꾼다:
```tsx
// 홈 화면 앱 안 창에서 로그인이 끝나면 오는 곳이다(휴대폰 길 spec).
const authDone = window.location.pathname === AUTH_DONE_PATH
// 카카오톡에서 연 앱 링크는 구글 로그인이 막히므로 기본 브라우저로 넘긴다. 넘어가지 못해도 화면은 그린다.
if (!authDone && shouldLeaveKakao(route, navigator.userAgent)) openOutsideKakao(navigator.userAgent, window.location)
// 휴대폰 알림을 받을 서비스 워커. 로그인이 없는 공개 화면(참가 신청)에서는 등록하지 않는다.
if (route === null && !authDone) registerServiceWorker()
```
4. 렌더 부분을 다음으로 바꾼다:
```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>{authDone ? <AuthDone failed={new URLSearchParams(window.location.search).has('error')} />
      : route ? <PublicApp route={route} /> : <App />}</Suspense>
  </StrictMode>,
)
```

`apps/api/src/web.ts`의 진입점 목록 `['/', '/index.html', '/join/:code', '/apply/:code', '/r']`에 `'/auth-done'`을 더하고, 위 설명 주석 끝에 "홈 화면 앱 안 로그인이 끝나는 곳(/auth-done)도" 를 덧붙인다:

```ts
  // 초대 링크(/join/코드), 공개 참가 신청(/apply/코드), 내 신청(/r#토큰), 홈 화면 앱 안 로그인이 끝나는 곳(/auth-done)도 화면 진입점이다. 코드 검사는 화면이 API로 한다.
  app.on(['GET', 'HEAD'], ['/', '/index.html', '/join/:code', '/apply/:code', '/r', '/auth-done'], async (context, next) => {
```

- [ ] **Step 5: 테스트가 통과하는지 본다**

Run: `cd apps/web && npx vitest run src/auth src/App.test.tsx src/App.integration.test.tsx && npx tsc --noEmit`
Expected: PASS, 타입 오류 없음

Run: `cd apps/api && npx tsx --test src/web.test.ts`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/auth apps/web/src/App.tsx apps/web/src/App.test.tsx apps/web/src/main.tsx apps/api/src/web.ts apps/api/src/web.test.ts
git commit -m "아이폰 홈 화면 앱 안 로그인 길 더하기"
```

---

### Task 7: 화면 — 휴대폰 알림 대화상자

**Files:**
- Create: `apps/web/src/push/push-state.ts`, `apps/web/src/push/push-state.test.ts`
- Create: `apps/web/src/push/push-client.ts`, `apps/web/src/push/push-client.test.ts`
- Create: `apps/web/src/push/usePush.ts`
- Create: `apps/web/src/push/PushPanel.tsx`
- Create: `apps/web/src/push/PushSettings.tsx`, `apps/web/src/push/PushSettings.test.tsx`
- Modify: `apps/web/src/workspace/WorkspaceSidebar.tsx` (아래 줄에 종 버튼)
- Modify: `apps/web/src/ui-gallery/Gallery.tsx`, `apps/web/src/ui-gallery/Gallery.test.tsx`

**Interfaces:**
- Consumes: `PushKeyResponse`, `PushTestResponse`, `PushTestResult` (Task 1), 서버 경로 (Task 3), `/sw.js` (Task 4), `Device`, `deviceOf`, `isIosHomeScreenApp` (Task 5)
- Produces:
  - `type PushState = 'needs-home-screen' | 'unsupported' | 'loading' | 'failed' | 'server-off' | 'denied' | 'on' | 'ask'`
  - `pushStateOf(facts: PushFacts): PushState`
  - `type BrowserSubscription`, `type BrowserPushManager`, `type PushBrowser`, `browserPush()`, `base64UrlToBytes(value)`, `sameKey(subscription, key)`, `withTimeout(promise, ms)`, `READY_TIMEOUT_MS = 10_000`
  - `type PushTest`, `type PushEnvironment`, `currentEnvironment()`, `usePush(environment)`
  - `PushPanel` (기본 내보내기, API 호출 없음), `PushSettingsButton` (기본 내보내기), `PushSettingsBody` `{ environment?: PushEnvironment }`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`apps/web/src/push/push-state.test.ts`:

```ts
import { expect, test } from 'vitest'
import { pushStateOf, type PushFacts } from './push-state'

const base: PushFacts = { device: 'android', homeScreenApp: false, supported: true, server: 'ready', permission: 'default', subscribed: false }

test('기기, 브라우저, 서버, 허락, 구독으로 한 가지 상태를 정한다', () => {
  expect(pushStateOf({ ...base, device: 'ios' })).toBe('needs-home-screen')
  expect(pushStateOf({ ...base, device: 'ios', homeScreenApp: true })).toBe('ask')
  expect(pushStateOf({ ...base, supported: false })).toBe('unsupported')
  expect(pushStateOf({ ...base, device: 'ios', supported: false })).toBe('needs-home-screen')
  expect(pushStateOf({ ...base, server: 'loading' })).toBe('loading')
  expect(pushStateOf({ ...base, server: 'failed' })).toBe('failed')
  expect(pushStateOf({ ...base, server: 'off' })).toBe('server-off')
  expect(pushStateOf({ ...base, permission: 'denied' })).toBe('denied')
  expect(pushStateOf({ ...base, permission: 'granted' })).toBe('ask')
  expect(pushStateOf({ ...base, permission: 'granted', subscribed: true })).toBe('on')
  expect(pushStateOf({ ...base, permission: 'default', subscribed: true })).toBe('ask')
})
```

`apps/web/src/push/push-client.test.ts`:

```ts
import { afterEach, expect, test, vi } from 'vitest'
import { base64UrlToBytes, sameKey, withTimeout, type BrowserSubscription } from './push-client'

afterEach(() => { vi.useRealTimers() })

test('URL용 base64 열쇠를 바이트로 바꾼다', () => {
  expect([...base64UrlToBytes('AQID')]).toEqual([1, 2, 3])
  expect([...base64UrlToBytes('-_8')]).toEqual([251, 255])
  expect(base64UrlToBytes('B'.repeat(87))).toHaveLength(65)
})

test('구독의 열쇠가 서버 열쇠와 같은지 본다', () => {
  const key = Uint8Array.from([4, 1, 2])
  const subscription = (bytes: number[] | null): BrowserSubscription => ({
    endpoint: 'https://fcm.googleapis.com/x',
    options: { applicationServerKey: bytes ? Uint8Array.from(bytes).buffer : null },
    toJSON: () => ({}),
    unsubscribe: async () => true,
  })
  expect(sameKey(subscription([4, 1, 2]), key)).toBe(true)
  expect(sameKey(subscription([4, 1, 3]), key)).toBe(false)
  expect(sameKey(subscription([4, 1]), key)).toBe(false)
  expect(sameKey(subscription(null), key)).toBe(false)
})

test('끝나지 않는 기다림은 시간이 지나면 실패한다', async () => {
  vi.useFakeTimers()
  const outcome = withTimeout(new Promise(() => {}), 10_000).then(() => 'resolved', () => 'timed out')
  await vi.advanceTimersByTimeAsync(10_000)
  expect(await outcome).toBe('timed out')
  vi.useRealTimers()
  expect(await withTimeout(Promise.resolve('ok'), 10_000)).toBe('ok')
})
```

`apps/web/src/push/PushSettings.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import type { BrowserPushManager, BrowserSubscription, PushBrowser } from './push-client'
import PushSettingsButton, { PushSettingsBody } from './PushSettings'
import type { PushEnvironment } from './usePush'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const KEY = 'BAECAw' // [4, 1, 2, 3]
const keyBytes = Uint8Array.from([4, 1, 2, 3])

function subscriptionOf(key: Uint8Array, endpoint = 'https://fcm.googleapis.com/fcm/send/abc') {
  return {
    endpoint,
    options: { applicationServerKey: key.slice().buffer },
    toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } }),
    unsubscribe: vi.fn(async () => true),
  } satisfies BrowserSubscription
}

type Options = { device?: PushEnvironment['device']; homeScreenApp?: boolean; supported?: boolean; permission?: NotificationPermission
  existing?: BrowserSubscription | null; subscribe?: () => Promise<BrowserSubscription>; manager?: () => Promise<BrowserPushManager> }

function environment(options: Options = {}) {
  let permission = options.permission ?? 'default'
  const subscribe = vi.fn(options.subscribe ?? (async () => { permission = 'granted'; return subscriptionOf(keyBytes) }))
  const browser: PushBrowser = {
    supported: options.supported ?? true,
    permission: () => permission,
    pushManager: options.manager ?? (async () => ({ getSubscription: async () => options.existing ?? null, subscribe })),
  }
  const env: PushEnvironment = { browser, device: options.device ?? 'android', homeScreenApp: options.homeScreenApp ?? false }
  return { env, subscribe }
}

function serverWithKey() {
  const api = mockApi()
  api.on('GET', '/api/me/push', () => json({ publicKey: KEY }))
  return api
}

test('아이폰 사파리에서는 홈 화면에 추가하는 법을 보여 주고 서버를 부르지 않는다', () => {
  const api = mockApi()
  render(<PushSettingsBody environment={environment({ device: 'ios' }).env} />)
  expect(screen.getByText('아이폰은 홈 화면에 추가해야 알림을 받아요.')).toBeTruthy()
  expect(screen.getByText('로그인한 채로 추가하면 다시 로그인하지 않아도 돼요.')).toBeTruthy()
  expect(api.calls).toEqual([])
})

test('알림 API가 없는 브라우저는 받을 수 없다고 알린다', () => {
  mockApi()
  render(<PushSettingsBody environment={environment({ supported: false }).env} />)
  expect(screen.getByText('이 브라우저는 알림을 받을 수 없어요. Chrome이나 삼성 인터넷으로 열어 주세요.')).toBeTruthy()
})

test('서버에 알림 열쇠가 없으면 아직 쓸 수 없다고 알린다', async () => {
  const api = mockApi()
  api.on('GET', '/api/me/push', () => json({ error: 'NOT_FOUND' }, 404))
  render(<PushSettingsBody environment={environment().env} />)
  expect(await screen.findByText('아직 알림을 쓸 수 없어요.')).toBeTruthy()
  api.assertNoUnexpectedRequests()
})

test('서비스 워커가 준비되지 않으면 불러오지 못했다고 알리고 다시 시도할 수 있다', async () => {
  serverWithKey()
  let attempts = 0
  const { env } = environment({ manager: async () => { attempts++; throw new Error('Timed out') } })
  render(<PushSettingsBody environment={env} />)
  expect(await screen.findByText('알림 설정을 불러오지 못했어요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  await waitFor(() => expect(attempts).toBe(2))
})

test('알림 켜기는 누른 동작 안에서 기다림 없이 구독하고, 켜지면 시험 알림 버튼을 보여 준다', async () => {
  serverWithKey()
  const { env, subscribe } = environment()
  render(<PushSettingsBody environment={env} />)
  fireEvent.click(await screen.findByRole('button', { name: '알림 켜기' }))
  expect(subscribe).toHaveBeenCalledTimes(1)
  expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: keyBytes })
  expect(await screen.findByText('이 기기에서 알림을 받아요.')).toBeTruthy()
})

test('허락 창을 닫아 구독이 실패하면 다시 누를 수 있게 알린다', async () => {
  serverWithKey()
  const { env } = environment({ subscribe: async () => { throw new DOMException('dismissed', 'NotAllowedError') } })
  render(<PushSettingsBody environment={env} />)
  fireEvent.click(await screen.findByRole('button', { name: '알림 켜기' }))
  expect(await screen.findByText('알림을 켜지 못했어요. 다시 눌러 주세요.')).toBeTruthy()
  expect(screen.getByRole('button', { name: '알림 켜기' })).toBeTruthy()
})

test('거절했으면 기기별로 다시 켜는 곳을 알려 준다', async () => {
  serverWithKey()
  render(<PushSettingsBody environment={environment({ device: 'ios', homeScreenApp: true, permission: 'denied' }).env} />)
  expect(await screen.findByText('알림이 꺼져 있어요. 설정 → 알림 → VADA에서 켜 주세요.')).toBeTruthy()
})

test('서버 열쇠가 바뀐 옛 구독은 켜기 전으로 보고, 켜면 지운 뒤 다시 구독한다', async () => {
  serverWithKey()
  const old = subscriptionOf(Uint8Array.from([4, 9, 9, 9]))
  const { env, subscribe } = environment({ permission: 'granted', existing: old })
  render(<PushSettingsBody environment={env} />)
  fireEvent.click(await screen.findByRole('button', { name: '알림 켜기' }))
  await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1))
  expect(old.unsubscribe).toHaveBeenCalled()
  expect(await screen.findByText('이 기기에서 알림을 받아요.')).toBeTruthy()
})

test('시험 알림은 구독을 보내고, 보내는 동안 버튼을 막아 한 번만 보낸다', async () => {
  const api = serverWithKey()
  const pending = deferredResponse()
  api.on('POST', '/api/me/push/test', () => pending.promise)
  const existing = subscriptionOf(keyBytes)
  render(<PushSettingsBody environment={environment({ permission: 'granted', existing }).env} />)
  const button = await screen.findByRole('button', { name: '시험 알림 보내기' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(await screen.findByText('5초 뒤에 알림이 와요. 화면을 끄거나 홈으로 나가 기다려 보세요.')).toBeTruthy()
  expect((screen.getByRole('button', { name: '시험 알림 보내기' }) as HTMLButtonElement).disabled).toBe(true)
  pending.resolve(json({ result: 'sent' }))
  expect(await screen.findByText('보냈어요. 알림이 왔는지 확인해 주세요.')).toBeTruthy()
  const posts = api.calls.filter(call => call.method === 'POST')
  expect(posts).toHaveLength(1)
  expect(posts[0]!.body).toEqual(existing.toJSON())
})

test('구독이 끝났으면 지우고 다시 켜게 한다', async () => {
  const api = serverWithKey()
  api.on('POST', '/api/me/push/test', () => json({ result: 'expired' }))
  const existing = subscriptionOf(keyBytes)
  render(<PushSettingsBody environment={environment({ permission: 'granted', existing }).env} />)
  fireEvent.click(await screen.findByRole('button', { name: '시험 알림 보내기' }))
  expect(await screen.findByText('이 기기의 알림 등록이 끝났어요. 알림을 다시 켜 주세요.')).toBeTruthy()
  expect(existing.unsubscribe).toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '알림 켜기' })).toBeTruthy()
})

test('알림 서버가 받지 않으면 그렇게 알린다', async () => {
  const api = serverWithKey()
  api.on('POST', '/api/me/push/test', () => json({ result: 'rejected' }))
  render(<PushSettingsBody environment={environment({ permission: 'granted', existing: subscriptionOf(keyBytes) }).env} />)
  fireEvent.click(await screen.findByRole('button', { name: '시험 알림 보내기' }))
  expect(await screen.findByText('알림 서버가 받지 않았어요.')).toBeTruthy()
})

test('서버가 모르는 알림 서버면 그 호스트를 보여 준다', async () => {
  const api = serverWithKey()
  api.on('POST', '/api/me/push/test', () => json({ error: 'PUSH_SERVICE_UNSUPPORTED' }, 400))
  const existing = subscriptionOf(keyBytes, 'https://push.samsung.example/abc')
  render(<PushSettingsBody environment={environment({ permission: 'granted', existing }).env} />)
  fireEvent.click(await screen.findByRole('button', { name: '시험 알림 보내기' }))
  expect(await screen.findByText('이 브라우저의 알림 서버(push.samsung.example)는 아직 받지 않아요.')).toBeTruthy()
})

test('기다리는 동안 화면을 꺼서 요청이 끊기면 실패 대신 모른다고 알린다', async () => {
  const api = serverWithKey()
  const pending = deferredResponse()
  api.on('POST', '/api/me/push/test', () => pending.promise.then(() => { throw new TypeError('Load failed') }))
  render(<PushSettingsBody environment={environment({ permission: 'granted', existing: subscriptionOf(keyBytes) }).env} />)
  fireEvent.click(await screen.findByRole('button', { name: '시험 알림 보내기' }))
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  document.dispatchEvent(new Event('visibilitychange'))
  visibility.mockReturnValue('visible')
  pending.resolve(json({}))
  expect(await screen.findByText('결과를 받지 못했어요. 알림이 왔다면 잘 된 거예요.')).toBeTruthy()
})

test('화면을 끄지 않았는데 요청이 실패하면 연결을 확인하라고 한다', async () => {
  const api = serverWithKey()
  api.on('POST', '/api/me/push/test', () => json({ error: 'Internal server error' }, 500))
  render(<PushSettingsBody environment={environment({ permission: 'granted', existing: subscriptionOf(keyBytes) }).env} />)
  fireEvent.click(await screen.findByRole('button', { name: '시험 알림 보내기' }))
  expect(await screen.findByText('시험 알림을 보내지 못했어요. 연결을 확인해 주세요.')).toBeTruthy()
})

test('종 버튼을 눌러야 대화상자를 열고, 그 전에는 서버를 부르지 않는다', async () => {
  const api = mockApi()
  render(<PushSettingsButton />)
  expect(api.calls).toEqual([])
  fireEvent.click(screen.getByRole('button', { name: '휴대폰 알림' }))
  expect(await screen.findByRole('dialog', { name: '휴대폰 알림' })).toBeTruthy()
  api.assertNoUnexpectedRequests()
})
```

- [ ] **Step 2: 테스트가 실패하는지 본다**

Run: `cd apps/web && npx vitest run src/push`
Expected: FAIL (모듈이 없다)

- [ ] **Step 3: 상태 계산과 브라우저 감싸기를 만든다**

`apps/web/src/push/push-state.ts`:

```ts
import type { Device } from '@/lib/platform'

// 휴대폰 알림 대화상자가 보여 줄 상태(휴대폰 길 spec의 표). 위에서부터 먼저 맞는 것을 고른다.
export type PushState = 'needs-home-screen' | 'unsupported' | 'loading' | 'failed' | 'server-off' | 'denied' | 'on' | 'ask'
export type PushFacts = {
  device: Device
  homeScreenApp: boolean
  // 서비스 워커, PushManager, Notification이 모두 있다.
  supported: boolean
  server: 'loading' | 'failed' | 'off' | 'ready'
  permission: NotificationPermission
  // 구독이 있고 그 구독의 열쇠가 서버 열쇠와 같다.
  subscribed: boolean
}

export function pushStateOf(facts: PushFacts): PushState {
  if (facts.device === 'ios' && !facts.homeScreenApp) return 'needs-home-screen'
  if (!facts.supported) return 'unsupported'
  if (facts.server === 'off') return 'server-off'
  if (facts.server !== 'ready') return facts.server
  if (facts.permission === 'denied') return 'denied'
  return facts.permission === 'granted' && facts.subscribed ? 'on' : 'ask'
}
```

`apps/web/src/push/push-client.ts`:

```ts
// 브라우저의 알림 API를 감싼다. 화면은 이 모양만 쓰고, 테스트는 가짜로 바꿔 끼운다.
export type BrowserSubscription = {
  endpoint: string
  options: { applicationServerKey: ArrayBuffer | null }
  toJSON: () => PushSubscriptionJSON
  unsubscribe: () => Promise<boolean>
}
export type BrowserPushManager = {
  getSubscription: () => Promise<BrowserSubscription | null>
  subscribe: (options: { userVisibleOnly: true; applicationServerKey: Uint8Array }) => Promise<BrowserSubscription>
}
export type PushBrowser = {
  supported: boolean
  permission: () => NotificationPermission
  pushManager: () => Promise<BrowserPushManager>
}

export const READY_TIMEOUT_MS = 10_000

// 서비스 워커가 준비되지 않으면(사생활 보호 모드, 등록 실패) ready가 끝나지 않는다. 기다림에 상한을 둔다.
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out')), ms)
    promise.then(value => { clearTimeout(timer); resolve(value) }, error => { clearTimeout(timer); reject(error) })
  })
}

export function browserPush(): PushBrowser {
  const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    && typeof PushManager !== 'undefined' && typeof Notification !== 'undefined'
  return {
    supported,
    permission: () => Notification.permission,
    pushManager: async () => {
      await navigator.serviceWorker.register('/sw.js')
      const registration = await withTimeout(navigator.serviceWorker.ready, READY_TIMEOUT_MS)
      return registration.pushManager as unknown as BrowserPushManager
    },
  }
}

// 서버 열쇠(VAPID 공개 열쇠)는 URL용 base64다. subscribe는 바이트를 받는다.
export function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0))
}

// 구독이 지금 서버 열쇠로 만든 것인지. 서버 열쇠가 바뀌면 옛 구독으로는 보낼 수 없다.
export function sameKey(subscription: BrowserSubscription, key: Uint8Array) {
  const current = subscription.options.applicationServerKey
  if (!current || current.byteLength !== key.length) return false
  const bytes = new Uint8Array(current)
  return bytes.every((byte, index) => byte === key[index])
}
```

Run: `cd apps/web && npx vitest run src/push/push-state.test.ts src/push/push-client.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 4: 데이터 훅, 화면, 버튼을 만든다**

`apps/web/src/push/usePush.ts`:

```ts
import { useEffect, useRef, useState } from 'react'
import type { PushKeyResponse, PushTestResponse, PushTestResult } from '@vada/contracts'
import { deviceOf, isIosHomeScreenApp, type Device } from '@/lib/platform'
import { base64UrlToBytes, browserPush, sameKey, type BrowserPushManager, type BrowserSubscription, type PushBrowser } from './push-client'
import { pushStateOf } from './push-state'

export type PushTest = { kind: 'idle' } | { kind: 'sending' } | { kind: 'result'; result: PushTestResult }
  | { kind: 'unsupported-service'; host: string } | { kind: 'failed' } | { kind: 'unknown' }
export type PushEnvironment = { browser: PushBrowser; device: Device; homeScreenApp: boolean }

export const currentEnvironment = (): PushEnvironment => ({
  browser: browserPush(),
  device: deviceOf(navigator.userAgent, navigator.maxTouchPoints),
  homeScreenApp: isIosHomeScreenApp(navigator as { standalone?: boolean }),
})

type Server = { kind: 'loading' } | { kind: 'failed' } | { kind: 'off' } | { kind: 'ready'; key: Uint8Array; manager: BrowserPushManager }

// 휴대폰 알림 대화상자의 데이터. 열 때 서버 열쇠와 서비스 워커 등록을 미리 받아 두어,
// '알림 켜기'를 누른 동작 안에서 기다림 없이 구독한다(아이폰은 누른 동작 안에서만 허락을 묻는다).
export function usePush({ browser, device, homeScreenApp }: PushEnvironment) {
  const [server, setServer] = useState<Server>({ kind: 'loading' })
  const [subscription, setSubscription] = useState<BrowserSubscription | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>(() => browser.supported ? browser.permission() : 'default')
  const [enableFailed, setEnableFailed] = useState(false)
  const [test, setTest] = useState<PushTest>({ kind: 'idle' })
  const [attempt, setAttempt] = useState(0)
  const sending = useRef(false)
  const blocked = (device === 'ios' && !homeScreenApp) || !browser.supported

  useEffect(() => {
    if (blocked) return
    let cancelled = false
    setServer({ kind: 'loading' })
    async function load() {
      try {
        const response = await fetch('/api/me/push', { credentials: 'same-origin', cache: 'no-store' })
        if (response.status === 404) {
          if (!cancelled) setServer({ kind: 'off' })
          return
        }
        if (!response.ok) throw new Error('Push key failed')
        const { publicKey } = await response.json() as PushKeyResponse
        const manager = await browser.pushManager()
        const existing = await manager.getSubscription()
        if (cancelled) return
        setSubscription(existing)
        setServer({ kind: 'ready', key: base64UrlToBytes(publicKey), manager })
      } catch {
        if (!cancelled) setServer({ kind: 'failed' })
      }
    }
    void load()
    return () => { cancelled = true }
  }, [blocked, browser, attempt])

  const ready = server.kind === 'ready' ? server : null
  const subscribed = Boolean(subscription && ready && sameKey(subscription, ready.key))
  const state = pushStateOf({ device, homeScreenApp, supported: browser.supported, server: server.kind, permission, subscribed })

  // 열쇠가 바뀐 옛 구독은 지우고 다시 만든다. 옛 구독이 있었다면 이미 허락했으므로 다시 묻지 않는다.
  function enable() {
    if (!ready) return
    setEnableFailed(false)
    setTest({ kind: 'idle' })
    const options = { userVisibleOnly: true as const, applicationServerKey: ready.key }
    const stale = subscription && !sameKey(subscription, ready.key) ? subscription : null
    const subscribing = stale ? stale.unsubscribe().then(() => ready.manager.subscribe(options)) : ready.manager.subscribe(options)
    subscribing.then(next => {
      setSubscription(next)
      setPermission(browser.permission())
    }, () => {
      setPermission(browser.permission())
      setEnableFailed(true)
    })
  }

  // 5초를 기다리는 동안 화면을 끄면 iOS가 요청을 끊을 수 있다. 그때의 실패는 '모름'으로 보여 준다.
  async function sendTest() {
    if (!subscription || sending.current) return
    sending.current = true
    setTest({ kind: 'sending' })
    let hidden = false
    const onVisibility = () => { if (document.visibilityState === 'hidden') hidden = true }
    document.addEventListener('visibilitychange', onVisibility)
    try {
      const response = await fetch('/api/me/push/test', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription.toJSON()) })
      if (response.status === 400 && (await response.json() as { error?: string }).error === 'PUSH_SERVICE_UNSUPPORTED') {
        setTest({ kind: 'unsupported-service', host: new URL(subscription.endpoint).host })
        return
      }
      if (!response.ok) throw new Error('Push test failed')
      const { result } = await response.json() as PushTestResponse
      if (result === 'expired') {
        await subscription.unsubscribe().catch(() => false)
        setSubscription(null)
      }
      setTest({ kind: 'result', result })
    } catch {
      setTest({ kind: hidden ? 'unknown' : 'failed' })
    } finally {
      document.removeEventListener('visibilitychange', onVisibility)
      sending.current = false
    }
  }

  return { state, device, test, enableFailed, enable, sendTest, retry: () => setAttempt(value => value + 1) }
}
```

`apps/web/src/push/PushPanel.tsx`:

```tsx
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import type { Device } from '@/lib/platform'
import type { PushState } from './push-state'
import type { PushTest } from './usePush'

type Props = { state: PushState; device: Device; test: PushTest; enableFailed: boolean
  onEnable: () => void; onTest: () => void; onRetry: () => void }

const resultText = {
  sent: '보냈어요. 알림이 왔는지 확인해 주세요.',
  expired: '이 기기의 알림 등록이 끝났어요. 알림을 다시 켜 주세요.',
  rejected: '알림 서버가 받지 않았어요.',
} as const
const deniedHelp = {
  ios: '설정 → 알림 → VADA에서 켜 주세요.',
  android: '브라우저 메뉴의 사이트 설정 → 알림에서 VADA를 허용해 주세요.',
  other: '브라우저의 사이트 설정에서 알림을 허용해 주세요.',
} as const

// 휴대폰 알림 대화상자의 내용. 상태마다 한 가지만 보여 준다(휴대폰 길 spec의 표). API를 부르지 않는다.
export default function PushPanel({ state, device, test, enableFailed, onEnable, onTest, onRetry }: Props) {
  return <div className="flex flex-col gap-3 text-sm text-gray-700">
    {state === 'loading' && <StateMessage kind="loading">알림 설정을 확인하는 중…</StateMessage>}
    {state === 'needs-home-screen' && <>
      <p className="text-gray-900">아이폰은 홈 화면에 추가해야 알림을 받아요.</p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>아래쪽 공유 버튼을 눌러요.</li>
        <li>'홈 화면에 추가'를 눌러요.</li>
        <li>홈 화면의 VADA로 열어요.</li>
      </ol>
      <p className="text-xs text-gray-500">로그인한 채로 추가하면 다시 로그인하지 않아도 돼요.</p>
    </>}
    {state === 'unsupported' && <p>이 브라우저는 알림을 받을 수 없어요.{device === 'ios'
      ? ' iOS 16.4 이상에서 홈 화면의 VADA로 열어 주세요.' : ' Chrome이나 삼성 인터넷으로 열어 주세요.'}</p>}
    {state === 'server-off' && <p>아직 알림을 쓸 수 없어요.</p>}
    {state === 'failed' && <>
      <StateMessage kind="error">알림 설정을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={onRetry}>다시 시도</Button>
    </>}
    {state === 'ask' && <Button className="self-start" onClick={onEnable}>알림 켜기</Button>}
    {state === 'ask' && enableFailed && <StateMessage kind="error">알림을 켜지 못했어요. 다시 눌러 주세요.</StateMessage>}
    {state === 'denied' && <p>알림이 꺼져 있어요. {deniedHelp[device]}</p>}
    {state === 'on' && <>
      <p className="text-gray-900">이 기기에서 알림을 받아요.</p>
      <Button variant="outline" className="self-start" disabled={test.kind === 'sending'} onClick={onTest}>시험 알림 보내기</Button>
    </>}
    {test.kind === 'sending' && <StateMessage kind="notice">5초 뒤에 알림이 와요. 화면을 끄거나 홈으로 나가 기다려 보세요.</StateMessage>}
    {test.kind === 'result' && <StateMessage kind={test.result === 'sent' ? 'notice' : 'error'}>{resultText[test.result]}</StateMessage>}
    {test.kind === 'unsupported-service' && <StateMessage kind="error">이 브라우저의 알림 서버({test.host})는 아직 받지 않아요.</StateMessage>}
    {test.kind === 'failed' && <StateMessage kind="error">시험 알림을 보내지 못했어요. 연결을 확인해 주세요.</StateMessage>}
    {test.kind === 'unknown' && <StateMessage kind="notice">결과를 받지 못했어요. 알림이 왔다면 잘 된 거예요.</StateMessage>}
  </div>
}
```

`apps/web/src/push/PushSettings.tsx`:

```tsx
import { useState } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import PushPanel from './PushPanel'
import { currentEnvironment, usePush, type PushEnvironment } from './usePush'

// 대화상자를 열었을 때만 그린다. 그래야 열기 전에는 서버를 부르지 않는다.
export function PushSettingsBody({ environment }: { environment?: PushEnvironment }) {
  const [env] = useState(() => environment ?? currentEnvironment())
  const push = usePush(env)
  return <PushPanel state={push.state} device={push.device} test={push.test} enableFailed={push.enableFailed}
    onEnable={push.enable} onTest={() => { void push.sendTest() }} onRetry={push.retry} />
}

// 옆 메뉴 아래 종 모양 버튼. 휴대폰 알림을 켜고 시험한다(휴대폰 길 spec).
export default function PushSettingsButton() {
  const [open, setOpen] = useState(false)
  return <>
    <Button variant="ghost" size="icon" aria-label="휴대폰 알림" title="휴대폰 알림" onClick={() => setOpen(true)}><Bell /></Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>휴대폰 알림</DialogTitle>
          <DialogDescription>새 글과 부름을 휴대폰 알림으로 받아요.</DialogDescription></DialogHeader>
        {open && <PushSettingsBody />}
      </DialogContent>
    </Dialog>
  </>
}
```

`apps/web/src/workspace/WorkspaceSidebar.tsx`:

1. `import InviteShare from '../access/InviteShare'` 아래에 더한다:
```ts
import PushSettingsButton from '../push/PushSettings'
```
2. `<footer …>` 안의 로그아웃 버튼 바로 앞에 더한다:
```tsx
      <PushSettingsButton />
```

- [ ] **Step 5: 테스트가 통과하는지 본다**

Run: `cd apps/web && npx vitest run src/push src/workspace`
Expected: PASS (`push` 19 tests, 작업 공간 테스트 그대로 통과)

- [ ] **Step 6: 부품 확인 화면에 더한다**

`apps/web/src/ui-gallery/Gallery.tsx`:

1. 맨 위 import 끝에 더한다:
```ts
import PushPanel from '@/push/PushPanel'
```
2. `<Section title="상태 문구">…</Section>` 블록 바로 아래에 더한다:
```tsx
    <Section title="휴대폰 알림">
      {(['needs-home-screen', 'ask', 'on', 'denied'] as const).map(state =>
        <Card key={state} className="w-96 p-4"><PushPanel state={state} device="ios" enableFailed={false}
          test={state === 'on' ? { kind: 'result', result: 'sent' } : { kind: 'idle' }} onEnable={() => {}} onTest={() => {}} onRetry={() => {}} /></Card>)}
    </Section>
```

`apps/web/src/ui-gallery/Gallery.test.tsx`의 첫 테스트 이름 목록에서 `'상태 문구'` 뒤에 `'휴대폰 알림'`을 더한다.

Run: `cd apps/web && npx vitest run src/ui-gallery && npx tsc --noEmit`
Expected: PASS, 타입 오류 없음

Run: `npm run dev --workspace @vada/web` 후 `http://127.0.0.1:5180/ui.html`의 '휴대폰 알림' 묶음을 휴대폰 폭(390px)과 데스크톱 폭에서 본다.
Expected: 네 상태가 겹침 없이 보인다. 종료는 Ctrl+C.

- [ ] **Step 7: 커밋**

```bash
git add apps/web/src/push apps/web/src/workspace/WorkspaceSidebar.tsx apps/web/src/ui-gallery/Gallery.tsx apps/web/src/ui-gallery/Gallery.test.tsx
git commit -m "휴대폰 알림 대화상자 더하기"
```

---

### Task 8: 확인 기록 문서와 전체 검사

**Files:**
- Create: `docs/device-checks.md`

**Interfaces:**
- Consumes: Task 1~7 전체

- [ ] **Step 1: 실제 기기 확인 기록 문서를 만든다**

`docs/device-checks.md`:

```markdown
# 실제 기기 확인

휴대폰에서만 드러나는 동작을 실제 기기로 확인한 기록이다. 다시 만들기(`docs/superpowers/specs/2026-10-19-rebuild-design.md`)의 덩어리마다, 그리고 리허설 때 이어 쓴다.

결과는 됨 / 안 됨 / 해당 없음으로 적는다. 안 됐으면 무엇이 보였는지 적는다. 화면은 찍어 두되 커밋하지 않는다.

## 휴대폰 길 (덩어리 1)

절차는 `docs/superpowers/specs/2026-10-19-mobile-path-design.md`의 '흐름'을 따른다. 확인 전에 vada-m1에 휴대폰 길이 배포되어 있고, Render에 알림 열쇠 세 값이 있어야 한다. 안 됐을 때 무엇을 바꾸는지는 spec의 '실제 기기 확인' 표를 따른다.

### 기기

| 날짜 | 기기 | OS | 카톡 | 넘어간 브라우저 | 확인한 사람 |
|---|---|---|---|---|---|

### 아이폰

| 단계 | 결과 | 보인 것 |
|---|---|---|
| 1. 카톡 링크를 누르면 사파리로 넘어간다 | | |
| 2. 사파리에서 Google로 로그인한다 | | |
| 3. '휴대폰 알림'의 안내대로 홈 화면에 추가한다 | | |
| 4. 홈 화면의 VADA로 열면 로그인된 채 열린다 | | |
| 5. '알림 켜기'를 누르고 허락한다 | | |
| 6. 시험 알림이 잠금 화면에 뜨고, 누르면 VADA가 열린다 | | |
| 7. 로그아웃 뒤 홈 화면 앱 안에서 'Google로 로그인'(앱 안 창) | | |
| 7-1. 안 되면 '다른 방법으로 로그인' | | |

### 갤럭시

| 단계 | 결과 | 보인 것 |
|---|---|---|
| 1. 카톡 링크를 누르면 기본 브라우저로 넘어간다 | | |
| 2. Google로 로그인한다 | | |
| 3. '알림 켜기'를 누르고 허락한다 | | |
| 4. 시험 알림이 뜨고, 누르면 VADA가 열린다 | | |
| 5. (고르면) 홈 화면에 추가한다 | | |
```

- [ ] **Step 2: 전체 검사를 돌린다**

Run: `npm run typecheck`
Expected: 타입 오류 없음

Run: `npm test --workspace @vada/contracts`
Expected: PASS

Run: `cd apps/api && npx tsx --test --test-concurrency=2 $(node -p "require('./package.json').scripts.test.replace('tsx --test ', '')")`
Expected: PASS (실패 0)

Run: `npm test --workspace @vada/web`
Expected: PASS (실패 0)

Run: `npm run build`
Expected: 성공. `apps/web/dist`에 `sw.js`, `manifest.webmanifest`, `apple-touch-icon.png`, `icons/`가 있다.

- [ ] **Step 3: 배포 전에 데스크톱 Chrome으로 한 번 해 본다**

알림 열쇠는 이 확인에서만 쓰는 임시 값을 셸 안에서 만든다. `.env`를 읽거나 고치지 않는다.

Run(Git Bash, 저장소 맨 위):
```bash
eval "$(node -e "const k=require('web-push').generateVAPIDKeys();console.log('export VAPID_PUBLIC_KEY='+k.publicKey+' VAPID_PRIVATE_KEY='+k.privateKey)")"
export VAPID_SUBJECT=mailto:dev@vada.invalid
npm run dev:api
```
다른 셸에서 `npm run dev:web`을 띄운다.

Expected:
1. API 시작 줄에 `휴대폰 알림 켜짐 (Web Push)`가 찍힌다.
2. 데스크톱 Chrome으로 `http://127.0.0.1:5180`에 로그인한다. 옆 메뉴 아래 종 버튼을 누르고 '알림 켜기'를 누른 뒤 허락한다.
3. '시험 알림 보내기'를 누르면 5초 뒤 Windows 알림이 뜨고, 누르면 VADA 창이 앞으로 온다.
4. DevTools Application 탭의 Service workers에 `/sw.js`가 활성으로 보이고, Manifest 탭에 오류가 없다.

안 되면 원인을 고치고 해당 작업의 테스트에 그 경우를 더한 뒤 다시 한다. 끝나면 두 서버를 끈다.

- [ ] **Step 4: 커밋**

```bash
git add docs/device-checks.md
git commit -m "실제 기기 확인 기록 문서 더하기"
```

---

## 배포와 실제 기기 확인 (사람)

이 계획의 작업이 끝난 뒤의 일이다. 실행하는 에이전트는 하지 않는다.

1. 사용자가 자기 터미널에서 `npx web-push generate-vapid-keys`를 실행한다. 나온 두 값과 연락 메일(`mailto:…`)을 Render 환경 변수 `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`와 로컬 `.env`에 넣는다.
2. 사용자가 반영하라고 하면 main을 올린다. Render가 배포한다.
3. 배포 뒤 확인한다.
   - `https://vada-m1.onrender.com/sw.js`와 `/manifest.webmanifest`가 200을 돌려준다.
   - Render 로그에 `휴대폰 알림 켜짐 (Web Push)`가 찍힌다.
4. 사용자가 아이폰과 갤럭시로 `docs/device-checks.md`의 단계를 해 본다. 결과를 받아 그 문서에 옮겨 적고, spec의 표대로 다음 일을 정한다.
