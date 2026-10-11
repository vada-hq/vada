// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { json, mockApi } from '../test-support/mock-api'
import TaskDetailDialog from './TaskDetailDialog'
import { taskDetail } from './task-fixtures'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })
const path = '/api/organizations/o1/events/e1/tasks/t1'
function setup(manageEvents = true, onOpenEvent?: (eventId: string) => void) {
  const api = mockApi()
  api.on('GET', path, () => json({ task: taskDetail({ description: '시안 두 개\n인쇄소 견적' }) }))
  const handlers = { onChanged: vi.fn(), onDeleted: vi.fn(), onEdit: vi.fn(), onClose: vi.fn() }
  render(<TaskDetailDialog organizationId="o1" target={{ eventId: 'e1', taskId: 't1' }} manageEvents={manageEvents} onOpenEvent={onOpenEvent} {...handlers} />)
  return { api, ...handlers }
}

test('상세는 칸과 처리 기록을 보이고, 상태를 고르면 버전과 함께 보낸 뒤 바뀌었다고 알린다', async () => {
  const { api, onChanged } = setup()
  api.on('POST', `${path}/status`, () => json({ task: taskDetail({ status: 'doing', version: 2, history: [...taskDetail().history,
    { id: 'h2', action: 'status_changed', actor: { id: 'u1', name: '테스터' }, changes: { status: { from: 'todo', to: 'doing' } }, createdAt: '2026-10-02T00:00:00Z' }] }) }))
  const dialog = await screen.findByRole('dialog', { name: '현수막 디자인' })
  for (const text of ['체육대회', '기획부', '윤태민', '10.20']) expect(within(dialog).getByText(text)).toBeTruthy()
  expect(within(dialog).getByText('시안 두 개\n인쇄소 견적', { normalizer: value => value })).toBeTruthy()
  expect(within(dialog).getByText(/테스터 · .+ · 만듦/)).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: '진행 중' }))
  expect(await within(dialog).findByText(/상태: 예정 → 진행 중/)).toBeTruthy()
  expect(api.calls.at(-1)?.body).toEqual({ version: 1, status: 'doing' })
  await waitFor(() => expect(onChanged).toHaveBeenCalled())
  expect(within(dialog).getByRole('button', { name: '진행 중' }).getAttribute('aria-pressed')).toBe('true')
})

test('지우기는 한 번 더 확인하고, 지운 뒤 남은 목록을 넘긴다', async () => {
  const { api, onDeleted } = setup()
  api.on('POST', `${path}/delete`, () => json({ tasks: [], registrationClosesAt: null }))
  const dialog = await screen.findByRole('dialog', { name: '현수막 디자인' })
  fireEvent.click(within(dialog).getByRole('button', { name: '지우기' }))
  expect(within(dialog).getByText('이 업무를 지울까요? 처리 기록도 함께 지워져요.')).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: '지우기' }))
  await waitFor(() => expect(onDeleted).toHaveBeenCalledWith({ tasks: [], registrationClosesAt: null }))
  expect(api.calls.at(-1)?.body).toEqual({ version: 1 })
})

test('부서가 없으면 상태·수정·지우기가 없고, 내 업무에서 열면 행사로 가기가 있다', async () => {
  const onOpenEvent = vi.fn()
  setup(false, onOpenEvent)
  const dialog = await screen.findByRole('dialog', { name: '현수막 디자인' })
  for (const name of ['예정', '진행 중', '완료', '수정', '지우기']) expect(within(dialog).queryByRole('button', { name })).toBeNull()
  fireEvent.click(within(dialog).getByRole('button', { name: '행사로 가기' }))
  expect(onOpenEvent).toHaveBeenCalledWith('e1')
})

test('지연이면 마감일에 지연을 붙인다', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-25T03:00:00Z'))
  setup()
  const dialog = await screen.findByRole('dialog', { name: '현수막 디자인' })
  expect(within(dialog).getByText('10.20 · 지연')).toBeTruthy()
})

test('완료한 업무의 설명은 완료한 때만 적고 "완료"를 두 번 쓰지 않는다', async () => {
  const api = mockApi()
  api.on('GET', path, () => json({ task: taskDetail({ status: 'done', completedAt: '2026-10-05T00:00:00Z' }) }))
  render(<TaskDetailDialog organizationId="o1" target={{ eventId: 'e1', taskId: 't1' }} manageEvents onClose={() => {}} onChanged={() => {}}
    onDeleted={() => {}} onEdit={() => {}} />)
  const dialog = await screen.findByRole('dialog', { name: '현수막 디자인' })
  const description = document.getElementById(dialog.getAttribute('aria-describedby')!)!.textContent!
  expect(description).toMatch(/ 완료$/)
  expect(description).not.toMatch(/^완료/)
})
