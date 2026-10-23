// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { APPLY_PATH, FORM_CODE, FORM_PATH, publicForm } from '@/test-support/registration-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { settle } from '@/test-support/settle'
import { APPLY_ERRORS, REGISTRATION_FORM_LOST } from '@/lib/registration-messages'
import ApplyPage from './ApplyPage'

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function setup(form = publicForm()) {
  const api = mockApi()
  api.on('GET', FORM_PATH, () => json(form))
  const onApplied = vi.fn()
  render(<ApplyPage code={FORM_CODE} onApplied={onApplied} />)
  return { api, onApplied }
}

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

test('받는 중이면 학교·행사·참가비·안내와 칸이 보이고, 휴대폰은 받지 않으면 없다', async () => {
  setup()
  expect(await screen.findByText('신입생 환영회')).toBeTruthy()
  expect(screen.getByText('소프트웨어학부 학생회')).toBeTruthy()
  expect(screen.getByText('학생회비 납부자 5,000원 · 미납자 10,000원')).toBeTruthy()
  expect(screen.getByText('10월 24일 (토) 14:00 ~ 18:00')).toBeTruthy()
  expect(screen.getByText('남은 자리 12')).toBeTruthy()
  expect(screen.getByLabelText('이름')).toBeTruthy()
  expect(screen.getByLabelText('학번')).toBeTruthy()
  expect(screen.queryByLabelText('휴대폰 번호')).toBeNull()
  expect(screen.queryByRole('checkbox')).toBeNull()
  expect(screen.getByText(/지우는 날: 2027년 10월 24일/)).toBeTruthy()
})

// 학생이 언제까지 신청할지 알아야 미루지 않는다(notes/frontend-findings.md RG-4).
test('받는 중이면 신청 마감이 보이고, 마감된 양식에는 없다', async () => {
  setup()
  expect(await screen.findByText('10월 23일 (금) 18:00까지')).toBeTruthy()
  cleanup()
  setup(publicForm({ status: 'closed' }))
  await screen.findByText('신청이 마감됐어요.')
  expect(screen.queryByText(/18:00까지/)).toBeNull()
})

test('참가비가 같으면 학번 칸이 없고 휴대폰을 받으면 칸이 생긴다', async () => {
  setup(publicForm({ payerFee: 0, nonPayerFee: 0, collectsStudentId: false, collectsPhone: true }))
  await screen.findByLabelText('이름')
  expect(screen.queryByLabelText('학번')).toBeNull()
  expect(screen.getByLabelText('휴대폰 번호')).toBeTruthy()
  expect(screen.getByText('무료')).toBeTruthy()
})

test('신청하기는 같은 스키마가 통과할 때만 켜지고, 계좌는 보이지 않는다', async () => {
  setup()
  const button = (await screen.findByRole('button', { name: '신청하기' })) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  fill('이름', '김새내')
  expect(button.disabled).toBe(true)
  fill('학번', '12ab')
  expect(button.disabled).toBe(true)
  fill('학번', '20260001')
  expect(button.disabled).toBe(false)
  fill('이름', '   ')
  expect(button.disabled).toBe(true)
  expect(document.body.textContent).not.toMatch(/계좌/)
})

test('신청하면 본문을 보내고 토큰을 기억하며 두 번 눌러도 한 번만 보낸다', async () => {
  const { api, onApplied } = setup(publicForm({ collectsPhone: true }))
  const pending = deferredResponse()
  api.on('POST', APPLY_PATH, () => pending.promise)
  await screen.findByLabelText('이름')
  fill('이름', ' 김새내 ')
  fill('학번', '20260001')
  fill('휴대폰 번호', '010-1234-5678')
  const button = await screen.findByRole('button', { name: '신청하기' })
  fireEvent.click(button)
  fireEvent.click(button)
  await settle()
  const posts = api.calls.filter(call => call.method === 'POST')
  expect(posts).toHaveLength(1)
  expect(posts[0]?.body).toEqual({ name: '김새내', studentId: '20260001', phone: '01012345678' })
  expect((button as HTMLButtonElement).disabled).toBe(true)
  await act(async () => pending.resolve(json({ token: 'tok123' }, 201)))
  await waitFor(() => expect(onApplied).toHaveBeenCalledWith('tok123'))
  expect(window.localStorage.getItem(`vada.registration.${FORM_CODE}`)).toBe('tok123')
  // 이동하는 동안 다시 눌러도 신청이 하나 더 생기지 않는다.
  expect((button as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(button)
  await settle()
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
})

test('실패 문구는 칸을 고치면 사라진다', async () => {
  const { api } = setup()
  api.on('POST', APPLY_PATH, () => json({ error: 'REGISTRATION_FULL' }, 409))
  await screen.findByLabelText('이름')
  fill('이름', '김새내')
  fill('학번', '20260001')
  fireEvent.click(screen.getByRole('button', { name: '신청하기' }))
  await screen.findByRole('alert')
  fill('이름', '김새내2')
  expect(screen.queryByRole('alert')).toBeNull()
})

test('409는 양식을 다시 읽고 버튼 옆에 문구를 보인다', async () => {
  const { api } = setup()
  api.on('POST', APPLY_PATH, () => json({ error: 'FORM_CHANGED' }, 409))
  await screen.findByLabelText('이름')
  fill('이름', '김새내')
  fill('학번', '20260001')
  fireEvent.click(await screen.findByRole('button', { name: '신청하기' }))
  expect((await screen.findByRole('alert')).textContent).toBe(APPLY_ERRORS.FORM_CHANGED)
  expect(api.calls.filter(call => call.method === 'GET' && call.path === FORM_PATH)).toHaveLength(2)
})

test('양식을 모르면 찾을 수 없다고 하고 칸이 없다', async () => {
  const api = mockApi()
  api.on('GET', FORM_PATH, () => json({ error: 'NOT_FOUND' }, 404))
  render(<ApplyPage code={FORM_CODE} onApplied={vi.fn()} />)
  expect((await screen.findByRole('alert')).textContent).toBe(REGISTRATION_FORM_LOST)
  expect(screen.queryByRole('form')).toBeNull()
})

test('받는 중이 아니면 칸 없이 이유를 보인다', async () => {
  setup(publicForm({ status: 'full', remaining: 0 }))
  expect(await screen.findByText('정원이 다 찼어요.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '신청하기' })).toBeNull()
})

test('같은 기기에 기억한 토큰이 있으면 내 신청 보기가 보이고 칸도 그대로 있다', async () => {
  window.localStorage.setItem(`vada.registration.${FORM_CODE}`, 'tok123')
  setup()
  const link = await screen.findByRole('link', { name: '내 신청 보기' })
  expect(link.getAttribute('href')).toBe('/r#tok123')
  expect(screen.getByText('이미 신청했어요.')).toBeTruthy()
  expect(screen.getByRole('button', { name: '신청하기' })).toBeTruthy()
})

test('시작 전이면 시작 시각을 보이고, 그 시각이 되면 다시 읽어 칸을 연다', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(new Date('2026-10-22T00:59:59+09:00'))
  const api = mockApi()
  let opened = false
  api.on('GET', FORM_PATH, () =>
    json(
      opened
        ? publicForm()
        : publicForm({
            status: 'before_open',
            form: { ...publicForm().form, opensAt: '2026-10-22T01:00' },
          }),
    ),
  )
  render(<ApplyPage code={FORM_CODE} onApplied={vi.fn()} />)
  await act(async () => {})
  expect(screen.getByText('10월 22일 (목) 01:00부터 신청할 수 있어요.')).toBeTruthy()
  expect(screen.queryByLabelText('이름')).toBeNull()
  opened = true
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2500)
  })
  expect(screen.getByLabelText('이름')).toBeTruthy()
})
