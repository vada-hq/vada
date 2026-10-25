// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { EVENT_ENDED_NOTICE_DAYS, type EventAction, type EventDetail } from '@vada/contracts'
import { COMPLETION_ERRORS } from '@/lib/messages'
import { eventDetail } from '@/test-support/event-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { EventHeader, type EventEditing } from './EventHeader'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const EVENT = `/api/organizations/c1/events/${eventDetail().id}`

function show(event: EventDetail, editing: EventEditing | null = null) {
  const api = mockApi()
  const handlers = {
    onEdit: vi.fn(),
    onChanged: vi.fn(),
    onStale: vi.fn(),
    onLost: vi.fn(),
    onForbidden: vi.fn(),
  }
  render(
    <EventHeader
      councilId="c1"
      event={event}
      editing={editing}
      tabs={<div role="tablist" aria-label="행사 보기" />}
      {...handlers}
    />,
  )
  return { api, handlers }
}

const bar = () => screen.getByRole('group', { name: '행사 요약' })
const of = (extra: Partial<EventDetail>, actions: EventAction[] = []) => eventDetail(extra, actions)

test.each([
  ['tbd', '기획 중'],
  ['upcoming', '기획 중'],
  ['ongoing', '진행 중'],
  ['ended', '후속 정리 중'],
  ['completed', '완료'],
] as const)('%s 행사의 상태 칩은 %s이다', (status, label) => {
  show(of({ status }))
  expect(within(bar()).getByText(label)).toBeTruthy()
})

test('머리 요약은 탭 아래에 있고 건강도, 담당 부서·책임자, 행사일, 장소, 다음 일정을 보인다', () => {
  show(
    of({
      departments: ['기획부', '재정부'],
      health: { overdue: 2, unassigned: 1 },
      next: { kind: 'task', dueDate: '2026-10-20', title: '포스터 인쇄' },
    }),
  )
  const tabs = screen.getByRole('tablist')
  expect(tabs.compareDocumentPosition(bar()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  const text = bar().textContent
  expect(text).toContain('주의 · 지연 업무 2개 · 담당자 없는 업무 1개')
  expect(text).toContain('담당 기획부, 재정부 · 이재정')
  expect(text).toContain('10월 24일 (토) 14:00 ~ 18:00')
  expect(text).toContain('대강당')
  expect(text).toContain('다음 일정 · 10월 20일 (화) 포스터 인쇄')
})

test('업무 이슈가 없으면 안정이고, 업무가 없으면 담당 미정, 다음 일정이 없으면 없음이다', () => {
  show(of({ startsAt: null, endsAt: null, place: null, status: 'tbd' }))
  const text = bar().textContent
  expect(text).toContain('안정 · 업무 이슈 없음')
  expect(text).toContain('담당 미정 · 이재정')
  expect(text).toContain('일시 미정')
  expect(text).toContain('장소 미정')
  expect(text).toContain('다음 일정 없음')
})

test('다음 일정이 행사 시작이면 시각과 함께 보인다', () => {
  show(of({ next: { kind: 'start', startsAt: '2026-10-24T14:00' } }))
  expect(bar().textContent).toContain('다음 일정 · 10월 24일 (토) 14:00 행사 시작')
})

test('떠난 책임자는 운영진의 표시 이름으로 보인다', () => {
  show(of({ owner: { id: 'p9', name: '떠난 운영진 3', current: false } }))
  expect(bar().textContent).toContain('담당 미정 · 떠난 운영진 3')
})

test(`끝난 지 ${EVENT_ENDED_NOTICE_DAYS}일째부터 '끝난 지 N일'이 보인다`, () => {
  show(of({ status: 'ended', endedDays: EVENT_ENDED_NOTICE_DAYS - 1 }))
  expect(bar().textContent).not.toContain('끝난 지')
  cleanup()
  show(of({ status: 'ended', endedDays: EVENT_ENDED_NOTICE_DAYS }))
  expect(bar().textContent).toContain(`끝난 지 ${EVENT_ENDED_NOTICE_DAYS}일`)
})

test('[기본정보 수정]은 event.update가 있을 때만 있고 누르면 고치기를 연다', () => {
  const { handlers } = show(of({}, ['event.update']))
  fireEvent.click(within(bar()).getByRole('button', { name: '기본정보 수정' }))
  expect(handlers.onEdit).toHaveBeenCalledWith({ focus: undefined })
  cleanup()
  show(of({}))
  expect(screen.queryByRole('button', { name: '기본정보 수정' })).toBeNull()
})

test('[완료]는 event.complete가 있을 때 머리에 있고, 상태가 막았으면 그 자리에 까닭이 있다', () => {
  show(of({ status: 'ended' }, ['event.complete']))
  expect(within(bar()).getByRole('button', { name: '완료' })).toBeTruthy()
  cleanup()
  show(of({ status: 'ended', blockers: { 'event.complete': 'SETTLEMENT_PENDING' } }))
  expect(within(bar()).queryByRole('button', { name: '완료' })).toBeNull()
  expect(within(bar()).getByText(COMPLETION_ERRORS.SETTLEMENT_PENDING!)).toBeTruthy()
  cleanup()
  show(of({ status: 'ongoing' }))
  expect(screen.queryByRole('button', { name: '완료' })).toBeNull()
})

test('[완료]를 누르면 남은 항목 목록이 든 확인 창이 열리고, 완료하면 부모가 새 행사를 받는다', async () => {
  const { api, handlers } = show(of({ status: 'ended' }, ['event.complete']))
  const done = of({ status: 'completed' }, ['event.cancel_completion'])
  api.on('POST', `${EVENT}/complete`, () => json({ event: done }))
  fireEvent.click(within(bar()).getByRole('button', { name: '완료' }))
  const dialog = await screen.findByRole('dialog', { name: '이 행사를 완료할까요?' })
  const left = within(dialog).getByRole('list', { name: '남은 항목' })
  expect(
    within(left)
      .getAllByRole('listitem')
      .map(item => item.textContent),
  ).toEqual(['끝나지 않은 업무 2개'])
  fireEvent.click(within(dialog).getByRole('button', { name: '완료' }))
  await waitFor(() => expect(handlers.onChanged).toHaveBeenCalledWith(done))
})

test('남은 업무가 없으면 확인 창에 남은 항목 목록이 없다', async () => {
  show(of({ status: 'ended', tasks: { open: 0, total: 1 } }, ['event.complete']))
  fireEvent.click(within(bar()).getByRole('button', { name: '완료' }))
  const dialog = await screen.findByRole('dialog', { name: '이 행사를 완료할까요?' })
  expect(within(dialog).queryByRole('list', { name: '남은 항목' })).toBeNull()
})
