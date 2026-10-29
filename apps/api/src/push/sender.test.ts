import assert from 'node:assert/strict'
import { test } from 'node:test'
import webpush from 'web-push'
import { createPushSender as makePushSender } from './sender.js'

const createPushSender = (...args: Parameters<typeof makePushSender>) =>
  makePushSender(args[0], args[1], args[2] ?? (async () => {}))

const keys = webpush.generateVAPIDKeys()
const config = {
  publicKey: keys.publicKey,
  privateKey: keys.privateKey,
  subject: 'mailto:team@vada.test',
}
const target = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  keys: { p256dh: 'p', auth: 'a' },
}
const message = { title: 'VADA', body: '시험', url: '/' }

test('정한 설정으로 한 번 보내고 sent를 돌려준다', async () => {
  const calls: unknown[][] = []
  const send = createPushSender(config, async (...args) => {
    calls.push(args)
  })
  assert.deepEqual(await send(target, message), { result: 'sent' })
  assert.deepEqual(calls, [
    [
      target,
      JSON.stringify(message),
      {
        vapidDetails: {
          subject: config.subject,
          publicKey: config.publicKey,
          privateKey: config.privateKey,
        },
        TTL: 60,
        urgency: 'high',
        timeout: 10_000,
      },
    ],
  ])
})

test('보내는 쪽이 정한 TTL로 보내고, 정하지 않으면 60초다', async () => {
  const ttls: unknown[] = []
  const send = createPushSender(config, async (_target, _payload, options) => {
    ttls.push(options.TTL)
  })
  await send(target, message, { ttl: 86_400 })
  await send(target, message)
  assert.deepEqual(ttls, [86_400, 60])
})

test('404·410은 expired, 그 밖의 실패는 rejected이고, 알림 서버의 상태 번호를 함께 돌려준다', async () => {
  for (const [statusCode, result] of [
    [404, 'expired'],
    [410, 'expired'],
    [400, 'rejected'],
    [403, 'rejected'],
    [413, 'rejected'],
    [429, 'rejected'],
    [500, 'rejected'],
  ] as const) {
    const send = createPushSender(config, async () => {
      throw Object.assign(new Error('push failed'), { statusCode })
    })
    assert.deepEqual(
      await send(target, message),
      { result, status: statusCode },
      String(statusCode),
    )
  }
})

test('연결 오류는 오류 코드를 돌려주고, 메시지는 담지 않는다', async () => {
  for (const code of ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN']) {
    const send = createPushSender(config, async () => {
      throw Object.assign(new Error(`connect failed ${target.endpoint}`), { code })
    })
    assert.deepEqual(await send(target, message), { result: 'rejected', code }, code)
  }
})

test('상태 번호가 있으면 오류 코드는 담지 않는다', async () => {
  const send = createPushSender(config, async () => {
    throw Object.assign(new Error('push failed'), { statusCode: 403, code: 'ECONNRESET' })
  })
  assert.deepEqual(await send(target, message), { result: 'rejected', status: 403 })
})

test('진단으로 쓸 수 없는 오류는 결과만 돌려준다', async () => {
  const thrown: [string, unknown][] = [
    ['던진 null', null],
    ['던진 undefined', undefined],
    ['던진 문자열', 'ECONNRESET'],
    ['던진 숫자', 403],
    ['메시지에만 적힌 ECONNRESET', new Error('ECONNRESET')],
    ['소문자와 공백이 든 code', Object.assign(new Error('x'), { code: 'ERR_SOMETHING lowercase' })],
    ['줄바꿈이 붙은 code', Object.assign(new Error('x'), { code: 'ECONNRESET\n' })],
    ['숫자 code', Object.assign(new Error('x'), { code: 104 })],
    ['배열 code', Object.assign(new Error('x'), { code: ['ECONNRESET'] })],
    ['문자열 statusCode', Object.assign(new Error('x'), { statusCode: '403' })],
    ['NaN statusCode', Object.assign(new Error('x'), { statusCode: Number.NaN })],
  ]
  for (const [name, error] of thrown) {
    const send = createPushSender(config, async () => {
      throw error
    })
    assert.deepEqual(await send(target, message), { result: 'rejected' }, name)
  }
})

test('알려지지 않은 서버는 rejected를 돌려주고 send를 호출하지 않는다', async () => {
  const calls: unknown[][] = []
  const send = createPushSender(config, async (...args) => {
    calls.push(args)
  })
  const unknownTarget = { endpoint: 'https://127.0.0.1/x', keys: { p256dh: 'p', auth: 'a' } }
  assert.deepEqual(await send(unknownTarget, message), { result: 'rejected' })
  assert.deepEqual(calls, [])
})

for (const statusCode of [404, 410, 400, 403, 413]) {
  test(`${statusCode}는 재시도하지 않는다`, async () => {
    let calls = 0
    const waits: number[] = []
    const send = createPushSender(
      config,
      async () => {
        calls++
        throw Object.assign(new Error('secret'), { statusCode })
      },
      async ms => {
        waits.push(ms)
      },
    )
    const outcome = await send(target, message)
    assert.equal(outcome.result, statusCode === 404 || statusCode === 410 ? 'expired' : 'rejected')
    assert.equal(calls, 1)
    assert.deepEqual(waits, [])
  })
}

test('5xx 뒤 성공하면 sent이고 첫 기다림은 0.5초다', async () => {
  let calls = 0
  const waits: number[] = []
  const send = createPushSender(
    config,
    async () => {
      if (++calls === 1) throw Object.assign(new Error('secret'), { statusCode: 503 })
    },
    async ms => {
      waits.push(ms)
    },
  )
  assert.deepEqual(await send(target, message), { result: 'sent' })
  assert.equal(calls, 2)
  assert.deepEqual(waits, [500])
})

test('429의 Retry-After 초는 3초로 제한하고 HTTP 날짜도 읽는다', async () => {
  for (const header of ['10', new Date(Date.now() + 60_000).toUTCString()]) {
    let calls = 0
    const waits: number[] = []
    const send = createPushSender(
      config,
      async () => {
        if (++calls === 1)
          throw Object.assign(new Error('secret'), {
            statusCode: 429,
            headers: { 'retry-after': header },
          })
      },
      async ms => {
        waits.push(ms)
      },
    )
    assert.deepEqual(await send(target, message), { result: 'sent' })
    assert.deepEqual(waits, [3000])
  }
})

test('연결 오류는 최대 두 번 더 시도하고 마지막 진단을 돌려준다', async () => {
  const waits: number[] = []
  let calls = 0
  const send = createPushSender(
    config,
    async () => {
      calls++
      throw Object.assign(new Error('secret'), { code: calls === 3 ? 'ETIMEDOUT' : 'ECONNRESET' })
    },
    async ms => {
      waits.push(ms)
    },
  )
  assert.deepEqual(await send(target, message), { result: 'rejected', code: 'ETIMEDOUT' })
  assert.equal(calls, 3)
  assert.deepEqual(waits, [500, 1500])
})

test('알 수 없는 서비스는 기다림도 호출하지 않는다', async () => {
  const waits: number[] = []
  const send = createPushSender(
    config,
    async () => {
      assert.fail('보내면 안 됨')
    },
    async ms => {
      waits.push(ms)
    },
  )
  assert.deepEqual(await send({ ...target, endpoint: 'https://127.0.0.1/x' }, message), {
    result: 'rejected',
  })
  assert.deepEqual(waits, [])
})

test('읽을 수 없는 Retry-After는 기본 기다림을 쓴다', async () => {
  for (const header of ['invalid', '1.5', '-10']) {
    let calls = 0
    const waits: number[] = []
    const send = createPushSender(
      config,
      async () => {
        if (++calls === 1)
          throw Object.assign(new Error('secret'), {
            statusCode: 429,
            headers: { 'retry-after': header },
          })
      },
      async ms => {
        waits.push(ms)
      },
    )
    assert.deepEqual(await send(target, message), { result: 'sent' })
    assert.deepEqual(waits, [500])
  }
})

test('Retry-After의 HTTP 날짜는 주입한 시계로 남은 시간을 잰다', async () => {
  const now = new Date('2026-10-29T03:00:00Z')
  let calls = 0
  const waits: number[] = []
  const send = makePushSender(
    config,
    async () => {
      if (++calls === 1)
        throw Object.assign(new Error('secret'), {
          statusCode: 429,
          headers: { 'retry-after': new Date(now.getTime() + 1000).toUTCString() },
        })
    },
    async ms => {
      waits.push(ms)
    },
    () => now,
  )
  assert.deepEqual(await send(target, message), { result: 'sent' })
  assert.deepEqual(waits, [1000])
})
