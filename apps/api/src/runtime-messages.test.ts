import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readRuntime } from './runtime.js'

const env = {
  DATABASE_URL: 'postgres://example.invalid/test',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'https://m1.example.test',
  GOOGLE_CLIENT_ID: 'test',
  GOOGLE_CLIENT_SECRET: 'test',
}
const noLocal = () => ({})
const messageOf = (environment: NodeJS.ProcessEnv, production = false) => {
  try {
    readRuntime(environment, production, noLocal)
  } catch (error) {
    return (error as Error).message
  }
  return null
}

test('각 설정 실수는 정해진 메시지로 시작을 막는다', () => {
  const required = '필수 서버 환경설정을 확인하세요.'
  assert.equal(messageOf({ ...env, DATABASE_URL: '  ' }), required)
  assert.equal(messageOf({ ...env, GOOGLE_CLIENT_SECRET: undefined }), required)
  assert.equal(messageOf({ ...env, BETTER_AUTH_SECRET: 'x'.repeat(31) }), required)
  assert.equal(messageOf({ ...env, BETTER_AUTH_URL: 'not a url' }), '인증 URL 설정을 확인하세요.')
  const origin = '인증 URL은 서비스 원점이어야 하며 운영 환경은 HTTPS가 필요합니다.'
  for (const url of [
    'ftp://m1.example.test',
    'https://user@m1.example.test',
    'https://user:pw@m1.example.test',
    'https://m1.example.test/?a=1',
    'https://m1.example.test/#a',
    'https://m1.example.test/path',
    'http://m1.example.test',
  ]) {
    assert.equal(messageOf({ ...env, BETTER_AUTH_URL: url }, true), origin, url)
  }
  assert.equal(messageOf({ ...env, BETTER_AUTH_URL: 'http://m1.example.test' }), null)
  for (const port of ['0', '-1', '1.5', '65536', '']) {
    assert.equal(messageOf({ ...env, PORT: port }), 'PORT 설정을 확인하세요.', port)
  }
  assert.equal(readRuntime({ ...env, PORT: '65535' }, false, noLocal).port, 65535)
})

test('loopback 주소는 운영에서도 http로 둘 수 있고 HOST로 바인드를 바꾼다', () => {
  for (const url of ['http://localhost:3000', 'http://127.0.0.1', 'http://[::1]:8891']) {
    assert.equal(messageOf({ ...env, BETTER_AUTH_URL: url }, true), null, url)
  }
  assert.equal(readRuntime({ ...env, HOST: ' 10.0.0.5 ' }, true, noLocal).hostname, '10.0.0.5')
  assert.equal(readRuntime({ ...env, HOST: ' ' }, true, noLocal).hostname, '0.0.0.0')
  assert.equal(readRuntime({ ...env, HOST: ' ' }, false, noLocal).hostname, '127.0.0.1')
})
