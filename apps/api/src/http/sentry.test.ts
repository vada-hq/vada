import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as Sentry from '@sentry/node'
import type { ErrorEvent } from '@sentry/node'
import { createApp } from '../app.js'
import { setErrorReporter } from './on-error.js'
import { scrubEvent, startErrorReporting, stopErrorReporting } from './sentry.js'

test('Sentry로 보내기 전에 메시지·요청·사용자·브레드크럼을 지우고 오류 종류·스택·태그만 남긴다', () => {
  const event = {
    message: 'secret-token in message',
    exception: {
      values: [
        {
          type: 'PostgresError',
          value: 'Failing row contains (secret-token)',
          stacktrace: { frames: [{ filename: 'app.js', function: 'handler', lineno: 1 }] },
        },
      ],
    },
    request: {
      url: 'https://vada.test/api/organizations/org-1/events',
      headers: { cookie: 'session=secret-token' },
      data: '{"name":"secret-token"}',
    },
    user: { ip_address: '203.0.113.7', email: 'someone@vada.test' },
    breadcrumbs: [{ message: 'secret-token' }],
    extra: { body: 'secret-token' },
    server_name: 'DESKTOP-PERSONAL-PC',
    tags: { route: '/api/organizations/:organizationId/events' },
  } as unknown as ErrorEvent
  const sent = JSON.stringify(scrubEvent(event))
  for (const leaked of [
    'secret-token',
    '203.0.113.7',
    'someone@vada.test',
    'org-1',
    'DESKTOP-PERSONAL-PC',
  ])
    assert.ok(!sent.includes(leaked), leaked)
  const scrubbed = scrubEvent(event)
  assert.equal(scrubbed.exception?.values?.[0]?.type, 'PostgresError')
  assert.equal(scrubbed.exception?.values?.[0]?.stacktrace?.frames?.[0]?.function, 'handler')
  assert.deepEqual(scrubbed.tags, { route: '/api/organizations/:organizationId/events' })
})

test('DSN이 없으면 오류 수집을 켜지 않는다', () => {
  assert.equal(startErrorReporting(undefined, 'development'), false)
  assert.equal(startErrorReporting('  ', 'development'), false)
})

test('DSN이 아닌 값(OTLP 주소 등)이면 켜지 않고 원인을 로그에 남긴다', t => {
  const logged: string[] = []
  t.mock.method(console, 'error', (line: string) => {
    logged.push(line)
  })
  assert.equal(
    startErrorReporting('https://o1.ingest.us.sentry.io/api/2/integration/otlp', 'production'),
    false,
  )
  assert.equal(logged.length, 1)
  assert.ok(logged[0]!.includes('SENTRY_DSN'))
  assert.ok(!logged[0]!.includes('o1.ingest'))
})

test('실제 SDK 경로로 보내도 정제되고, 요청을 실패시킨 오류는 처리되지 않은 실패로 표시된다', async t => {
  // 소스 코드 줄이 스택 문맥으로 함께 실리므로 검사할 값은 실행 중에 만든다.
  const secret = ['secret', 'token'].join('-')
  const organizationId = ['org', 'smoke'].join('-')
  const sent: string[] = []
  const transport = () => ({
    send: async (envelope: unknown) => {
      sent.push(JSON.stringify(envelope))
      return {}
    },
    flush: async () => true,
  })
  t.mock.method(console, 'error', () => {})
  assert.equal(
    startErrorReporting('https://public@sentry.invalid/1', 'test', transport as never),
    true,
  )
  // 자동 계측용 모듈 로더 후크는 Render(Linux, Node 22.23)에서 서버 시작을 멈추게 했다. 켜지 않아야 한다.
  assert.equal(
    Sentry.getClient<Sentry.NodeClient>()?.getOptions().enableRuntimeChannelInjection,
    false,
  )
  t.after(async () => {
    setErrorReporter(undefined)
    await stopErrorReporting()
  })
  const app = createApp({
    auth: { handler: async () => new Response() },
    trustedOrigin: 'http://127.0.0.1:5180',
  })
  app.get('/api/organizations/:organizationId/crash', () => {
    throw new Error(`value=${secret}`)
  })
  assert.equal(
    (
      await app.request(`/api/organizations/${organizationId}/crash`, {
        headers: { Cookie: `session=${secret}` },
      })
    ).status,
    500,
  )
  await Sentry.flush(2000)
  const payload = sent.join('\n')
  assert.ok(payload.includes('/api/organizations/:organizationId/crash'), 'route pattern')
  for (const leaked of [secret, organizationId]) assert.ok(!payload.includes(leaked), leaked)
  assert.ok(payload.includes('"handled":false'), 'unhandled mechanism')
})
