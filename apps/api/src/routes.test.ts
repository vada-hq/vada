import { Hono } from 'hono'
import { expect, it } from 'vitest'
import { AlreadyExists, Blocked, NotFound, NotReady } from './errors.ts'
import { attach } from './routes.ts'

it.each([
  { ErrorType: NotFound, status: 404 },
  { ErrorType: Blocked, status: 422 },
  { ErrorType: AlreadyExists, status: 409 },
  { ErrorType: NotReady, status: 409 },
])('$ErrorType.name 오류의 상태 코드와 메시지를 보존한다', async ({ ErrorType, status }) => {
  const app = new Hono()
  const message = '요청을 처리할 수 없습니다'
  attach(app, undefined, {
    'shell.organization': async () => { throw new ErrorType(message) },
  })

  const response = await app.request('/api/shell/organization')
  expect(response.status).toBe(status)
  expect(await response.json()).toEqual({ message })
})

it('예상하지 못한 오류는 공통 오류 응답으로 바꾸지 않고 상위 처리기로 넘긴다', async () => {
  const app = new Hono()
  const failure = new Error('예상하지 못한 서버 오류')
  let received: Error | undefined
  app.onError((error, c) => {
    received = error
    return c.text('서버 오류', 500)
  })
  attach(app, undefined, {
    'shell.organization': async () => { throw failure },
  })

  const response = await app.request('/api/shell/organization')
  expect(received).toBe(failure)
  expect(response.status).toBe(500)
  expect(await response.text()).toBe('서버 오류')
})
