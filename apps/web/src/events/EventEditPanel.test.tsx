// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { EventDetail, RegistrationForm } from '@vada/contracts'
import LeaveConfirm from '@/components/LeaveConfirm'
import { resetLeaveGuard } from '@/lib/leave-guard'
import { EVENT_ERRORS, LEAVE_CONFIRM, LEAVE_TITLE } from '@/lib/messages'
import { councilView } from '@/test-support/council-fixtures'
import { resetAddress } from '@/test-support/address-reset'
import { EVENT_ID, eventDetail, MEMBER, uuidTeam } from '@/test-support/event-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { settle } from '@/test-support/settle'
import { settlementOf } from '@/test-support/settlement-fixtures'
import { staffForm } from '@/test-support/staff-registration-fixtures'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import EventsPage from './EventsPage'

// 행사 기본정보 수정 패널(와이어프레임 EVT-02B, DEC-93). 머리의 [고치기]로 연다.
afterEach(async () => {
  cleanup()
  resetLeaveGuard()
  vi.unstubAllGlobals()
  await resetAddress()
})

const BASE = `/api/organizations/${COUNCIL_ID}/events`
const EVENT_AT = `/events/${COUNCIL_ID}/${EVENT_ID}`
const pathNow = () => window.location.pathname + window.location.search

function setup(event: EventDetail, forms: RegistrationForm[] = []) {
  const api = mockApi()
  api.on('GET', BASE, () => json({ events: [event], truncated: false }))
  api.on('GET', `${BASE}/${EVENT_ID}`, () => json({ event }))
  api.on('GET', `/api/organizations/${COUNCIL_ID}/members`, () => json(uuidTeam()))
  api.on(
    'GET',
    `/api/organizations/${COUNCIL_ID}/tasks?view=all&status=open&event=${EVENT_ID}`,
    () => json({ tasks: [], truncated: false }),
  )
  api.on('GET', `${BASE}/${EVENT_ID}/registration-forms`, () =>
    json({ forms, truncated: false, actions: [] }),
  )
  api.on('GET', `${BASE}/${EVENT_ID}/settlement`, () =>
    json(settlementOf({ remaining: [], settled: true })),
  )
  window.history.replaceState(null, '', EVENT_AT)
  const handlers = { onForbidden: vi.fn(), onTasksChanged: vi.fn() }
  // 떠날 때 확인 창은 작업 공간이 하나 둔다(CouncilWorkspace).
  render(
    <>
      <EventsPage view={councilView(COUNCIL_ID, { memberId: MEMBER.m1 })} {...handlers} />
      <LeaveConfirm />
    </>,
  )
  return { api }
}

async function openPanel() {
  fireEvent.click(await screen.findByRole('button', { name: '고치기' }))
  return screen.findByRole('dialog', { name: '행사 기본정보 수정' })
}

const editable = (extra: Partial<EventDetail> = {}) => eventDetail(extra, ['event.update'])

test('오른쪽 패널로 열리고, 머리에 끼룩이 한 줄과 구역마다 반영 힌트 한 줄이 있다', async () => {
  setup(editable())
  const panel = await openPanel()
  expect(panel.className).toContain('right-0')
  // 휴대폰은 전체 화면이다.
  expect(panel.className).toContain('w-full')
  expect(within(panel).getByText('저장하면 끼룩이가 일정·신청 화면에도 함께 반영해요')).toBeTruthy()
  const hint = (name: string, text: string) =>
    within(within(panel).getByRole('region', { name })).getByText(text)
  expect(hint('일시', '일정 및 신청 화면에 자동 반영')).toBeTruthy()
  expect(hint('장소', '신청 화면에 자동 반영')).toBeTruthy()
  expect(
    within(within(panel).getByRole('region', { name: '담당 및 안내' })).getByText('이재정'),
  ).toBeTruthy()
  const forms = within(panel).getByRole('region', { name: '참여 정보' })
  expect(within(forms).getByRole('button', { name: '신청 양식에서 수정' })).toBeTruthy()
  // 담당은 고치는 칸이 없다(DEC-93).
  expect(
    within(within(panel).getByRole('region', { name: '담당 및 안내' })).queryByRole('textbox'),
  ).toBeNull()
  // 입력칸에 예시 글이 없다.
  expect(panel.querySelector('[placeholder]')).toBeNull()
  // 이름 칸에 포커스가 간다.
  expect(document.activeElement).toBe(within(panel).getByLabelText('이름'))
})

test('종료 시간 미정·장소 미정을 체크하면 그 칸이 꺼지고 비운 값으로 저장한다', async () => {
  const { api } = setup(editable())
  api.on('POST', `${BASE}/${EVENT_ID}`, () => json({ event: editable() }))
  const panel = await openPanel()
  const end = within(panel).getByLabelText('종료 일시')
  const place = within(panel).getByLabelText('장소명')
  expect(end).toHaveProperty('value', '2026-10-24T18:00')
  fireEvent.click(within(panel).getByRole('checkbox', { name: '종료 시간 미정' }))
  fireEvent.click(within(panel).getByRole('checkbox', { name: '장소 미정' }))
  expect(end).toHaveProperty('disabled', true)
  expect(end).toHaveProperty('value', '')
  expect(place).toHaveProperty('disabled', true)
  fireEvent.click(within(panel).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    name: '신입생 환영회',
    startsAt: '2026-10-24T14:00',
    endsAt: null,
    place: null,
  })
})

test('비어 있는 끝과 장소는 미정 체크로 열리고, 체크를 풀면 칸이 켜진다', async () => {
  setup(editable({ endsAt: null, place: null }))
  const panel = await openPanel()
  const tbd = within(panel).getByRole('checkbox', { name: '장소 미정' })
  expect(tbd).toHaveProperty('checked', true)
  expect(within(panel).getByRole('checkbox', { name: '종료 시간 미정' })).toHaveProperty(
    'checked',
    true,
  )
  fireEvent.click(tbd)
  expect(within(panel).getByLabelText('장소명')).toHaveProperty('disabled', false)
})

test('[장소 넣기]로 열면 장소 미정이 풀린 채 장소 칸에 포커스가 간다', async () => {
  setup(editable({ place: null }))
  fireEvent.click(await screen.findByRole('button', { name: '장소 넣기' }))
  const panel = await screen.findByRole('dialog', { name: '행사 기본정보 수정' })
  expect(within(panel).getByRole('checkbox', { name: '장소 미정' })).toHaveProperty(
    'checked',
    false,
  )
  expect(document.activeElement).toBe(within(panel).getByLabelText('장소명'))
})

test('참여 정보는 양식의 참가비·정원을 읽기만 하고, [신청 양식에서 수정]은 패널을 닫고 참가 신청 탭을 연다', async () => {
  setup(editable(), [staffForm({ capacity: null, payerFee: 5000, nonPayerFee: 5000 })])
  const panel = await openPanel()
  const forms = within(panel).getByRole('region', { name: '참여 정보' })
  expect(await within(forms).findByText('5,000원')).toBeTruthy()
  expect(within(forms).getByText('제한 없음')).toBeTruthy()
  expect(within(forms).queryByRole('textbox')).toBeNull()
  expect(within(forms).queryByRole('spinbutton')).toBeNull()
  fireEvent.click(within(forms).getByRole('button', { name: '신청 양식에서 수정' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: '참가 신청' }).getAttribute('aria-selected')).toBe(
      'true',
    ),
  )
  expect(pathNow()).toBe(`${EVENT_AT}?tab=registrations`)
})

test('양식이 여럿이면 양식 이름마다 참가비·정원이 있고, 없으면 신청 양식 없음이다', async () => {
  setup(editable(), [
    staffForm({ name: '1부 신청', capacity: 30, payerFee: null, nonPayerFee: null }),
    staffForm({ id: 'f2', name: '2부 신청', capacity: 20, payerFee: 0, nonPayerFee: 3000 }),
  ])
  const panel = await openPanel()
  const forms = within(panel).getByRole('region', { name: '참여 정보' })
  expect(await within(forms).findByText('1부 신청')).toBeTruthy()
  expect(within(forms).getByText('없음')).toBeTruthy()
  expect(within(forms).getByText('30명')).toBeTruthy()
  expect(within(forms).getByText('학생회비 납부자 무료 · 미납자 3,000원')).toBeTruthy()
})

test('양식이 없으면 참여 정보에 신청 양식 없음이 보인다', async () => {
  setup(editable())
  const panel = await openPanel()
  const forms = within(panel).getByRole('region', { name: '참여 정보' })
  expect(await within(forms).findByText('신청 양식 없음')).toBeTruthy()
})

test('뒤로 가기는 패널만 닫고 행사 화면에 남는다', async () => {
  setup(editable())
  await openPanel()
  window.history.back()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(pathNow()).toBe(EVENT_AT)
  expect(screen.getByRole('heading', { name: '신입생 환영회' })).toBeTruthy()
})

const leaveAsked = () => screen.findByRole('dialog', { name: LEAVE_TITLE })
const stay = async () => {
  fireEvent.click(within(await leaveAsked()).getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByRole('dialog', { name: LEAVE_TITLE })).toBeNull())
}

test('고친 값이 있으면 Esc·뒤로·닫기는 먼저 묻고, 계속 쓰면 값이 남으며, 나가기면 닫힌다', async () => {
  setup(editable())
  const panel = await openPanel()
  fireEvent.change(within(panel).getByLabelText('이름'), { target: { value: '새 이름' } })
  fireEvent.keyDown(panel, { key: 'Escape' })
  await stay()
  window.history.back()
  await stay()
  fireEvent.click(within(panel).getAllByRole('button', { name: '닫기' })[1]!)
  await stay()
  expect(within(panel).getByLabelText('이름')).toHaveProperty('value', '새 이름')
  fireEvent.click(within(panel).getAllByRole('button', { name: '닫기' })[0]!)
  fireEvent.click(await screen.findByRole('button', { name: LEAVE_CONFIRM }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(pathNow()).toBe(EVENT_AT)
})

test('고친 값이 있으면 [신청 양식에서 수정]도 먼저 묻고, 나가기면 참가 신청 탭을 연다', async () => {
  setup(editable())
  const panel = await openPanel()
  fireEvent.click(within(panel).getByRole('checkbox', { name: '장소 미정' }))
  const forms = within(panel).getByRole('region', { name: '참여 정보' })
  fireEvent.click(within(forms).getByRole('button', { name: '신청 양식에서 수정' }))
  await stay()
  expect(pathNow()).toBe(EVENT_AT)
  fireEvent.click(within(forms).getByRole('button', { name: '신청 양식에서 수정' }))
  fireEvent.click(await screen.findByRole('button', { name: LEAVE_CONFIRM }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() => expect(pathNow()).toBe(`${EVENT_AT}?tab=registrations`))
})

test('고친 값이 있는 동안만 새로 고침·닫기에 브라우저 확인을 건다', async () => {
  setup(editable())
  const panel = await openPanel()
  const unload = () => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }
  expect(unload()).toBe(false)
  fireEvent.change(within(panel).getByLabelText('이름'), { target: { value: '새 이름' } })
  expect(unload()).toBe(true)
})

test('보내는 동안 버튼이 꺼지고 Esc·닫기(×)·뒤로로 닫히지 않으며, 저장하면 묻지 않고 닫힌다', async () => {
  const { api } = setup(editable())
  const pending = deferredResponse()
  api.on('POST', `${BASE}/${EVENT_ID}`, () => pending.promise)
  const panel = await openPanel()
  fireEvent.change(within(panel).getByLabelText('이름'), { target: { value: '새 이름' } })
  fireEvent.click(within(panel).getByRole('button', { name: '저장' }))
  await waitFor(() =>
    expect(within(panel).getByRole('button', { name: '저장' })).toHaveProperty('disabled', true),
  )
  fireEvent.keyDown(panel, { key: 'Escape' })
  fireEvent.click(within(panel).getAllByRole('button', { name: '닫기' })[0]!)
  window.history.back()
  await settle()
  expect(screen.getByRole('dialog', { name: '행사 기본정보 수정' })).toBeTruthy()
  expect(screen.queryByRole('dialog', { name: LEAVE_TITLE })).toBeNull()
  pending.resolve(json({ event: editable({ name: '새 이름' }) }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByRole('heading', { name: '새 이름' })).toBeTruthy()
})

test('저장이 실패하면 패널은 열린 채 버튼 줄 바로 위에 이유가 있다', async () => {
  const { api } = setup(editable())
  api.on('POST', `${BASE}/${EVENT_ID}`, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  const panel = await openPanel()
  fireEvent.click(within(panel).getByRole('button', { name: '저장' }))
  const alert = await within(panel).findByRole('alert')
  expect(alert.textContent).toBe(EVENT_ERRORS.TOO_MANY_REQUESTS)
  expect(alert.nextElementSibling?.textContent).toBe('닫기')
})
