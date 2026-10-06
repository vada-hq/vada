# 입력 경계 통일 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 새 API를 추가할 때 실패 케이스 처리를 빠뜨릴 수 없는 구조를 만든다. 입력 스키마, 공통 경계 미들웨어, 오류 처리를 한곳에 모으고, 테스트와 CI가 누락을 잡게 한다.

**Architecture:** 요청 본문 스키마는 `packages/contracts`에 zod로 둔다. 서버와 화면이 같은 스키마를 쓴다. 서버에서는 `/api/organizations/*`의 변경 요청 전체에 출처·형식·크기 검사 미들웨어를 한 번 건다. 라우트마다 스키마 검증 미들웨어를 인증보다 앞에 둔다. 오류는 `ApiError` 하나와 루트 `onError` 하나로 처리하고, 원문 없이 분류 정보만 로그에 남긴다. 라우트 목록을 훑는 테스트가 새 변경 라우트도 자동으로 같은 실패 검사를 받게 한다.

**Tech Stack:** Hono 4.13, zod 4.6.5, @hono/standard-validator 0.4.0, fast-check 4.10.2, node:test + tsx(api·contracts), vitest(web), PGlite(테스트 DB)

**Spec:** 이 문서. 배경은 2026-10-06 코드 점검 결과다. 채팅 본문에 크기 제한이 없고, 행사 이름에 길이 제한과 문자 검사가 없고, 오류 로그가 없고, 출처 검사가 4곳에 복사돼 있었다. 사용자는 개별 버그 수정보다 같은 종류의 누락이 반복되지 않는 구조를 원했다.

## Global Constraints

- 커밋·푸시·배포·DB 마이그레이션 적용은 사용자 승인 후에만 한다. 각 Task의 커밋 단계는 승인을 받고 실행한다.
- `.env`는 읽거나 출력하지 않는다. 로그·응답에 비밀 값, 요청 본문, DB 값, 오류 원문을 넣지 않는다.
- 테스트는 변경과 관련된 파일만 돌린다. 전체 스위트는 마지막 Task에서만 돌린다.
- 의존성은 기존처럼 정확한 버전으로 고정한다(`^` 없음).
- 오류 응답 형식은 `{ "error": "<CODE>" }`로 유지한다. 기존 코드 이름(`INVALID_INPUT`, `FORBIDDEN`, `UNSUPPORTED_MEDIA_TYPE`, `BODY_TOO_LARGE` 등)은 바꾸지 않는다.
- 요청 본문의 모르는 키는 모든 라우트에서 400 `INVALID_INPUT`이다(사용자 결정, 2026-10-06).
- 행사 이름 최대 길이는 100 코드 포인트다(계획 작성 시 가정. 사용자 확인 전까지 상수 하나로만 둔다).
- 채팅 본문 최대 길이는 2000 코드 포인트다(기존 DB CHECK와 같다).
- 변경 요청 본문 크기 상한은 32768바이트다(기존 구매 API 값. 배송은 16384에서 올라간다).
- 구매 API의 본문 검사 함수(`purchases/validation.ts`)는 ERD 재설계 때 다시 만든다. 이번에는 오류 클래스와 공통 미들웨어만 바꾼다.
- 주석은 기존처럼 한국어로, "왜"만 짧게 쓴다.

## Review Focus

1. 이모지처럼 UTF-16 두 칸을 쓰는 문자: 행사 이름 100개, 채팅 2000개까지는 통과하고 하나 더 넣으면 거부한다. 서버와 화면이 같은 기준(코드 포인트)으로 센다. → Task 1, Task 4, Task 7
2. Content-Length 없이 스트림으로 보낸 큰 본문: 헤더가 없어도 413이다. → Task 3
3. 운영 DB에 이미 100자를 넘는 행사 이름이 있으면 CHECK 마이그레이션이 실패한다. 적용 전에 조회로 확인한다. → Task 4
4. 깨진 JSON 본문도 다른 입력 오류와 같은 형태(`400 { error: 'INVALID_INPUT' }`)로 응답한다. 텍스트 오류문이 나가면 안 된다. → Task 2, Task 6
5. 서버 오류 로그에 요청 본문, 오류 메시지, DB 값이 들어가면 안 된다. 라우트 패턴, 오류 이름, SQLSTATE만 남긴다. → Task 2

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `packages/contracts/src/input.ts` (신규) | 공통 문자열 규칙 `text`, `token`, `codePoints` |
| `packages/contracts/src/events.ts` (신규) | `EVENT_NAME_MAX`, `CreateEventSchema`, `CreateEventRequest` |
| `packages/contracts/src/chat.ts` (신규) | `MESSAGE_CONTENT_MAX`, `CreateMessageSchema`, `CreateMessageRequest` |
| `packages/contracts/src/deliveries.ts` (수정) | 배송 요청 본문 스키마. 기존 interface를 스키마 추론 타입으로 바꾼다 |
| `packages/contracts/src/input.test.ts` (신규) | 무작위 입력 속성 테스트와 경계값 테스트 |
| `apps/api/src/http/errors.ts` (신규) | `ApiError` |
| `apps/api/src/http/on-error.ts` (신규) | 루트 오류 처리와 원문 없는 로그 |
| `apps/api/src/http/guard.ts` (신규) | 변경 요청의 출처·형식·크기 검사 |
| `apps/api/src/http/validate.ts` (신규) | `json(schema)` 검증 미들웨어 |
| `apps/api/src/http/boundary.test.ts` (신규) | 라우트 목록 기반 실패 검사 |
| `apps/api/src/app.ts` (수정) | 옵션 객체 시그니처, 가드·오류 처리 연결 |
| `AGENTS.md`, `CLAUDE.md` (신규, 저장소 루트) | 새 API 작성 규칙 |
| `.github/workflows/ci.yml` (신규) | PR·main 푸시마다 타입 검사와 테스트 |

---

### Task 1: contracts 입력 규칙과 스키마

**Files:**
- Create: `packages/contracts/src/input.ts`, `packages/contracts/src/events.ts`, `packages/contracts/src/chat.ts`, `packages/contracts/src/input.test.ts`
- Modify: `packages/contracts/src/index.ts`, `packages/contracts/package.json`

**Interfaces:**
- Produces: `text(max: number)`, `token(max: number)`, `codePoints(value: string): number`, `EVENT_NAME_MAX = 100`, `CreateEventSchema`, `type CreateEventRequest = { name: string }`, `MESSAGE_CONTENT_MAX = 2000`, `CreateMessageSchema`, `type CreateMessageRequest = { content: string }`

- [ ] **Step 1: 의존성 추가**

`packages/contracts/package.json`:

```json
{
  "name": "@vada/contracts",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit", "test": "tsx --test src/input.test.ts" },
  "dependencies": { "zod": "4.6.5" },
  "devDependencies": { "fast-check": "4.10.2", "tsx": "4.23.15" }
}
```

Run: `npm install` (저장소 루트)
Expected: `package-lock.json`이 갱신되고 오류가 없다.

- [ ] **Step 2: 실패하는 테스트 작성**

`packages/contracts/src/input.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import fc from 'fast-check'
import { codePoints, text, token } from './input.js'
import { CreateEventSchema, EVENT_NAME_MAX } from './events.js'
import { CreateMessageSchema, MESSAGE_CONTENT_MAX } from './chat.js'

// 홀로 쓰인 서러게이트까지 만들도록 UTF-16 코드 단위를 직접 뽑는다.
const anyText = fc.string({ unit: fc.integer({ min: 0, max: 0xffff }).map(n => String.fromCharCode(n)), maxLength: 120 })

test('text: 앞뒤 공백 제거 후 1..max 코드 포인트, NUL·홀로 쓰인 서러게이트 없음일 때만 통과한다', () => {
  const schema = text(50)
  fc.assert(fc.property(anyText, value => {
    const trimmed = value.trim()
    const expected = trimmed.length > 0 && codePoints(trimmed) <= 50 && !/[\u0000\uD800-\uDFFF]/u.test(value)
    const result = schema.safeParse(value)
    assert.equal(result.success, expected)
    if (result.success) assert.equal(result.data, trimmed)
  }))
})

test('token: 원문 max 이하, 제어 문자 없음, 공백 제거 후 1자 이상일 때만 통과한다', () => {
  const schema = token(40)
  fc.assert(fc.property(anyText, value => {
    const expected = value.length <= 40 && !/[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(value) && value.trim().length > 0
    const result = schema.safeParse(value)
    assert.equal(result.success, expected)
    if (result.success) assert.equal(result.data, value.trim())
  }))
})

test('문자열이 아닌 값은 거부한다', () => {
  for (const value of [null, undefined, 1, true, [], {}]) {
    assert.equal(text(10).safeParse(value).success, false)
    assert.equal(token(10).safeParse(value).success, false)
  }
})

test('행사 이름: 이모지도 코드 포인트로 세어 100개까지 통과한다', () => {
  assert.equal(CreateEventSchema.safeParse({ name: '😀'.repeat(EVENT_NAME_MAX) }).success, true)
  assert.equal(CreateEventSchema.safeParse({ name: '😀'.repeat(EVENT_NAME_MAX + 1) }).success, false)
  assert.deepEqual(CreateEventSchema.parse({ name: '  축제  ' }), { name: '축제' })
})

test('채팅 본문: 2000 코드 포인트까지, 줄바꿈은 허용한다', () => {
  assert.equal(CreateMessageSchema.safeParse({ content: '😀'.repeat(MESSAGE_CONTENT_MAX) }).success, true)
  assert.equal(CreateMessageSchema.safeParse({ content: 'a'.repeat(MESSAGE_CONTENT_MAX + 1) }).success, false)
  assert.equal(CreateMessageSchema.parse({ content: '첫 줄\n둘째 줄' }).content, '첫 줄\n둘째 줄')
})

test('모르는 키가 하나라도 있으면 거부한다', () => {
  const key = fc.string({ minLength: 1, maxLength: 20 })
  fc.assert(fc.property(key.filter(k => k !== 'name'), k => !CreateEventSchema.safeParse(JSON.parse(JSON.stringify({ name: 'a', [k]: 1 }))).success))
  fc.assert(fc.property(key.filter(k => k !== 'content'), k => !CreateMessageSchema.safeParse(JSON.parse(JSON.stringify({ content: 'a', [k]: 1 }))).success))
})
```

- [ ] **Step 3: 실패 확인**

Run: `npm test --workspace @vada/contracts`
Expected: FAIL (`./input.js`를 찾을 수 없음)

- [ ] **Step 4: 구현**

`packages/contracts/src/input.ts`:

```ts
import { z } from 'zod'

// PostgreSQL char_length와 같은 기준(유니코드 코드 포인트)으로 센다.
export const codePoints = (value: string) => [...value].length
const nulOrLoneSurrogate = /[\u0000\uD800-\uDFFF]/u
const control = /[\u0000-\u001f\u007f\uD800-\uDFFF]/u

// 사람이 쓰는 글. 줄바꿈은 허용하고 DB가 거부하는 NUL과 깨진 문자는 막는다.
export const text = (max: number) => z.string()
  .refine(value => !nulOrLoneSurrogate.test(value))
  .trim()
  .refine(value => value.length > 0 && codePoints(value) <= max)

// 식별자·키·송장번호. 제어 문자를 허용하지 않는다.
export const token = (max: number) => z.string()
  .max(max)
  .refine(value => !control.test(value))
  .trim()
  .min(1)
```

`packages/contracts/src/events.ts`:

```ts
import { z } from 'zod'
import { text } from './input.js'

export const EVENT_NAME_MAX = 100
export const CreateEventSchema = z.strictObject({ name: text(EVENT_NAME_MAX) })
export type CreateEventRequest = z.infer<typeof CreateEventSchema>
```

`packages/contracts/src/chat.ts`:

```ts
import { z } from 'zod'
import { text } from './input.js'

export const MESSAGE_CONTENT_MAX = 2000
export const CreateMessageSchema = z.strictObject({ content: text(MESSAGE_CONTENT_MAX) })
export type CreateMessageRequest = z.infer<typeof CreateMessageSchema>
```

`packages/contracts/src/index.ts`에서 `export interface CreateEventRequest { name: string }`와 `export interface CreateMessageRequest { content: string }`를 지우고 맨 위에 다음을 추가한다.

```ts
export { codePoints, text, token } from './input.js'
export { EVENT_NAME_MAX, CreateEventSchema, type CreateEventRequest } from './events.js'
export { MESSAGE_CONTENT_MAX, CreateMessageSchema, type CreateMessageRequest } from './chat.js'
```

- [ ] **Step 5: 통과 확인**

Run: `npm test --workspace @vada/contracts && npm run typecheck --workspaces`
Expected: PASS. 타입 검사가 3개 워크스페이스 모두 통과한다(타입 이름과 모양이 같으므로 사용처 수정은 없다).

만약 `.trim()` 뒤의 `refine`이 공백 제거 전 값을 받아 text 속성 테스트가 실패하면, `text`를 `z.string().refine(…).transform(v => v.trim()).pipe(z.string().refine(…))`로 바꾼다. `token`도 같은 방식으로 바꾼다.

- [ ] **Step 6: 커밋 (승인 후)**

```bash
git add packages/contracts package-lock.json
git commit -m "공통 입력 규칙과 행사·채팅 스키마 추가"
```

---

### Task 2: ApiError, 루트 오류 처리, createApp 옵션 객체

**Files:**
- Create: `apps/api/src/http/errors.ts`, `apps/api/src/http/on-error.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/app.test.ts`, `apps/api/src/serve.ts:46`, `apps/api/src/purchases/validation.ts:3-5`, `apps/api/src/purchases/purchases.ts:26`, `apps/api/src/deliveries/validation.ts:3-5`, `apps/api/src/deliveries/routes.ts:30`, createApp 호출 테스트 7곳(`auth/auth.test.ts:20`, `chat/chat.test.ts:29`, `deliveries/routes.test.ts:43`, `events/events.test.ts:25`, `purchases/purchases.test.ts:48`, `web.test.ts:16`, `web.test.ts:36`)

**Interfaces:**
- Produces: `class ApiError(code: string, status?: ErrorStatus)`, `handleError(error: Error, c: Context): Response`, `createApp(options: AppOptions)`. `AppOptions = { auth: AuthHandler; trustedOrigin: string; access?; events?; chat?; purchases?; deliveries? }`
- `PurchaseError`와 `DeliveryError`는 `ApiError`의 하위 클래스로 남긴다. 사용처 20여 곳을 건드리지 않기 위해서다.

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/src/app.test.ts`에 추가한다. 기존 health 테스트의 `createApp(...)` 호출도 옵션 객체로 바꾼다.

```ts
import { HTTPException } from 'hono/http-exception'
import { ApiError } from './http/errors.js'

const origin = 'http://127.0.0.1:5180'
const noAuth = { handler: async () => new Response() }

test('ApiError는 코드와 상태로, HTTPException 400은 INVALID_INPUT으로 응답한다', async () => {
  const app = createApp({ auth: noAuth, trustedOrigin: origin })
  app.get('/api/conflict', () => { throw new ApiError('VERSION_CONFLICT', 409) })
  app.get('/api/malformed', () => { throw new HTTPException(400, { message: 'Malformed JSON in request body' }) })
  const conflict = await app.request('/api/conflict')
  assert.equal(conflict.status, 409)
  assert.deepEqual(await conflict.json(), { error: 'VERSION_CONFLICT' })
  const malformed = await app.request('/api/malformed')
  assert.equal(malformed.status, 400)
  assert.deepEqual(await malformed.json(), { error: 'INVALID_INPUT' })
})

test('예상하지 못한 오류는 원문 없이 분류만 로그에 남긴다', async (t) => {
  const logged: string[] = []
  t.mock.method(console, 'error', (line: string) => { logged.push(line) })
  const app = createApp({ auth: noAuth, trustedOrigin: origin })
  app.get('/api/organizations/:organizationId/boom', () => {
    throw new Error('value=secret-token', { cause: Object.assign(new Error('row secret-token'), { code: '23514' }) })
  })
  const response = await app.request('/api/organizations/org-1/boom')
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: 'Internal server error' })
  assert.equal(logged.length, 1)
  assert.deepEqual(JSON.parse(logged[0]!), {
    event: 'request_failed', method: 'GET', route: '/api/organizations/:organizationId/boom', error: 'Error', sqlState: '23514',
  })
  assert.ok(!logged[0]!.includes('secret-token'))
  assert.ok(!logged[0]!.includes('org-1'))
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx tsx --test src/app.test.ts` (`apps/api`에서)
Expected: FAIL (`./http/errors.js` 없음)

- [ ] **Step 3: 구현**

`apps/api/src/http/errors.ts`:

```ts
export type ErrorStatus = 400 | 403 | 404 | 409 | 413 | 415 | 429 | 502 | 503

// 응답에는 code만 나간다. 입력값·외부 응답·키를 담지 않는다.
export class ApiError extends Error {
  constructor(readonly code: string, readonly status: ErrorStatus = 400) { super(code) }
}
```

`apps/api/src/http/on-error.ts`:

```ts
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ApiError } from './errors.js'

// DB 오류는 drizzle이 감싸므로 cause를 몇 단계 따라가 SQLSTATE만 꺼낸다.
function sqlState(error: unknown): string | undefined {
  let current = error
  for (let depth = 0; current && typeof current === 'object' && depth < 3; depth++) {
    const code = (current as { code?: unknown }).code
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code
    current = (current as { cause?: unknown }).cause
  }
  return undefined
}

export function handleError(error: Error, c: Context) {
  if (error instanceof ApiError) return c.json({ error: error.code }, error.status)
  if (error instanceof HTTPException) return c.json({ error: error.status === 400 ? 'INVALID_INPUT' : 'REQUEST_FAILED' }, error.status)
  // 오류 메시지·요청 본문·경로 값은 비밀이나 개인정보를 담을 수 있어 남기지 않는다.
  console.error(JSON.stringify({ event: 'request_failed', method: c.req.method, route: c.req.routePath, error: error.name, sqlState: sqlState(error) }))
  return c.json({ error: 'Internal server error' }, 500)
}
```

`apps/api/src/app.ts`:

```ts
import { Hono } from 'hono'
import type { HealthResponse } from '@vada/contracts'
import type { createAccessRoutes } from './access/access.js'
import type { createEventRoutes } from './events/events.js'
import type { createChatRoutes } from './chat/chat.js'
import type { createPurchaseRoutes } from './purchases/purchases.js'
import type { createDeliveryRoutes } from './deliveries/routes.js'
import { handleError } from './http/on-error.js'

type AuthHandler = { handler: (request: Request) => Promise<Response> }
export type AppOptions = {
  auth: AuthHandler
  trustedOrigin: string
  access?: ReturnType<typeof createAccessRoutes>
  events?: ReturnType<typeof createEventRoutes>
  chat?: ReturnType<typeof createChatRoutes>
  purchases?: ReturnType<typeof createPurchaseRoutes>
  deliveries?: ReturnType<typeof createDeliveryRoutes>
}

export function createApp({ auth, access, events, chat, purchases, deliveries }: AppOptions) {
  const app = new Hono()
  app.get('/api/health', (c) => c.json({ status: 'ok' } satisfies HealthResponse))
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
  if (events) app.route('/api', events)
  if (access) app.route('/api', access)
  if (chat) app.route('/api', chat)
  if (purchases) app.route('/api', purchases)
  if (deliveries) app.route('/api', deliveries)
  app.onError(handleError)
  return app
}
```

`trustedOrigin`은 Task 3에서 가드에 쓴다. 지금은 받기만 한다.

`purchases/validation.ts`의 `PurchaseError` 정의를 다음으로 바꾼다.

```ts
import { ApiError } from '../http/errors.js'
export class PurchaseError extends ApiError {}
```

`deliveries/validation.ts`의 `DeliveryError`도 같은 방식으로 바꾼다.

```ts
import { ApiError } from '../http/errors.js'
export class DeliveryError extends ApiError {}
```

`purchases/purchases.ts:26`과 `deliveries/routes.ts:30`의 `routes.onError(...)` 줄을 지운다. 루트 `handleError`가 `ApiError`를 처리한다.

`serve.ts:46`:

```ts
const app = createApp({ auth, trustedOrigin: env.BETTER_AUTH_URL!, access, events, chat, purchases, deliveries })
```

테스트의 createApp 호출 7곳을 옵션 객체로 바꾼다. 예:

```ts
// chat/chat.test.ts:29
const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, access: createAccessRoutes(db, session), chat: createChatRoutes(db, session, origin) })
// purchases/purchases.test.ts:48
const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, purchases: routes })
// deliveries/routes.test.ts:43
const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, deliveries: routes })
// events/events.test.ts:25
const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, access: createAccessRoutes(db, session), events: createEventRoutes(db, session, origin) })
// auth/auth.test.ts:20 (origin 변수가 없으면 'http://127.0.0.1:5180' 리터럴)
const app = createApp({ auth, trustedOrigin: 'http://127.0.0.1:5180', access: createAccessRoutes(db, (headers) => auth.api.getSession({ headers })) })
// web.test.ts:16, 36
createApp({ auth: { handler: async () => new Response('auth') }, trustedOrigin: 'http://127.0.0.1:5180' })
```

- [ ] **Step 4: 통과 확인**

Run (`apps/api`): `npx tsx --test src/app.test.ts src/web.test.ts src/auth/auth.test.ts src/events/events.test.ts src/chat/chat.test.ts src/purchases/purchases.test.ts src/deliveries/routes.test.ts && npm run typecheck`
Expected: PASS. 구매·배송 오류 응답은 이전과 같은 코드·상태로 나온다.

- [ ] **Step 5: 커밋 (승인 후)**

```bash
git add apps/api/src
git commit -m "오류 처리를 ApiError와 루트 onError로 통일"
```

---

### Task 3: 변경 요청 공통 가드

**Files:**
- Create: `apps/api/src/http/guard.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/app.test.ts`, `apps/api/src/events/events.ts`, `apps/api/src/chat/chat.ts`, `apps/api/src/purchases/purchases.ts`, `apps/api/src/deliveries/routes.ts`, `apps/api/src/serve.ts`, `apps/api/src/deliveries/routes.test.ts:55`, 라우트 생성 테스트 호출부

**Interfaces:**
- Consumes: `createApp({ trustedOrigin })` (Task 2)
- Produces: `mutationGuard(trustedOrigin: string)`, `MAX_BODY_BYTES = 32768`. 라우트 팩토리에서 `trustedOrigin` 매개변수가 빠진다: `createEventRoutes(db, getSession)`, `createChatRoutes(db, getSession)`, `createPurchaseRoutes(db, session, generate)`, `createDeliveryRoutes(db, session, provider)`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/src/app.test.ts`에 추가한다.

```ts
test('조직 하위 변경 요청은 출처·형식·크기를 먼저 검사한다', async () => {
  const app = createApp({ auth: noAuth, trustedOrigin: origin })
  let reached = 0
  app.post('/api/organizations/:organizationId/probe', c => { reached++; return c.json({ ok: true }) })
  app.get('/api/organizations/:organizationId/probe', c => c.json({ ok: true }))
  const path = '/api/organizations/a/probe'
  const json = { 'Content-Type': 'application/json' }
  assert.equal((await app.request(path, { method: 'POST', headers: { ...json, Origin: 'https://evil.test' }, body: '{}' })).status, 403)
  assert.equal((await app.request(path, { method: 'POST', headers: json, body: '{}' })).status, 403)
  assert.equal((await app.request(path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain' }, body: '{}' })).status, 415)
  const huge = JSON.stringify({ x: 'a'.repeat(40000) })
  const tooLarge = await app.request(path, { method: 'POST', headers: { ...json, Origin: origin }, body: huge })
  assert.equal(tooLarge.status, 413)
  assert.deepEqual(await tooLarge.json(), { error: 'BODY_TOO_LARGE' })
  // Content-Length 없이 스트림으로 보내도 막는다.
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(huge)); controller.close() } })
  assert.equal((await app.request(path, { method: 'POST', headers: { ...json, Origin: origin }, body: stream, duplex: 'half' } as RequestInit)).status, 413)
  assert.equal(reached, 0)
  assert.equal((await app.request(path, { method: 'POST', headers: { ...json, Origin: origin }, body: '{}' })).status, 200)
  assert.equal((await app.request(path)).status, 200)
  assert.equal(reached, 1)
})
```

- [ ] **Step 2: 실패 확인**

Run (`apps/api`): `npx tsx --test src/app.test.ts`
Expected: FAIL (교차 출처 요청이 200)

- [ ] **Step 3: 구현**

`apps/api/src/http/guard.ts`:

```ts
import { bodyLimit } from 'hono/body-limit'
import { createMiddleware } from 'hono/factory'

export const MAX_BODY_BYTES = 32768
const readOnly = new Set(['GET', 'HEAD', 'OPTIONS'])

// 인증·DB 조회보다 먼저 실행한다. 새 라우트도 /api/organizations 아래면 자동 적용된다.
export function mutationGuard(trustedOrigin: string) {
  const origin = new URL(trustedOrigin).origin
  const size = bodyLimit({ maxSize: MAX_BODY_BYTES, onError: c => c.json({ error: 'BODY_TOO_LARGE' }, 413) })
  return createMiddleware(async (c, next) => {
    if (readOnly.has(c.req.method)) return next()
    // 인증 쿠키를 사용하는 변경 요청은 프런트엔드의 동일 출처만 허용한다.
    if (c.req.header('Origin') !== origin) return c.json({ error: 'FORBIDDEN' }, 403)
    if (c.req.header('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
      return c.json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, 415)
    }
    return size(c, next)
  })
}
```

`app.ts`: 시그니처에서 `trustedOrigin`을 꺼내고, 라우트 연결 전에 가드를 건다.

```ts
export function createApp({ auth, trustedOrigin, access, events, chat, purchases, deliveries }: AppOptions) {
  const app = new Hono()
  app.use('/api/organizations/*', mutationGuard(trustedOrigin))
  // ...이하 기존과 같다
```

모듈별 중복 검사를 지운다.
- `events/events.ts`: `trustedOrigin` 매개변수, `origin` 상수, POST 핸들러 첫 두 `if`(Origin, Content-Type)를 지운다.
- `chat/chat.ts`: 위와 같다.
- `purchases/purchases.ts`: `trustedOrigin` 매개변수, `origin`, `mutation`, `size`와 `bodyLimit`·`createMiddleware` import를 지운다. 각 라우트의 `mutation, size` 인자도 지운다.
- `deliveries/routes.ts`: `origin`, `mutation`, `size`와 `bodyLimit` import를 지운다. 각 라우트의 `mutation, size` 인자도 지운다. `finance` 미들웨어는 남긴다.
- `serve.ts`와 테스트의 라우트 팩토리 호출에서 `origin`/`env.BETTER_AUTH_URL!` 인자를 지운다.
- `deliveries/routes.test.ts:55`: 상한이 32768로 올라가므로 `'x'.repeat(17000)`을 `'x'.repeat(33000)`으로 바꾼다.

- [ ] **Step 4: 통과 확인**

Run (`apps/api`): `npx tsx --test src/app.test.ts src/events/events.test.ts src/chat/chat.test.ts src/purchases/purchases.test.ts src/deliveries/routes.test.ts && npm run typecheck`
Expected: PASS. 기존 403·415·413 테스트가 그대로 통과한다.

- [ ] **Step 5: 커밋 (승인 후)**

```bash
git add apps/api/src
git commit -m "변경 요청 출처·형식·크기 검사를 공통 가드로 통합"
```

---

### Task 4: 행사·채팅 스키마 적용과 행사 이름 DB 제약

**Files:**
- Create: `apps/api/src/http/validate.ts`, 마이그레이션 `apps/api/migrations/0008_*.sql`(drizzle-kit이 생성)
- Modify: `apps/api/package.json`, `apps/api/src/events/events.ts`, `apps/api/src/chat/chat.ts`, `apps/api/src/db/schema.ts:81`, `apps/api/src/events/events.test.ts`, `apps/api/src/chat/chat.test.ts`

**Interfaces:**
- Consumes: `CreateEventSchema`, `CreateMessageSchema`, `EVENT_NAME_MAX` (Task 1), `ApiError` (Task 2)
- Produces: `json<S extends StandardSchemaV1>(schema: S)` 미들웨어. 핸들러에서는 `c.req.valid('json')`로 꺼낸다.

- [ ] **Step 1: 의존성 추가**

`apps/api/package.json`의 dependencies에 `"@hono/standard-validator": "0.4.0"`, `"@standard-schema/spec": "1.0.0"`을 추가하고 `npm install`을 실행한다. 설치 후 `npm ls @standard-schema/spec`으로 zod와 같은 메이저인지 확인한다.

- [ ] **Step 2: 실패하는 테스트 작성**

`events/events.test.ts`의 'invalid input' 하위 테스트 반복 목록에 다음을 추가한다.

```ts
{ name: 'a'.repeat(101) }, { name: '😀'.repeat(101) }, { name: 'a\u0000b' }, { name: '\ud800' }, { name: 'Event', extra: 1 }
```

같은 하위 테스트에 응답 본문 형식 검사를 추가한다.

```ts
const invalid = await post({ name: 'a\u0000b' })
assert.deepEqual(await invalid.json(), { error: 'INVALID_INPUT' })
```

'creation trims names…' 하위 테스트는 모르는 키를 무시하던 동작을 기대한다. 이 동작이 400으로 바뀌므로, 본문을 `{ name: '  Festival  ' }`로 바꾸고 테스트 이름을 'creation trims names and takes identity and council from the session'으로 바꾼다. `createdBy`·`organizationId` 위조 검증은 위 반복 목록의 extra 키 케이스가 대신한다.

같은 테스트에 경계값과 DB 제약 검증을 추가한다.

```ts
assert.equal((await post({ name: '😀'.repeat(100) })).status, 201)
await assert.rejects(pg.query("INSERT INTO events (id,organization_id,name,created_by) VALUES ('long','a',repeat('a',101),'p')"))
```

`chat/chat.test.ts:58`의 반복 목록에 `{ content: 'Hi', extra: 1 }`을 추가하고, 첫 응답 본문이 `{ error: 'INVALID_INPUT' }`인지 확인하는 줄을 추가한다.

- [ ] **Step 3: 실패 확인**

Run (`apps/api`): `npx tsx --test src/events/events.test.ts src/chat/chat.test.ts`
Expected: FAIL (101자 이름이 201, NUL 이름이 500, 모르는 키가 201)

- [ ] **Step 4: 구현**

`apps/api/src/http/validate.ts`:

```ts
import { sValidator } from '@hono/standard-validator'
import type { StandardSchemaV1 } from '@standard-schema/spec'

// 인증보다 앞에 둔다. 형식이 틀린 요청은 DB 조회 없이 거절한다.
export const json = <S extends StandardSchemaV1>(schema: S) =>
  sValidator('json', schema, (result, c) => {
    if (!result.success) return c.json({ error: 'INVALID_INPUT' }, 400)
  })
```

`events/events.ts` POST:

```ts
routes.post(path, json(CreateEventSchema), authenticated, member, async (c) => {
  const { name } = c.req.valid('json')
  // 저장 시점에도 소속을 확인하며, 클라이언트의 생성자·학생회 필드는 사용하지 않는다.
  const event = await db.transaction(async tx => {
```

`body` 파싱과 수동 검사 블록(`let body…`부터 `const name = body.name.trim()`까지)을 지운다.

`chat/chat.ts` POST:

```ts
routes.post(path, json(CreateMessageSchema), authenticated, member, room, async c => {
  const { content } = c.req.valid('json')
  const saved = await db.transaction(async tx => {
```

`let body…`부터 코드 포인트 검사 `if`까지 지운다.

`db/schema.ts:81` 다음 줄에 추가한다.

```ts
check('events_name_length', sql`char_length(${table.name}) <= 100`),
```

Run (`apps/api`): `npm run db:generate`
Expected: `migrations/0008_*.sql`에 `ADD CONSTRAINT "events_name_length" CHECK (char_length("events"."name") <= 100)`만 들어 있다. 다른 변경이 섞였으면 멈추고 보고한다.

- [ ] **Step 5: 통과 확인**

Run (`apps/api`): `npx tsx --test src/events/events.test.ts src/chat/chat.test.ts src/db/schema.test.ts src/db/migrations.test.ts && npm run typecheck`
Expected: PASS

- [ ] **Step 6: 운영 DB 적용 전 확인 (사용자 승인 후)**

dev(`production` 브랜치)와 `m1-preview`에서 각각 다음 조회 결과가 0인지 확인한다. 1 이상이면 적용하지 않고 보고한다.

```sql
SELECT count(*) FROM events WHERE char_length(name) > 100;
```

- [ ] **Step 7: 커밋 (승인 후)**

```bash
git add apps/api package-lock.json
git commit -m "행사·채팅 입력을 공통 스키마로 검사"
```

---

### Task 5: 배송 요청 본문 스키마 이전

**Files:**
- Modify: `packages/contracts/src/deliveries.ts`, `packages/contracts/src/index.ts`, `packages/contracts/src/input.test.ts`, `apps/api/src/deliveries/validation.ts`, `apps/api/src/deliveries/routes.ts`

**Interfaces:**
- Consumes: `token` (Task 1), `json` (Task 4)
- Produces: `DeliveryLookupSchema`, `RegisterShipmentSchema`, `UnlinkShipmentSchema`. 타입 `DeliveryLookupRequest`, `RegisterShipmentRequest`, `UnlinkShipmentRequest`는 이름과 모양이 그대로이고 스키마에서 추론된다. `deliveries/validation.ts`에는 `DeliveryError`와 `text`(경로·쿼리 값용)만 남는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/contracts/src/input.test.ts`에 추가한다. 기존 `parseLookup`·`parseRegister`·`parseUnlink`와 같은 동작을 고정한다.

```ts
import { DeliveryLookupSchema, RegisterShipmentSchema, UnlinkShipmentSchema } from './deliveries.js'

test('배송 스키마는 기존 수동 검사와 같은 규칙을 지킨다', () => {
  assert.deepEqual(DeliveryLookupSchema.parse({ carrierId: ' kr.cjlogistics ', trackingNumber: '1234-5' }), { carrierId: 'kr.cjlogistics', trackingNumber: '1234-5' })
  for (const body of [{ carrierId: 'kr cj', trackingNumber: '1' }, { carrierId: 'kr.cj', trackingNumber: '1 2' }, { carrierId: 'kr.cj', trackingNumber: '1', extra: 1 }, { carrierId: 'kr.cj' }]) {
    assert.equal(DeliveryLookupSchema.safeParse(body).success, false)
  }
  const register = { carrierId: 'kr.cj', trackingNumber: '1', purchaseItemIds: ['b', 'a'], idempotencyKey: 'k' }
  assert.deepEqual(RegisterShipmentSchema.parse(register).purchaseItemIds, ['a', 'b'])
  for (const ids of [[], ['a', 'a'], Array.from({ length: 51 }, (_, i) => `i${i}`), ['a\u0001']]) {
    assert.equal(RegisterShipmentSchema.safeParse({ ...register, purchaseItemIds: ids }).success, false)
  }
  assert.equal(RegisterShipmentSchema.safeParse({ ...register, idempotencyKey: 'k'.repeat(129) }).success, false)
  assert.deepEqual(UnlinkShipmentSchema.parse({ linkIds: ['z', 'y'] }), { linkIds: ['y', 'z'] })
  assert.equal(UnlinkShipmentSchema.safeParse({ linkIds: ['y'], extra: 1 }).success, false)
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test --workspace @vada/contracts`
Expected: FAIL (`DeliveryLookupSchema` export 없음)

- [ ] **Step 3: 구현**

`packages/contracts/src/deliveries.ts`에서 요청 interface 3개를 다음으로 바꾼다. 응답 타입은 그대로 둔다.

```ts
import { z } from 'zod'
import { token } from './input.js'

// 자릿수로 택배사를 추정하거나 송장번호를 숫자로 변환하지 않는다.
const shipment = {
  carrierId: token(100).regex(/^[a-zA-Z0-9._-]+$/),
  trackingNumber: token(100).regex(/^[a-zA-Z0-9-]+$/),
}
const ids = z.array(token(200)).min(1).max(50)
  .refine(values => new Set(values).size === values.length)
  .transform(values => [...values].sort())

export const DeliveryLookupSchema = z.strictObject(shipment)
export const RegisterShipmentSchema = z.strictObject({ ...shipment, purchaseItemIds: ids, idempotencyKey: token(128) })
export const UnlinkShipmentSchema = z.strictObject({ linkIds: ids })
export type DeliveryLookupRequest = z.infer<typeof DeliveryLookupSchema>
export type RegisterShipmentRequest = z.infer<typeof RegisterShipmentSchema>
export type UnlinkShipmentRequest = z.infer<typeof UnlinkShipmentSchema>
```

`index.ts`의 배송 export 줄에 값 export를 추가한다.

```ts
export { DeliveryLookupSchema, RegisterShipmentSchema, UnlinkShipmentSchema } from './deliveries.js'
```

`deliveries/validation.ts`에서 `object`, `shipment`, `ids`, `parseLookup`, `parseRegister`, `parseUnlink`를 지운다. `DeliveryError`와 `text`만 남긴다.

`deliveries/routes.ts`: `body` 헬퍼를 지우고 세 라우트를 다음처럼 바꾼다.

```ts
routes.post(`${root}/delivery-lookups`, json(DeliveryLookupSchema), auth, member, finance, async c => c.json(await service.lookup(
  { userId: c.get('userId'), organizationId: c.req.param('organizationId') }, c.req.valid('json'),
)))
routes.post(`${root}/shipments`, json(RegisterShipmentSchema), auth, member, finance, async c => {
  const result = await service.register({ userId: c.get('userId'), organizationId: c.req.param('organizationId') }, c.req.valid('json'))
  return c.json(result, result.replayed ? 200 : 201)
})
routes.post(`${root}/shipments/:shipmentId/unlink`, json(UnlinkShipmentSchema), auth, member, finance, async c => c.json(await service.unlink(
  { userId: c.get('userId'), organizationId: c.req.param('organizationId') }, text(c.req.param('shipmentId')), c.req.valid('json').linkIds,
)))
```

- [ ] **Step 4: 통과 확인**

Run: `npm test --workspace @vada/contracts`, 그리고 `apps/api`에서 `npx tsx --test src/deliveries/routes.test.ts src/deliveries/worker.test.ts src/deliveries/delivery-tracker.test.ts && npm run typecheck`, 그리고 `npm run typecheck --workspace @vada/web`
Expected: PASS. 배송 화면 코드는 타입 이름이 그대로라 수정이 없다.

`routes.test.ts`가 형식이 틀린 본문에 인증 실패(401·403)를 기대하는 곳이 있으면, 검증이 인증보다 앞으로 왔기 때문이다. 그 기대값을 400으로 바꾸고, 바꾼 줄을 보고에 적는다.

- [ ] **Step 5: 커밋 (승인 후)**

```bash
git add packages/contracts apps/api/src/deliveries
git commit -m "배송 요청 본문 검사를 공통 스키마로 이전"
```

---

### Task 6: 라우트 목록 기반 경계 테스트

새 변경 라우트를 추가해도 같은 실패 검사를 자동으로 받게 한다. 스키마 검증을 빠뜨린 라우트는 이 테스트가 잡는다.

**Files:**
- Create: `apps/api/src/http/boundary.test.ts`
- Modify: `apps/api/package.json`(test 스크립트에 파일 추가)

**Interfaces:**
- Consumes: `createApp`(Task 2), 라우트 팩토리(Task 3 시그니처), `json`(Task 4)

- [ ] **Step 1: 테스트 작성**

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { createApp } from '../app.js'
import { createAccessRoutes } from '../access/access.js'
import { createEventRoutes } from '../events/events.js'
import { createChatRoutes } from '../chat/chat.js'
import { createPurchaseRoutes } from '../purchases/purchases.js'
import { createDeliveryRoutes } from '../deliveries/routes.js'

// 구매 본문 검사는 ERD 재설계 때 스키마로 다시 만든다. 그때 이 목록을 비운다.
const schemaPending = new Set([
  'POST /api/organizations/:organizationId/events/:eventId/purchase-requests/drafts',
  'PATCH /api/organizations/:organizationId/events/:eventId/purchase-requests/:requestId',
  'POST /api/organizations/:organizationId/events/:eventId/purchase-requests/:requestId/discard',
  'POST /api/organizations/:organizationId/events/:eventId/purchase-requests/:requestId/submit',
  'POST /api/organizations/:organizationId/events/:eventId/purchase-requests/finance/:requestId/decision',
])

test('모든 변경 라우트는 출처·형식·크기·JSON·모르는 키를 인증 전에 거절한다', async () => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    const origin = 'http://127.0.0.1:5180'
    let authCalls = 0
    const session = async () => { authCalls++; return null }
    const app = createApp({
      auth: { handler: async () => new Response() }, trustedOrigin: origin,
      access: createAccessRoutes(db, session), events: createEventRoutes(db, session), chat: createChatRoutes(db, session),
      purchases: createPurchaseRoutes(db, session, async () => { throw new Error('unused') }),
      deliveries: createDeliveryRoutes(db, session, {} as never),
    })
    const mutating = [...new Set(app.routes
      .filter(route => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.method) && route.path.startsWith('/api/organizations/'))
      .map(route => `${route.method} ${route.path}`))]
    // 목록이 비어 테스트가 저절로 통과하는 일을 막는다.
    assert.ok(mutating.length >= 10, `변경 라우트 ${mutating.length}개`)
    for (const key of mutating) {
      const [method, pattern] = key.split(' ') as [string, string]
      const path = pattern.replace(/:[^/]+/g, 'probe')
      const send = (headers: Record<string, string>, body: string) => app.request(path, { method, headers, body })
      const json = { 'Content-Type': 'application/json', Origin: origin }
      assert.equal((await send({ ...json, Origin: 'https://evil.test' }, '{}')).status, 403, key)
      assert.equal((await send({ Origin: origin, 'Content-Type': 'text/plain' }, '{}')).status, 415, key)
      assert.equal((await send(json, JSON.stringify({ x: 'a'.repeat(40000) }))).status, 413, key)
      if (schemaPending.has(key)) continue
      const before = authCalls
      const malformed = await send(json, '{')
      assert.equal(malformed.status, 400, key)
      assert.deepEqual(await malformed.json(), { error: 'INVALID_INPUT' }, key)
      assert.equal((await send(json, '{"__probe":1}')).status, 400, key)
      assert.equal(authCalls, before, `${key}: 형식 검사가 인증보다 먼저여야 한다`)
    }
  } finally {
    await pg.close()
  }
})
```

`createDeliveryRoutes`의 세 번째 인자 타입이 `{} as never`로 맞지 않으면, `deliveries/routes.test.ts`가 쓰는 가짜 provider를 그대로 가져와 쓴다.

- [ ] **Step 2: 실행**

Run (`apps/api`): `npx tsx --test src/http/boundary.test.ts`
Expected: PASS. 실패하면 메시지의 라우트 키가 어떤 검사를 빠뜨렸는지 알려 준다. 그 라우트를 Task 3·4·5 방식으로 고친다. 테스트를 완화해 통과시키지 않는다.

- [ ] **Step 3: 테스트 스크립트에 등록**

`apps/api/package.json`의 `test` 스크립트 파일 목록 끝에 `src/http/boundary.test.ts`를 추가한다.

- [ ] **Step 4: 커밋 (승인 후)**

```bash
git add apps/api
git commit -m "모든 변경 라우트의 입력 경계를 검사하는 테스트 추가"
```

---

### Task 7: 화면이 같은 규칙을 사용

**Files:**
- Modify: `apps/web/src/events/CreateEventForm.tsx`, `apps/web/src/events/CreateEventForm.test.tsx`, `apps/web/src/events/useEvents.ts`, `apps/web/src/chat/Chat.tsx`, `apps/web/src/chat/useChat.ts`, `apps/web/src/chat/Chat.test.tsx`

**Interfaces:**
- Consumes: `CreateEventSchema`, `EVENT_NAME_MAX`, `CreateMessageSchema`, `MESSAGE_CONTENT_MAX`, `codePoints` (Task 1)

- [ ] **Step 1: 실패하는 테스트 작성**

`CreateEventForm.test.tsx`에 추가한다.

```tsx
test('이름이 100자를 넘으면 만들기 버튼을 막고 글자 수를 보여 준다', () => {
  const props = { onNameChange: () => {}, saving: false, disabled: false, error: '', onSubmit: () => {} }
  const view = render(<CreateEventForm {...props} name={'😀'.repeat(100)} />)
  expect((screen.getByRole('button', { name: '행사 만들기' }) as HTMLButtonElement).disabled).toBe(false)
  expect(screen.getByText('100 / 100자')).toBeTruthy()
  view.rerender(<CreateEventForm {...props} name={'😀'.repeat(101)} />)
  expect((screen.getByRole('button', { name: '행사 만들기' }) as HTMLButtonElement).disabled).toBe(true)
})
```

`Chat.test.tsx`의 전송 버튼 테스트에, NUL 문자가 든 초안이면 전송 버튼이 비활성인지 확인하는 단언을 추가한다. 이 파일의 기존 렌더 도우미와 초안 입력 방식을 그대로 쓴다.

- [ ] **Step 2: 실패 확인**

Run: `npm test --workspace @vada/web -- src/events/CreateEventForm.test.tsx src/chat/Chat.test.tsx`
Expected: FAIL (`100 / 100자` 없음, 101자에서도 버튼 활성)

- [ ] **Step 3: 구현**

`CreateEventForm.tsx`:

```tsx
import { CreateEventSchema, EVENT_NAME_MAX, codePoints } from '@vada/contracts'
// ...
const valid = CreateEventSchema.safeParse({ name }).success
// input 다음 줄
<p className="hint">{codePoints(name.trim())} / {EVENT_NAME_MAX}자</p>
<button type="submit" disabled={!valid || disabled || saving}>{saving ? '만드는 중…' : '행사 만들기'}</button>
```

`useEvents.ts`의 `create`: `const trimmed = name.trim()`과 `if (!trimmed …)` 검사를 스키마 사용으로 바꾼다.

```ts
const parsed = CreateEventSchema.safeParse({ name })
if (!parsed.success || pending.current || loading || loadError) return
// ...
const body: CreateEventRequest = parsed.data
```

`Chat.tsx`: 버튼 조건 `length === 0 || length > 2000`을 `!CreateMessageSchema.safeParse({ content: chat.draft }).success`로 바꾸고, 안내 문구의 `2,000`을 `{MESSAGE_CONTENT_MAX.toLocaleString('ko-KR')}`로 바꾼다.

`useChat.ts`의 `send`: 수동 길이·정규식 검사를 바꾼다.

```ts
const parsed = CreateMessageSchema.safeParse({ content: draft })
if (!signal || loading || blocked.current || loadError || !parsed.success) return
// ...
const body: CreateMessageRequest = parsed.data
```

- [ ] **Step 4: 통과 확인**

Run: `npm test --workspace @vada/web -- src/events src/chat && npm run typecheck --workspace @vada/web`
Expected: PASS

- [ ] **Step 5: 커밋 (승인 후)**

```bash
git add apps/web/src/events apps/web/src/chat
git commit -m "행사·채팅 화면이 서버와 같은 입력 규칙 사용"
```

---

### Task 8: 저장소 규칙과 CI

**Files:**
- Create: `AGENTS.md`, `CLAUDE.md`, `.github/workflows/ci.yml`

- [ ] **Step 1: `AGENTS.md` 작성**

```markdown
# VADA M1 저장소 규칙

## 새 API를 만들 때
- 요청 본문 스키마는 `packages/contracts`에 zod `z.strictObject`로 정의한다. 문자열은 `text(max)`(사람이 쓰는 글) 또는 `token(max)`(식별자·키)로만 만들고, 모든 문자열·배열·숫자에 상한을 둔다.
- 라우트에서는 `json(Schema)`를 인증 미들웨어보다 앞에 두고 `c.req.valid('json')`만 사용한다. `c.req.json()`을 직접 호출하지 않는다.
- 변경 라우트는 `/api/organizations/` 아래에 둔다. 출처·형식·크기 검사는 공통 가드(`apps/api/src/http/guard.ts`)가 맡으므로 라우트에서 다시 구현하지 않는다.
- 실패는 `ApiError(code, status)`로 던진다. 라우트별 `onError`를 만들지 않는다.
- 길이 제한이 있는 컬럼은 DB에도 같은 값의 CHECK를 둔다.
- 테스트에는 성공 케이스와 함께 다음을 넣는다: 필수값 누락, 빈 문자열·공백만, 상한+1(이모지 포함), NUL·홀로 쓰인 서러게이트, 모르는 키, 다른 학생회 사용자, 미인증.
- 화면은 같은 스키마의 `safeParse`로 버튼 활성화를 판단한다. 길이 숫자를 화면에 다시 적지 않는다.

## 로그·비밀
- 로그와 응답에 요청 본문, 오류 메시지 원문, DB 값, 비밀 값을 넣지 않는다.
- `.env`는 읽거나 출력하지 않는다.

## 검사
- API 테스트: `npm test --workspace @vada/api` (개별 파일은 `apps/api`에서 `npx tsx --test <파일>`)
- 계약 테스트: `npm test --workspace @vada/contracts`
- 화면 테스트: `npm test --workspace @vada/web`
- 타입 검사: `npm run typecheck`
```

- [ ] **Step 2: `CLAUDE.md` 작성**

Claude Code는 `AGENTS.md`를 자동으로 읽지 않으므로 가져오기 한 줄을 둔다.

```markdown
@AGENTS.md
```

- [ ] **Step 3: `.github/workflows/ci.yml` 작성**

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
```

- [ ] **Step 4: 로컬에서 CI와 같은 명령 실행**

Run (저장소 루트): `npm ci && npm run typecheck && npm test`
Expected: 전체 PASS. 이 계획에서 전체 스위트를 돌리는 단계는 여기뿐이다. 외부 DB나 `.env` 없이 통과해야 한다. 실패하는 테스트가 환경 변수에 의존하면 멈추고 보고한다.

- [ ] **Step 5: 커밋 (승인 후). 푸시는 별도 승인.**

```bash
git add AGENTS.md CLAUDE.md .github/workflows/ci.yml
git commit -m "저장소 입력 경계 규칙과 CI 추가"
```

---

## 이번 계획에서 하지 않는 것

- 구매 본문 검사의 스키마 이전. ERD 재설계 때 Task 6의 `schemaPending` 목록을 비우면서 한다.
- 코드 점검에서 나온 성능 항목(채팅 폴링 쿼리 수, 커서 중복 조회, 행사 목록 페이지네이션)과 `web.ts` 정적 파일 항목.
- 운영 DB 마이그레이션 적용과 푸시·배포. 각각 사용자 승인 후 별도로 진행한다.
