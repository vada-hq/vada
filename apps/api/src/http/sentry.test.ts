import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ErrorEvent } from '@sentry/node'
import { scrubEvent, startErrorReporting } from './sentry.js'

test('Sentry로 보내기 전에 메시지·요청·사용자·브레드크럼을 지우고 오류 종류·스택·태그만 남긴다', () => {
  const event = {
    message: 'secret-token in message',
    exception: { values: [{ type: 'PostgresError', value: 'Failing row contains (secret-token)', stacktrace: { frames: [{ filename: 'app.js', function: 'handler', lineno: 1 }] } }] },
    request: { url: 'https://vada.test/api/organizations/org-1/events', headers: { cookie: 'session=secret-token' }, data: '{"name":"secret-token"}' },
    user: { ip_address: '203.0.113.7', email: 'someone@vada.test' },
    breadcrumbs: [{ message: 'secret-token' }],
    extra: { body: 'secret-token' },
    server_name: 'DESKTOP-PERSONAL-PC',
    tags: { route: '/api/organizations/:organizationId/events' },
  } as unknown as ErrorEvent
  const sent = JSON.stringify(scrubEvent(event))
  for (const leaked of ['secret-token', '203.0.113.7', 'someone@vada.test', 'org-1', 'DESKTOP-PERSONAL-PC']) assert.ok(!sent.includes(leaked), leaked)
  const scrubbed = scrubEvent(event)
  assert.equal(scrubbed.exception?.values?.[0]?.type, 'PostgresError')
  assert.equal(scrubbed.exception?.values?.[0]?.stacktrace?.frames?.[0]?.function, 'handler')
  assert.deepEqual(scrubbed.tags, { route: '/api/organizations/:organizationId/events' })
})

test('DSN이 없으면 오류 수집을 켜지 않는다', () => {
  assert.equal(startErrorReporting(undefined, 'development'), false)
  assert.equal(startErrorReporting('  ', 'development'), false)
})
