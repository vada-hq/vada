// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { EventReportResponse } from '@vada/contracts'
import { deferredResponse, json, mockApi } from '../test-support/mock-api'
import EventReport from './EventReport'
import { completedEvent, reportResponse, retrospectiveView } from './record-fixtures'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const path = '/api/organizations/o/events/e/report'
const retro = `${path}/retrospective`
function setup(body: EventReportResponse, canWrite = true) {
  const api = mockApi()
  api.on('GET', path, () => json(body))
  const onOpenEvent = vi.fn()
  const onDirtyChange = vi.fn()
  const onEvent = vi.fn()
  render(<EventReport organizationId="o" eventId="e" canWrite={canWrite} onOpenEvent={onOpenEvent} onDirtyChange={onDirtyChange} onEvent={onEvent} />)
  return { api, onOpenEvent, onDirtyChange, onEvent }
}
const button = (name: string | RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement
const posts = (api: ReturnType<typeof mockApi>) => api.calls.filter(call => call.method === 'POST')
const confirmedBy = (name: string) => ({ by: { id: 'u2', name }, at: '2026-10-02T01:00:00.000Z' })

test('결과보고서는 머리·숫자·회고·준비 과정을 한 단으로 보이고, 준비 과정은 행사일 기준 D-n으로 묶는다', async () => {
  const { onEvent, onOpenEvent } = setup(reportResponse())
  expect(await screen.findByText('26명 → 22명')).toBeTruthy()
  expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'e' }))
  const summary = screen.getByRole('region', { name: '결과보고서 요약' })
  expect(within(summary).getByText('담당 기획부 · 책임자 정민재')).toBeTruthy()
  expect(within(summary).getByText('완료 2026. 9. 30.')).toBeTruthy()
  fireEvent.click(within(summary).getByRole('button', { name: '행사 기록 보기' }))
  expect(onOpenEvent).toHaveBeenLastCalledWith()
  const steps = screen.getByRole('region', { name: '준비 과정' })
  expect(within(steps).getByText('D-25 · 9월 1일')).toBeTruthy()
  expect(within(steps).getByText('D-day · 9월 26일')).toBeTruthy()
  expect(within(steps).getByText('홍보부 · 마감 9월 22일 · 2일 늦음')).toBeTruthy()
  // 읽는 사람이 교훈을 먼저 보도록 회고가 준비 과정보다 앞에 있다.
  const lessons = screen.getByRole('region', { name: '회고' })
  expect(lessons.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('준비 과정 줄을 누르면 그 탭으로 간다. 참가자 탭을 못 보는 사람은 신청 줄을 누를 수 없고, 행사 줄은 누르지 않는다', async () => {
  const { onOpenEvent } = setup(reportResponse())
  fireEvent.click(await screen.findByRole('button', { name: /업무 완료: 현수막/ }))
  expect(onOpenEvent).toHaveBeenLastCalledWith({ tab: 'tasks' })
  fireEvent.click(button(/지출 46,000원: 쿠팡/))
  expect(onOpenEvent).toHaveBeenLastCalledWith({ tab: 'finance' })
  fireEvent.click(button(/구매 요청 2건/))
  expect(onOpenEvent).toHaveBeenLastCalledWith({ tab: 'purchases' })
  fireEvent.click(button(/참가 신청 시작/))
  expect(onOpenEvent).toHaveBeenLastCalledWith({ tab: 'registrations' })
  expect(screen.queryByRole('button', { name: /행사 만듦/ })).toBeNull()
  cleanup()
  setup(reportResponse(), false)
  expect(await screen.findByText('참가 신청 시작')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /참가 신청 시작/ })).toBeNull()
  expect(button(/업무 완료: 현수막/)).toBeTruthy()
})

test('회고가 없으면 쓰는 사람은 끼룩이 안내와 단추를, 보는 사람은 "아직 회고가 없어요"를 본다. 만들면 초안이 보인다', async () => {
  const { api } = setup(reportResponse())
  const generated = deferredResponse()
  api.on('POST', `${retro}/generate`, () => generated.promise)
  expect(await screen.findByText('대화와 기록은 OpenAI로 보내요. 신청자 정보는 보내지 않아요.')).toBeTruthy()
  fireEvent.click(button('회고 초안 만들기'))
  expect(await screen.findByText('끼룩이가 정리하는 중… 1분쯤 걸릴 수 있어요.')).toBeTruthy()
  expect(posts(api)[0]?.body).toEqual({ version: 0 })
  generated.resolve(json(reportResponse({ retrospective: retrospectiveView() })))
  expect(await screen.findByText('조를 미리 정했다.')).toBeTruthy()
  const card = screen.getByRole('region', { name: '회고' })
  expect(within(card).getByText('초안')).toBeTruthy()
  expect(within(card).getByText('끼룩이가 10월 1일에 만든 초안이에요. 확인하기 전까지 초안으로 보여요.')).toBeTruthy()
  for (const title of ['잘된 점', '아쉬운 점', '다음 행사에서', '확인 필요']) expect(within(card).getByText(title)).toBeTruthy()
  expect(within(card).getByText('아직 답이 없어요.')).toBeTruthy()
  cleanup()
  setup(reportResponse(), false)
  expect(await screen.findByText('아직 회고가 없어요.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '회고 초안 만들기' })).toBeNull()
})

test('근거를 누르면 대화는 그 메시지로, 기록 줄은 그 탭으로 간다. 숫자와 바뀐 기록은 누를 수 없다', async () => {
  const { onOpenEvent } = setup(reportResponse({ retrospective: retrospectiveView() }))
  fireEvent.click(await screen.findByRole('button', { name: '“조 편성 끝났어요” · 9월 20일' }))
  expect(onOpenEvent).toHaveBeenLastCalledWith({ tab: 'chat', messageId: 'm1' })
  const card = screen.getByRole('region', { name: '회고' })
  fireEvent.click(within(card).getByRole('button', { name: '업무 완료: 현수막' }))
  expect(onOpenEvent).toHaveBeenLastCalledWith({ tab: 'tasks' })
  expect(within(card).getByText('업무 3건 중 3건 완료 · 지연 1건')).toBeTruthy()
  expect(within(card).queryByRole('button', { name: '업무 3건 중 3건 완료 · 지연 1건' })).toBeNull()
  expect(within(card).getByText('바뀐 기록')).toBeTruthy()
})

test('확인하면 확인함과 확인한 사람이 보이고 [확인]은 사라진다', async () => {
  const { api } = setup(reportResponse({ retrospective: retrospectiveView() }))
  api.on('POST', `${retro}/confirm`, () => json(reportResponse({ retrospective: retrospectiveView({ version: 2, confirmed: confirmedBy('한지우') }) })))
  fireEvent.click(await screen.findByRole('button', { name: '확인' }))
  expect(await screen.findByText('한지우 님이 10월 2일에 확인했어요.')).toBeTruthy()
  expect(posts(api)[0]?.body).toEqual({ version: 1 })
  expect(screen.getByText('확인함')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '확인' })).toBeNull()
})

test('고치기: 문장을 고치고 지우고 더하고 확인 필요에 답한 뒤 [저장하고 확인]으로 보낸다. 고치는 동안 저장하지 않은 글을 알린다', async () => {
  const { api, onDirtyChange } = setup(reportResponse({ retrospective: retrospectiveView() }))
  api.on('POST', retro, () => json(reportResponse({ retrospective: retrospectiveView({ version: 2, confirmed: confirmedBy('정민재'),
    wentWell: [{ id: 'w1', text: '조를 일찍 정했다.', sources: [] }] }) })))
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  const first = screen.getByRole('textbox', { name: '잘된 점 1' }) as HTMLTextAreaElement
  expect(first.value).toBe('조를 미리 정했다.')
  fireEvent.change(first, { target: { value: '조를 일찍 정했다.' } })
  expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  fireEvent.click(button('아쉬운 점 1 지우기'))
  fireEvent.click(within(screen.getByRole('group', { name: '다음 행사에서' })).getByRole('button', { name: '문장 더하기' }))
  fireEvent.change(screen.getByRole('textbox', { name: '다음 행사에서 2' }), { target: { value: '현수막 업체를 미리 정하자.' } })
  // 빈 새 문장은 저장할 때 뺀다.
  fireEvent.click(within(screen.getByRole('group', { name: '잘된 점' })).getByRole('button', { name: '문장 더하기' }))
  fireEvent.change(screen.getByRole('textbox', { name: '답: 참석이 4명 적은 이유가 있었나요?' }), { target: { value: '비가 왔다.' } })
  fireEvent.click(button('저장하고 확인'))
  expect(await screen.findByText('정민재 님이 10월 2일에 확인했어요.')).toBeTruthy()
  expect(posts(api)[0]?.body).toEqual({ version: 1, wentWell: [{ id: 'w1', text: '조를 일찍 정했다.' }], shortfalls: [],
    nextTime: [{ id: 'n1', text: '현수막은 D-10에 맡기자.' }, { id: null, text: '현수막 업체를 미리 정하자.' }],
    questions: [{ id: 'q1', answer: '비가 왔다.' }] })
  expect(screen.queryByRole('textbox', { name: '잘된 점 1' })).toBeNull()
  expect(onDirtyChange).toHaveBeenLastCalledWith(false)
})

test('너무 긴 문장은 그 칸에 알리고 저장을 끈다. [취소]하면 고친 내용을 버린다', async () => {
  setup(reportResponse({ retrospective: retrospectiveView() }))
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  fireEvent.change(screen.getByRole('textbox', { name: '잘된 점 1' }), { target: { value: '가'.repeat(201) } })
  expect(screen.getByText('글이 너무 길어요. 줄여 주세요.')).toBeTruthy()
  expect(button('저장하고 확인').disabled).toBe(true)
  fireEvent.click(button('취소'))
  expect(screen.getByText('조를 미리 정했다.')).toBeTruthy()
})

test('다시 만들기는 확인을 묻고 지금 버전으로 보낸다', async () => {
  const { api } = setup(reportResponse({ retrospective: retrospectiveView({ version: 3, confirmed: confirmedBy('정민재') }) }))
  api.on('POST', `${retro}/generate`, () => json(reportResponse({ retrospective: retrospectiveView({ version: 4,
    wentWell: [{ id: 'w9', text: '새 초안 문장.', sources: [] }] }) })))
  fireEvent.click(await screen.findByRole('button', { name: '다시 만들기' }))
  const dialog = await screen.findByRole('dialog', { name: '다시 만들까요?' })
  expect(within(dialog).getByText('지금 회고(고친 문장·답·확인)는 지워지고 새 초안이 돼요.')).toBeTruthy()
  // 다시 만드는 사람에게도 AI 처리 사실을 알린다(처음 만든 사람과 다를 수 있다).
  expect(within(dialog).getByText('대화와 기록은 OpenAI로 보내요. 신청자 정보는 보내지 않아요.')).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: '다시 만들기' }))
  expect(await screen.findByText('새 초안 문장.')).toBeTruthy()
  expect(posts(api)[0]?.body).toEqual({ version: 3 })
  expect(screen.getByText('초안')).toBeTruthy()
})

test('오류: 남이 먼저 바꿨거나 응답을 못 받으면 [새로 불러오기]를, 끼룩이 실패·설정 없음은 이유를 보인다', async () => {
  const { api } = setup(reportResponse({ retrospective: retrospectiveView() }))
  api.on('POST', `${retro}/confirm`, () => json({ error: 'VERSION_CONFLICT' }, 409))
  fireEvent.click(await screen.findByRole('button', { name: '확인' }))
  expect(await screen.findByText('다른 사람이 먼저 바꿨어요. 새로 불러와 주세요.')).toBeTruthy()
  fireEvent.click(button('새로 불러오기'))
  await vi.waitFor(() => expect(api.calls.filter(call => call.method === 'GET')).toHaveLength(2))
  cleanup()
  const second = setup(reportResponse())
  second.api.on('POST', `${retro}/generate`, () => { throw new TypeError('Failed to fetch') })
  fireEvent.click(await screen.findByRole('button', { name: '회고 초안 만들기' }))
  expect(await screen.findByText('결과를 확인하지 못했어요. 새로 불러와 주세요.')).toBeTruthy()
  expect(button('새로 불러오기')).toBeTruthy()
  for (const [code, status, text] of [['GENERATION_FAILED', 502, '끼룩이가 초안을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.'],
    ['AI_NOT_CONFIGURED', 503, '지금은 끼룩이를 쓸 수 없어요.']] as const) {
    second.api.on('POST', `${retro}/generate`, () => json({ error: code }, status))
    fireEvent.click(button('회고 초안 만들기'))
    expect(await screen.findByText(text)).toBeTruthy()
    expect(screen.queryByRole('button', { name: '새로 불러오기' })).toBeNull()
  }
})

test('보는 사람은 단추가 없고, 완료를 취소한 행사는 안내만 보인다. 낡은 초안과 빈 초안을 알린다', async () => {
  setup(reportResponse({ retrospective: retrospectiveView({ stale: true }) }), false)
  expect(await screen.findByText('초안을 만든 뒤 완료를 다시 했어요. 행사 기록이 바뀌었을 수 있어요.')).toBeTruthy()
  for (const name of ['확인', '고치기', '다시 만들기']) expect(screen.queryByRole('button', { name })).toBeNull()
  cleanup()
  setup(reportResponse({ event: { ...completedEvent(), completedAt: null }, retrospective: retrospectiveView() }))
  expect(await screen.findByText('완료를 취소한 행사예요. 다시 완료하면 회고를 만들거나 고칠 수 있어요.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '고치기' })).toBeNull()
  cleanup()
  setup(reportResponse({ retrospective: retrospectiveView({ wentWell: [], shortfalls: [], nextTime: [], questions: [] }) }))
  expect(await screen.findByText('끼룩이가 근거로 정리할 내용을 찾지 못했어요.')).toBeTruthy()
})
