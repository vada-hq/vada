// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { EventReportResponse } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import EventReport from './EventReport'
import { completedEvent, full, reportResponse, reportView } from './record-fixtures'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const path = '/api/organizations/o/events/e/report'
function setup(body: EventReportResponse, rights: { canWrite?: boolean; canPublish?: boolean } = {}) {
  const api = mockApi()
  api.on('GET', path, () => json(body))
  const onOpenEvent = vi.fn()
  const onDirtyChange = vi.fn()
  const onEvent = vi.fn()
  render(<EventReport organizationId="o" eventId="e" canWrite={rights.canWrite ?? true} canPublish={rights.canPublish ?? false}
    onOpenEvent={onOpenEvent} onDirtyChange={onDirtyChange} onEvent={onEvent} />)
  return { api, onOpenEvent, onDirtyChange, onEvent }
}
const field = (label: string) => screen.getByRole('textbox', { name: label }) as HTMLTextAreaElement
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement

test('쓰는 사람은 다섯 칸을 쓰고 저장한다. 고친 글이 있으면 알리고, 저장하면 서버 응답으로 바뀐다', async () => {
  const { api, onDirtyChange, onEvent } = setup(reportResponse())
  api.on('POST', path, call => json(reportResponse({ report: reportView({ ...(call.body as object), version: 2 }) })))
  expect(await screen.findByRole('textbox', { name: '현장 운영' })).toBeTruthy()
  expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'e' }))
  expect(screen.getByText('26명 → 22명')).toBeTruthy()
  expect(screen.getByText('담당 기획부 · 책임자 정민재')).toBeTruthy()
  expect(button('저장').disabled).toBe(true)
  fireEvent.change(field('잘된 점'), { target: { value: '조를 미리 정했다' } })
  expect(screen.getByText('저장하지 않은 글이 있어요.')).toBeTruthy()
  expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  fireEvent.click(button('저장'))
  expect(await screen.findByText('다섯 칸 중 2칸을 썼어요.')).toBeTruthy()
  expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ version: 1, operations: '10:00 시작', wentWell: '조를 미리 정했다',
    shortfalls: null, improvements: null, handover: null })
  expect(field('잘된 점').value).toBe('조를 미리 정했다')
})

test('앞뒤 공백만 바꾸거나 칸을 비우면 빈 칸(null)으로 보낸다', async () => {
  const { api } = setup(reportResponse())
  api.on('POST', path, () => json(reportResponse({ report: reportView({ operations: null, version: 2 }) })))
  fireEvent.change(await screen.findByRole('textbox', { name: '현장 운영' }), { target: { value: '10:00 시작  ' } })
  expect(button('저장').disabled).toBe(true)
  fireEvent.change(field('현장 운영'), { target: { value: '   ' } })
  fireEvent.click(button('저장'))
  await vi.waitFor(() => expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ version: 1, operations: null, wentWell: null,
    shortfalls: null, improvements: null, handover: null }))
})

test('칸이 너무 길면 그 칸에 알리고 저장을 끈다', async () => {
  setup(reportResponse())
  fireEvent.change(await screen.findByRole('textbox', { name: '인수인계' }), { target: { value: '가'.repeat(2001) } })
  expect(screen.getByText('글이 너무 길어요. 줄여 주세요.')).toBeTruthy()
  expect(button('저장').disabled).toBe(true)
})

test('처음 쓰는 보고서는 버전 0으로 저장한다', async () => {
  const { api } = setup(reportResponse({ report: null }))
  api.on('POST', path, () => json(reportResponse({ report: reportView({ operations: '진행', version: 1 }) })))
  expect(await screen.findByText('다섯 칸 중 0칸을 썼어요.')).toBeTruthy()
  expect(screen.getByText('작성 전')).toBeTruthy()
  fireEvent.change(field('현장 운영'), { target: { value: '진행' } })
  fireEvent.click(button('저장'))
  await vi.waitFor(() => expect(api.calls.find(call => call.method === 'POST')?.body).toMatchObject({ version: 0, operations: '진행' }))
})

test('회장단은 다섯 칸을 다 쓰고 저장한 보고서만 발행하고, 발행을 확인한다', async () => {
  const { api } = setup(reportResponse({ report: reportView({ ...full, version: 3 }) }), { canPublish: true })
  api.on('POST', `${path}/publish`, () => json(reportResponse({ report: reportView({ ...full, version: 4, status: 'published',
    published: { by: { id: 'l', name: '이서연' }, at: '2026-10-12T01:00:00.000Z' } }) })))
  const publish = await screen.findByRole('button', { name: '발행' }) as HTMLButtonElement
  expect(publish.disabled).toBe(false)
  fireEvent.change(field('인수인계'), { target: { value: '바꾸는 중' } })
  expect(publish.disabled).toBe(true)
  fireEvent.change(field('인수인계'), { target: { value: full.handover } })
  expect(publish.disabled).toBe(false)
  fireEvent.click(publish)
  const dialog = await screen.findByRole('dialog', { name: '결과보고서를 발행할까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '발행' }))
  expect(await screen.findByRole('button', { name: '발행 취소' })).toBeTruthy()
  expect(api.calls.find(call => call.path.endsWith('/publish'))?.body).toEqual({ version: 3 })
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.getByText('조를 미리 정했다')).toBeTruthy()
  expect(screen.getByText(/발행할 때 센 숫자예요\./)).toBeTruthy()
  expect(screen.getByText(/발행 2026\. 10\. 12\. · 이서연/)).toBeTruthy()
})

test('회장단이 발행을 취소하면 다시 쓰는 화면이 된다', async () => {
  const published = reportView({ ...full, version: 4, status: 'published', published: { by: { id: 'l', name: '이서연' }, at: '2026-10-12T01:00:00.000Z' } })
  const { api } = setup(reportResponse({ report: published }), { canPublish: true })
  api.on('POST', `${path}/unpublish`, () => json(reportResponse({ report: reportView({ ...full, version: 5 }) })))
  fireEvent.click(await screen.findByRole('button', { name: '발행 취소' }))
  const dialog = await screen.findByRole('dialog', { name: '발행을 취소할까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '발행 취소' }))
  expect(await screen.findByRole('textbox', { name: '현장 운영' })).toBeTruthy()
  expect(api.calls.find(call => call.path.endsWith('/unpublish'))?.body).toEqual({ version: 4 })
})

test('빈 칸이 있으면 발행을 끈다', async () => {
  setup(reportResponse(), { canPublish: true })
  expect((await screen.findByRole('button', { name: '발행' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText('다섯 칸 중 1칸을 썼어요.')).toBeTruthy()
})

test('미배정은 읽기만 한다. 쓰지 않은 칸은 아직 쓰지 않았다고 보인다', async () => {
  setup(reportResponse(), { canWrite: false })
  expect(await screen.findByText('10:00 시작')).toBeTruthy()
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.getAllByText('아직 쓰지 않았어요.')).toHaveLength(4)
  expect(screen.queryByRole('button', { name: '저장' })).toBeNull()
})

test('남이 먼저 발행했으면 쓴 글을 지우지 않고 이유와 새로 불러오기를 보인다', async () => {
  const { api } = setup(reportResponse())
  api.on('POST', path, () => json({ error: 'REPORT_PUBLISHED' }, 409))
  fireEvent.change(await screen.findByRole('textbox', { name: '잘된 점' }), { target: { value: '내가 쓴 글' } })
  fireEvent.click(button('저장'))
  expect(await screen.findByText('이미 발행한 결과보고서예요. 고치려면 회장단이 발행을 취소해야 해요.')).toBeTruthy()
  expect(field('잘된 점').value).toBe('내가 쓴 글')
  fireEvent.click(button('새로 불러오기'))
  await vi.waitFor(() => expect(api.calls.filter(call => call.method === 'GET')).toHaveLength(2))
})

test('행사 기록 보기를 누르면 행사 화면을 연다. 완료를 취소한 행사면 안내하고 읽기만 한다', async () => {
  const { onOpenEvent } = setup(reportResponse({ event: { ...completedEvent(), completedAt: null } }))
  expect(await screen.findByText('완료를 취소한 행사예요. 다시 완료하면 이어서 쓸 수 있어요.')).toBeTruthy()
  expect(screen.queryByRole('textbox')).toBeNull()
  fireEvent.click(button('행사 기록 보기'))
  expect(onOpenEvent).toHaveBeenCalled()
})

test('못 불러오면 다시 불러오기를 보인다', async () => {
  const api = mockApi()
  api.on('GET', path, () => json({ error: 'FORBIDDEN' }, 403))
  render(<EventReport organizationId="o" eventId="e" canWrite canPublish={false} onOpenEvent={vi.fn()} onDirtyChange={vi.fn()} onEvent={vi.fn()} />)
  expect(await screen.findByText('결과보고서를 불러오지 못했어요.')).toBeTruthy()
  expect(button('다시 불러오기')).toBeTruthy()
})
