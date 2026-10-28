// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { TASK_BODY_MAX, TASK_TITLE_MAX, type TaskCreateOptionsResponse } from '@vada/contracts'
import LeaveConfirm from '@/components/LeaveConfirm'
import { resetLeaveGuard } from '@/lib/leave-guard'
import { LEAVE_CONFIRM, LEAVE_TITLE, PERMISSION_CHANGED } from '@/lib/messages'
import { windowHistoryIdle } from '@/lib/use-window-history'
import { councilView } from '@/test-support/council-fixtures'
import { EVENT_ID, eventSummary } from '@/test-support/event-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import { TaskCreateDialog } from './TaskCreateDialog'
import { TaskCreatePreview } from './TaskCreatePreview'

const BASE = `/api/organizations/${COUNCIL_ID}/tasks`
const ME = '0199d1a0-0000-7000-8000-0000000000a1'
const OTHER = '0199d1a0-0000-7000-8000-0000000000a2'
const D1 = '0199d1a0-0000-7000-8000-0000000000d1'
const D2 = '0199d1a0-0000-7000-8000-0000000000d2'
const D3 = '0199d1a0-0000-7000-8000-0000000000d3'
const view = councilView(COUNCIL_ID, { memberId: ME })
const none = { id: null, name: null }
const me = { id: ME, name: '김회장' }
const other = { id: OTHER, name: '박새내' }
const options: TaskCreateOptionsResponse = {
  departments: [
    { id: null, name: null, assignees: [none, me, other] },
    { id: D1, name: '기획부', assignees: [none, me, other] },
    { id: D2, name: '홍보부', assignees: [none, me] },
    { id: D3, name: '재정부', assignees: [other] },
  ],
  linkableEvents: [
    { departmentId: null, eventIds: [EVENT_ID] },
    { departmentId: D1, eventIds: [EVENT_ID] },
  ],
}
type Props = Parameters<typeof TaskCreateDialog>[0]

afterEach(async () => {
  cleanup()
  resetLeaveGuard()
  await windowHistoryIdle()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

function setup(overrides: Partial<Props> = {}) {
  window.history.replaceState(null, '', `/tasks/${COUNCIL_ID}`)
  const api = mockApi()
  api.on('GET', `/api/organizations/${COUNCIL_ID}/events`, () =>
    json({ events: [eventSummary()], truncated: false }),
  )
  api.on('POST', BASE, () => json({ task: taskDetail() }, 201))
  const handlers = {
    onClose: vi.fn(),
    onCreated: vi.fn(),
    onOpenTask: vi.fn(),
    onForbidden: vi.fn(),
  }
  function Example() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <TaskCreateDialog
          open={open}
          context={{ view, taskView: 'all', dept: null, eventId: undefined }}
          options={options}
          {...handlers}
          {...overrides}
          onClose={() => {
            handlers.onClose()
            setOpen(false)
          }}
        />
        <LeaveConfirm />
      </>
    )
  }
  render(<Example />)
  return { api, handlers, posts: () => api.calls.filter(call => call.method === 'POST') }
}

const title = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^제목/ })
const select = (name: string) =>
  screen.getByRole<HTMLSelectElement>('combobox', { name: new RegExp(`^${name}`) })
const choose = (name: string, value: string) =>
  fireEvent.change(select(name), { target: { value } })
const submit = () => fireEvent.click(screen.getByRole('button', { name: '업무 추가' }))
const close = () =>
  fireEvent.click(
    within(screen.getByRole('dialog', { name: '업무 추가' })).getAllByRole('button', {
      name: '닫기',
    })[0]!,
  )

test('세 묶음과 제목·설명·담당 부서·담당자·마감·행사를 보이며 자동값만이면 바로 닫는다', async () => {
  const { handlers } = setup()
  for (const name of ['업무 정의', '담당·일정', '연결 맥락'])
    expect(screen.getByRole('region', { name })).toBeTruthy()
  expect(title().maxLength).toBe(TASK_TITLE_MAX)
  expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: /^설명/ }).maxLength).toBe(
    TASK_BODY_MAX,
  )
  expect(select('담당 부서').value).toBe('')
  expect(select('담당자').value).toBe('')
  expect(select('행사').value).toBe('')
  expect(screen.getByLabelText(/^마감/).getAttribute('type')).toBe('date')
  expect(document.querySelector('[placeholder]')).toBeNull()
  close()
  expect(handlers.onClose).toHaveBeenCalledOnce()
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('빈 제목은 요청 없이 칸 아래 오류를 보이고 제목에 초점을 둔다', async () => {
  const { posts } = setup()
  fireEvent.change(title(), { target: { value: '  ' } })
  submit()
  expect(await screen.findByText('제목을 입력해 주세요')).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(title()))
  expect(title().getAttribute('aria-invalid')).toBe('true')
  expect(posts()).toHaveLength(0)
})

test('제목만으로 기본값을 보내고 닫기·다시 읽기·새 업무 열기를 차례대로 부른다', async () => {
  const { posts, handlers } = setup()
  fireEvent.change(title(), { target: { value: '포스터' } })
  submit()
  await waitFor(() => expect(handlers.onOpenTask).toHaveBeenCalledWith(taskDetail().id))
  expect(posts().map(call => call.body)).toEqual([
    {
      title: '포스터',
      body: null,
      dueDate: null,
      departmentId: null,
      assigneeId: null,
      eventId: null,
    },
  ])
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(handlers.onClose.mock.invocationCallOrder[0]).toBeLessThan(
    handlers.onCreated.mock.invocationCallOrder[0]!,
  )
  expect(handlers.onCreated.mock.invocationCallOrder[0]).toBeLessThan(
    handlers.onOpenTask.mock.invocationCallOrder[0]!,
  )
})

test('부서가 바뀌면 담당자는 기존 값·나·첫 값 순서이며 행사 선택지도 바뀐다', async () => {
  setup()
  await screen.findByRole('option', { name: '신입생 환영회' })
  choose('담당자', OTHER)
  choose('행사', EVENT_ID)
  choose('담당 부서', D1)
  expect(select('담당자').value).toBe(OTHER)
  expect(select('행사').value).toBe(EVENT_ID)
  choose('담당 부서', D2)
  expect(select('담당자').value).toBe(ME)
  expect(within(select('담당자')).queryByText('박새내')).toBeNull()
  expect(select('행사').value).toBe('')
  expect(within(select('행사')).queryByText('신입생 환영회')).toBeNull()
  choose('담당 부서', D3)
  expect(select('담당자').value).toBe(OTHER)
})

test('내 업무 기본 담당자는 나이고 미리 채운 부서·담당자가 선택지 밖이면 기본값으로 돌린다', () => {
  setup({
    context: { view, taskView: 'mine', dept: D1, eventId: undefined },
    initial: { departmentId: '없는 부서', assigneeId: '없는 사람' },
  })
  expect(select('담당 부서').value).toBe(D1)
  expect(select('담당자').value).toBe(ME)
})

test('행사 탭은 그 행사를 기본으로 보내고 부서를 바꿔도 그 행사 선택지를 남긴다', async () => {
  const { posts } = setup({ context: { view, taskView: 'all', dept: null, eventId: EVENT_ID } })
  await screen.findByRole('option', { name: '신입생 환영회' })
  expect(select('행사').value).toBe(EVENT_ID)
  choose('담당 부서', D2)
  expect(select('행사').value).toBe(EVENT_ID)
  fireEvent.change(title(), { target: { value: '행사 포스터' } })
  submit()
  await waitFor(() => expect(posts()).toHaveLength(1))
  expect(posts()[0]?.body).toMatchObject({ eventId: EVENT_ID, departmentId: D2 })
})

test('미리 채운 글만이면 묻지 않지만 설명을 고친 뒤 닫으면 나가기 확인이 뜬다', async () => {
  setup({ initial: { title: '포스터', body: '회의에서 정한 내용' } })
  expect(title().value).toBe('포스터')
  fireEvent.change(screen.getByRole('textbox', { name: /^설명/ }), {
    target: { value: '규격 확인' },
  })
  close()
  const confirm = await screen.findByRole('dialog', { name: LEAVE_TITLE })
  expect(within(confirm).getByRole('button', { name: LEAVE_CONFIRM })).toBeTruthy()
  fireEvent.click(within(confirm).getAllByRole('button', { name: '닫기' })[0]!)
  fireEvent.change(screen.getByRole('textbox', { name: /^설명/ }), {
    target: { value: '회의에서 정한 내용' },
  })
  close()
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '업무 추가' })).toBeNull())
})

test.each([false, true])(
  '기기 뒤로는 주소를 바꾸지 않고 창을 닫거나 쓴 글을 확인한다(입력: %s)',
  async dirty => {
    setup()
    if (dirty) fireEvent.change(title(), { target: { value: '포스터' } })
    await waitFor(() =>
      expect((window.history.state as { vadaWindow?: number } | null)?.vadaWindow).toBe(1),
    )
    await act(async () => {
      const popped = new Promise<void>(resolve =>
        window.addEventListener('popstate', () => resolve(), { once: true }),
      )
      window.history.back()
      await popped
    })
    if (dirty) expect(await screen.findByRole('dialog', { name: LEAVE_TITLE })).toBeTruthy()
    else await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(window.location.pathname).toBe(`/tasks/${COUNCIL_ID}`)
  },
)

test('보내는 동안 busy이며 중복 요청과 닫기를 막는다', async () => {
  const { api, posts, handlers } = setup()
  const pending = deferredResponse()
  api.on('POST', BASE, () => pending.promise)
  fireEvent.change(title(), { target: { value: '포스터' } })
  submit()
  const button = screen.getByRole('button', { name: '업무 추가' })
  await waitFor(() => expect(button.getAttribute('aria-busy')).toBe('true'))
  fireEvent.submit(screen.getByRole('form', { name: '업무 추가' }))
  close()
  expect(posts()).toHaveLength(1)
  expect(handlers.onClose).not.toHaveBeenCalled()
  pending.resolve(json({ task: taskDetail() }, 201))
  await waitFor(() => expect(handlers.onCreated).toHaveBeenCalledOnce())
})

test('403은 창 안에 이유를 보이고 학생회를 다시 읽게 한다', async () => {
  const { api, handlers } = setup()
  api.on('POST', BASE, () => json({ error: 'FORBIDDEN' }, 403))
  fireEvent.change(title(), { target: { value: '포스터' } })
  submit()
  expect((await screen.findByRole('alert')).textContent).toBe(PERMISSION_CHANGED)
  expect(handlers.onForbidden).toHaveBeenCalledOnce()
  expect(title().value).toBe('포스터')
})

test.each([
  ['제목', '가'.repeat(TASK_TITLE_MAX + 1)],
  ['제목', '\u0000'],
  ['제목', '\ud800'],
  ['설명', '가'.repeat(TASK_BODY_MAX + 1)],
  ['설명', '\u0000'],
])('계약이 막는 %s 입력은 칸 아래에 보이고 보내지 않는다', async (field, value) => {
  const { posts } = setup()
  fireEvent.change(title(), { target: { value: '포스터' } })
  const input = screen.getByRole('textbox', { name: new RegExp(`^${field}`) })
  fireEvent.change(input, { target: { value } })
  submit()
  await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'))
  expect(posts()).toHaveLength(0)
})

test('설명·마감을 미리 채우고 마감을 비워 만들 수 있다', async () => {
  const { posts } = setup({
    initial: { title: '포스터', body: '회의에서 정한 내용', dueDate: '2026-11-03' },
  })
  expect(screen.getByLabelText<HTMLInputElement>(/^마감/).value).toBe('2026-11-03')
  fireEvent.change(screen.getByLabelText(/^마감/), { target: { value: '' } })
  submit()
  await waitFor(() => expect(posts()).toHaveLength(1))
  expect(posts()[0]?.body).toMatchObject({ body: '회의에서 정한 내용', dueDate: null })
})

test('갤러리의 학생회·행사 견본은 실제 계약 검사를 통과해 창을 닫는다', async () => {
  render(<TaskCreatePreview>{() => null}</TaskCreatePreview>)
  for (const name of ['업무 추가 창 열기', '행사 업무 추가 창 열기']) {
    fireEvent.click(screen.getByRole('button', { name }))
    expect(screen.getByRole('dialog', { name: '업무 추가' })).toBeTruthy()
    submit()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await windowHistoryIdle()
  }
})
