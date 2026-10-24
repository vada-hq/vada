// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest'
import { lastAddress, rememberAddress } from './last-address'

const C = '0199d1a0-0000-7000-8000-0000000000c1'
const T = '3f2b8c1e-6a4d-4e0b-9c57-1a2b3c4d5e6f'

beforeEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

test('학생회 안 주소를 기억하고 다시 읽는다', () => {
  rememberAddress('u1', `/tasks/${C}?view=all`)
  expect(lastAddress('u1')).toBe(`/tasks/${C}?view=all`)
  rememberAddress('u1', `/tasks/${C}/${T}`)
  expect(lastAddress('u1')).toBe(`/tasks/${C}/${T}`)
})

test('기억은 사람마다 따로다', () => {
  rememberAddress('u1', `/home/${C}`)
  expect(lastAddress('u2')).toBeNull()
})

test('공개 주소, 초대 주소, 바깥 주소, 토큰이 든 주소는 기억하지 않는다', () => {
  rememberAddress('u1', `/home/${C}`)
  for (const path of ['/apply/ABCD2345', '/r', '/join/ABCD2345', '//evil.com', '/', '/auth-done'])
    rememberAddress('u1', path)
  expect(lastAddress('u1')).toBe(`/home/${C}`)
  rememberAddress('u1', `/chat/${C}?token=secret&tab=notices#abc`)
  expect(lastAddress('u1')).toBe(`/chat/${C}?tab=notices`)
  expect(JSON.stringify(window.localStorage)).not.toContain('secret')
})

test('저장소에 망가진 값이 있어도 읽지 않는다', () => {
  window.localStorage.setItem('vada.last.address.u1', '//evil.com')
  expect(lastAddress('u1')).toBeNull()
})

test('저장소를 못 쓰는 브라우저에서도 던지지 않는다', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota')
  })
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(() => rememberAddress('u1', `/home/${C}`)).not.toThrow()
  expect(lastAddress('u1')).toBeNull()
})
