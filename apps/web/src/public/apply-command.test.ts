// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { sha256Hex } from '@/lib/sha256'
import { applyCommandId, clearApplyCommand, COMMAND_TTL_MS } from './apply-command'

const CODE = 'form-code'
const KEY = `vada.apply-command.${CODE}`
const body = { name: '김새내', studentId: '20260001', phone: '01012345678' }

beforeEach(() => window.localStorage.clear())
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const marker = () => JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Record<string, string>

test('같은 본문이면 같은 번호, 본문을 고치면 새 번호다', () => {
  const first = applyCommandId(CODE, body)
  expect(applyCommandId(CODE, { ...body })).toBe(first)
  expect(applyCommandId(CODE, { ...body, name: '김새내2' })).not.toBe(first)
})

test('코드마다 따로 센다', () => {
  expect(applyCommandId('other', body)).not.toBe(applyCommandId(CODE, body))
})

test('기기에는 번호, 해시, 시각만 남고 이름·학번·휴대폰은 어디에도 없다', () => {
  applyCommandId(CODE, body)
  const everything = JSON.stringify(Object.fromEntries(Object.entries(window.localStorage)))
  for (const secret of [body.name, body.studentId, body.phone])
    expect(everything).not.toContain(secret)
  expect(Object.keys(marker()).sort()).toEqual(['at', 'hash', 'id'])
  expect(marker().hash).toMatch(/^[0-9a-f]{64}$/)
})

test('같은 본문도 기기가 다르면 해시가 다르다(기기마다 무작위 소금)', () => {
  applyCommandId(CODE, body)
  const first = marker().hash
  window.localStorage.clear()
  applyCommandId(CODE, body)
  expect(marker().hash).not.toBe(first)
})

test('소금 없는 해시로는 짧은 값의 해시를 알아낼 수 없다', () => {
  applyCommandId(CODE, body)
  const guesses = [
    [body.name, body.studentId, body.phone],
    body,
    { commandId: marker().id, ...body },
  ]
  for (const guess of guesses) expect(marker().hash).not.toBe(sha256Hex(JSON.stringify(guess)))
})

test('24시간이 지난 표지는 쓰지 않는다', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-25T00:00:00Z'))
  const first = applyCommandId(CODE, body)
  vi.setSystemTime(Date.now() + COMMAND_TTL_MS - 1000)
  expect(applyCommandId(CODE, body)).toBe(first)
  vi.setSystemTime(Date.now() + 2000)
  expect(applyCommandId(CODE, body)).not.toBe(first)
})

test('다시 써도 24시간이 늘지 않는다(서버 영수증과 같은 때에 끝난다)', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-25T00:00:00Z'))
  const first = applyCommandId(CODE, body)
  vi.setSystemTime(Date.now() + COMMAND_TTL_MS / 2)
  expect(applyCommandId(CODE, body)).toBe(first)
  vi.setSystemTime(Date.now() + COMMAND_TTL_MS / 2 + 1000)
  expect(applyCommandId(CODE, body)).not.toBe(first)
})

test('지우면 새 번호다', () => {
  const first = applyCommandId(CODE, body)
  clearApplyCommand(CODE)
  expect(window.localStorage.getItem(KEY)).toBeNull()
  expect(applyCommandId(CODE, body)).not.toBe(first)
})

test('망가진 표지는 없는 것으로 본다', () => {
  window.localStorage.setItem(KEY, '{not json')
  expect(applyCommandId(CODE, body)).toMatch(/^[0-9a-f-]{36}$/)
  window.localStorage.setItem(KEY, JSON.stringify({ id: 1 }))
  expect(applyCommandId(CODE, body)).toMatch(/^[0-9a-f-]{36}$/)
})

test('저장소에 쓸 수 없으면 기억하지 않고 매번 새 번호를 주되 던지지 않는다', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota')
  })
  expect(applyCommandId(CODE, body)).not.toBe(applyCommandId(CODE, body))
})
