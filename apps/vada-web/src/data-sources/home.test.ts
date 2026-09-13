import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { DASHBOARD_FIXTURES } from '../development/data-fixtures'
import { homeField, readHomeSource } from './home'
import { findDataSource } from './definitions'
import { configureServer, fromServer, loadSources } from './server'

const ids = ['home.briefing', 'home.briefingNotices', 'home.eventCounts', 'home.events', 'home.schedules', 'home.orgAlerts', 'home.financeSummary'] as const
let restore = () => {}
afterEach(() => { restore() })

async function received(key: string, value: unknown, status = 200) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(value), { status }))
  restore = configureServer({ fetch })
  await loadSources([{ key, params: {} }])
  return fetch
}

describe.each(ids)('%s의 응답 계약', id => {
  it('정상 응답은 변환하거나 다시 요청하지 않고 읽는다', async () => {
    const fetch = await received(id, DASHBOARD_FIXTURES[id])
    expect(readHomeSource(id, id)).toBe(fromServer(id, {}))
    expect(readHomeSource(id, id)).toBe(fromServer(id, {}))
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('필수 필드가 빠지면 거부한다', async () => {
    const value = structuredClone(DASHBOARD_FIXTURES[id])
    const row = Array.isArray(value) ? value[0] : value
    const field = findDataSource(id).fields.find(field => field.optional !== true)!
    delete row[field.key]
    await received(id, value)
    expect(() => readHomeSource(id, id)).toThrow(/응답/)
  })

  it('필드의 자료형이 다르면 거부한다', async () => {
    const value = structuredClone(DASHBOARD_FIXTURES[id])
    const row = Array.isArray(value) ? value[0] : value
    const field = findDataSource(id).fields[0]!
    row[field.key] = typeof row[field.key] === 'number' ? '잘못된 숫자' : 42
    await received(id, value)
    expect(() => readHomeSource(id, id)).toThrow(/응답/)
  })
})

it('화면 명세가 다른 API를 가리키면 조회 전에 거부한다', () => {
  expect(() => readHomeSource('home.briefing', 'home.eventCounts')).toThrow(/연결/)
})

it('선택 필드가 생략된 행사와 빈 목록을 허용한다', async () => {
  const events = structuredClone(DASHBOARD_FIXTURES['home.events'])
  if (!Array.isArray(events)) throw new Error('행사 예시가 목록이 아닙니다')
  for (const event of events) delete event.delayedTaskCount
  await received('home.events', events)
  expect(readHomeSource('home.events', 'home.events')).toEqual(events)
  restore()
  await received('home.events', [])
  expect(readHomeSource('home.events', 'home.events')).toEqual([])
})

it.each([null, '1'])('선택 필드가 있으면 자료형을 확인한다: %s', async value => {
  const events = structuredClone(DASHBOARD_FIXTURES['home.events'])
  if (!Array.isArray(events)) throw new Error('행사 예시가 목록이 아닙니다')
  await received('home.events', events.map(event => ({ ...event, delayedTaskCount: value })))
  expect(() => readHomeSource('home.events', 'home.events')).toThrow(/응답/)
})

it('목록과 객체가 뒤바뀐 응답을 거부한다', async () => {
  await received('home.events', { title: '목록이 아님' })
  expect(() => readHomeSource('home.events', 'home.events')).toThrow(/응답/)
})

it.each([
  { key: 'home.briefing', value: null },
  { key: 'home.events', value: [null] },
  { key: 'home.events', value: [1] },
] as const)('객체가 아닌 응답·목록 항목을 거부한다: $key $value', async ({ key, value }) => {
  await received(key, value)
  expect(() => readHomeSource(key, key)).toThrow(/응답/)
})

it('조회 중에는 기존 로딩 Promise를 전달하고 완료 후 캐시를 읽는다', async () => {
  let complete!: (response: Response) => void
  restore = configureServer({ fetch: () => new Promise<Response>(resolve => { complete = resolve }) })
  let pending: unknown
  try { readHomeSource('home.briefing', 'home.briefing') } catch (error) { pending = error }
  expect(pending).toBeInstanceOf(Promise)
  complete(new Response(JSON.stringify({ title: '도착한 응답' })))
  await pending
  expect(readHomeSource('home.briefing', 'home.briefing')).toEqual({ title: '도착한 응답' })
})

it('서버 오류를 정상 응답으로 바꾸지 않는다', async () => {
  await expect(received('home.briefing', { message: '조회 실패' }, 500)).rejects.toThrow(/home.briefing/)
  expect(() => readHomeSource('home.briefing', 'home.briefing')).toThrow(/home.briefing/)
})

it('응답 종류와 필드 종류를 생성 타입으로 추론한다', () => {
  const counts = () => readHomeSource('home.eventCounts', 'home.eventCounts')
  const events = () => readHomeSource('home.events', 'home.events')
  expectTypeOf<ReturnType<typeof counts>['activeEvents']>().toEqualTypeOf<number>()
  expectTypeOf<ReturnType<typeof events>[number]['delayedTaskCount']>().toEqualTypeOf<number | undefined>()
  expectTypeOf<ReturnType<typeof events>[number]['title']>().toEqualTypeOf<string>()
})

it('명세가 지정한 필드를 읽고 없는 필드는 거부한다', () => {
  expect(homeField({ activeEvents: 1 }, 'activeEvents')).toBe(1)
  expect(() => homeField({ activeEvents: 1 }, 'renamed')).toThrow(/필드/)
  expect(() => homeField({ activeEvents: 1 }, undefined)).toThrow(/필드/)
})
