// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { APPLY_PATH, FORM_CODE, FORM_PATH, publicForm } from '@/test-support/registration-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { settle } from '@/test-support/settle'
import { APPLY_ERRORS, REGISTRATION_FORM_LOST } from '@/lib/registration-messages'
import ApplyPage from './ApplyPage'
import * as applyCommand from './apply-command'

vi.mock('./apply-command', async importActual => {
  const actual = await importActual<typeof import('./apply-command')>()
  return { ...actual, applyCommandId: vi.fn(actual.applyCommandId) }
})

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
  expect(screen.queryByText('신청 받는 중')).toBeNull()
  expect(screen.getByLabelText('이름')).toBeTruthy()
  expect(screen.getByLabelText('학번')).toBeTruthy()
  expect(screen.queryByLabelText('휴대폰 번호')).toBeNull()
  expect(screen.queryByRole('checkbox')).toBeNull()
  expect(screen.getByText(/지우는 날: 2027년 10월 24일/)).toBeTruthy()
})

// 참가비가 있는 양식만 입금을 대조하므로 고지의 목적에 입금 확인이 붙는다(DEC-93이 DEC-75를 고쳤다). 무료 양식에는 입금이 없다.
test('버튼 아래 고지의 목적: 참가비가 있으면 입금 확인까지, 없으면 참가 신청과 출석 확인만', async () => {
  setup()
  expect(await screen.findByText(/목적: 행사 참가 신청, 출석 확인, 입금 확인 ·/)).toBeTruthy()
  cleanup()
  setup(publicForm({ payerFee: 0, nonPayerFee: 5000 }))
  expect(await screen.findByText(/목적: 행사 참가 신청, 출석 확인, 입금 확인 ·/)).toBeTruthy()
  for (const free of [
    { payerFee: null, nonPayerFee: null },
    { payerFee: 0, nonPayerFee: 0 },
  ]) {
    cleanup()
    setup(publicForm({ ...free, collectsStudentId: false }))
    expect(await screen.findByText(/목적: 행사 참가 신청, 출석 확인 ·/)).toBeTruthy()
    expect(screen.queryByText(/입금 확인/)).toBeNull()
  }
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

test('신청하기는 늘 켜져 있고 누르면 문제 칸 아래에 이유가 보이며 아무것도 보내지 않는다', async () => {
  const { api } = setup()
  const button = (await screen.findByRole('button', { name: '신청하기' })) as HTMLButtonElement
  expect(button.disabled).toBe(false)
  fireEvent.click(button)
  expect(screen.getByText('이름을 입력해 주세요')).toBeTruthy()
  expect(screen.getByText('학번을 입력해 주세요')).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('이름')))
  fill('이름', '김새내')
  fill('학번', '12ab')
  expect(screen.queryByText('이름을 입력해 주세요')).toBeNull()
  fireEvent.click(button)
  expect(screen.getByText('학번은 숫자 6자리에서 12자리로 입력해 주세요')).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('학번')))
  fill('학번', '20260001')
  fill('이름', '   ')
  fireEvent.click(button)
  expect(screen.getByText('이름을 입력해 주세요')).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(0)
  expect(button.disabled).toBe(false)
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
  const { commandId, ...rest } = (posts[0]?.body ?? {}) as Record<string, string>
  expect(commandId).toMatch(/^[0-9a-f-]{36}$/)
  expect(rest).toEqual({ name: '김새내', studentId: '20260001', phone: '01012345678' })
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

test('초안의 공개 읽기 거절은 사유만 보이고 활성화된 다음 읽기에는 신청을 연다', async () => {
  const api = mockApi()
  let active = false
  api.on('GET', FORM_PATH, () =>
    active ? json(publicForm()) : json({ error: 'REGISTRATION_NOT_OPEN' }, 409),
  )
  render(<ApplyPage code={FORM_CODE} onApplied={vi.fn()} />)
  expect(await screen.findByText('지금은 신청을 받지 않아요.')).toBeTruthy()
  expect(screen.queryByText('신입생 환영회')).toBeNull()
  expect(screen.queryByText(/납부자|계좌|무료/)).toBeNull()
  expect(screen.queryByRole('form')).toBeNull()
  active = true
  document.dispatchEvent(new Event('visibilitychange'))
  expect(await screen.findByLabelText('이름')).toBeTruthy()
  active = false
  document.dispatchEvent(new Event('visibilitychange'))
  expect(await screen.findByText('지금은 신청을 받지 않아요.')).toBeTruthy()
  expect(screen.queryByText('신입생 환영회')).toBeNull()
  expect(screen.queryByRole('form')).toBeNull()
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

// 명령 번호(017-3): 같은 값의 재전송은 같은 번호, 값을 고치면 새 번호, 성공하면 표지를 지운다.
const idsOf = (api: ReturnType<typeof mockApi>) =>
  api.calls
    .filter(call => call.method === 'POST')
    .map(call => (call.body as { commandId: string }).commandId)
const MARKER = `vada.apply-command.${FORM_CODE}`

async function press() {
  fireEvent.click(await screen.findByRole('button', { name: '신청하기' }))
  await settle()
}
async function fillAll(name = '김새내') {
  await screen.findByLabelText('이름')
  fill('이름', name)
  fill('학번', '20260001')
}

test('실패 뒤 같은 값으로 다시 누르면 같은 번호를, 값을 고치면 새 번호를 보낸다', async () => {
  const { api } = setup()
  api.on('POST', APPLY_PATH, () => json({ error: 'FAILED' }, 500))
  await fillAll()
  await press()
  await press()
  fill('이름', '김새내2')
  await press()
  const [first, again, edited] = idsOf(api)
  expect(again).toBe(first)
  expect(edited).not.toBe(first)
})

test('화면을 닫았다 다시 열어 같은 값을 넣으면 같은 번호다', async () => {
  const { api } = setup()
  api.on('POST', APPLY_PATH, () => json({ error: 'FAILED' }, 500))
  await fillAll()
  await press()
  cleanup()
  render(<ApplyPage code={FORM_CODE} onApplied={vi.fn()} />)
  await fillAll()
  await press()
  const [first, reopened] = idsOf(api)
  expect(reopened).toBe(first)
})

test('기기에는 이름·학번·휴대폰이 남지 않는다', async () => {
  const { api } = setup(publicForm({ collectsPhone: true }))
  api.on('POST', APPLY_PATH, () => json({ error: 'FAILED' }, 500))
  await fillAll()
  fill('휴대폰 번호', '010-1234-5678')
  await press()
  const everything = JSON.stringify(Object.fromEntries(Object.entries(window.localStorage)))
  expect(window.localStorage.getItem(MARKER)).not.toBeNull()
  for (const secret of ['김새내', '20260001', '01012345678', '010-1234-5678'])
    expect(everything).not.toContain(secret)
})

test('성공하면 표지를 지우고 토큰을 둔다', async () => {
  const { api, onApplied } = setup()
  api.on('POST', APPLY_PATH, () => json({ error: 'FAILED' }, 500))
  await fillAll()
  await press()
  expect(window.localStorage.getItem(MARKER)).not.toBeNull()
  api.on('POST', APPLY_PATH, () => json({ token: 'tok123' }, 201))
  await press()
  await waitFor(() => expect(onApplied).toHaveBeenCalledWith('tok123'))
  expect(window.localStorage.getItem(MARKER)).toBeNull()
  expect(window.localStorage.getItem(`vada.registration.${FORM_CODE}`)).toBe('tok123')
  const [first, second] = idsOf(api)
  expect(second).toBe(first)
})

test('24시간이 지난 표지의 번호는 보내지 않는다', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-25T00:00:00Z'))
  const { api } = setup()
  api.on('POST', APPLY_PATH, () => json({ error: 'FAILED' }, 500))
  await fillAll()
  await press()
  vi.setSystemTime(new Date('2026-10-26T00:00:01Z'))
  await press()
  const [first, later] = idsOf(api)
  expect(later).not.toBe(first)
})

test('422 COMMAND_REUSED는 문구를 보이고 다음에는 새 번호를 보낸다', async () => {
  const { api } = setup()
  api.on('POST', APPLY_PATH, () => json({ error: 'COMMAND_REUSED' }, 422))
  await fillAll()
  await press()
  expect((await screen.findByRole('alert')).textContent).toBe(APPLY_ERRORS.COMMAND_REUSED)
  expect(window.localStorage.getItem(MARKER)).toBeNull()
  await press()
  const [first, second] = idsOf(api)
  expect(second).not.toBe(first)
})

test('409 COMMAND_CONFLICT는 양식을 다시 읽지 않고 같은 번호로 다시 보낼 수 있다', async () => {
  const { api } = setup()
  api.on('POST', APPLY_PATH, () => json({ error: 'COMMAND_CONFLICT' }, 409))
  await fillAll()
  await press()
  expect((await screen.findByRole('alert')).textContent).toBe(APPLY_ERRORS.COMMAND_CONFLICT)
  expect(api.calls.filter(call => call.method === 'GET' && call.path === FORM_PATH)).toHaveLength(1)
  await press()
  const [first, second] = idsOf(api)
  expect(second).toBe(first)
})

// 해시는 무거울 수 있어 보내는 중이 그려진 뒤에 돈다(저가 폰에서 누른 채 멈춘 것처럼 보이지 않게).
test('번호를 정하는 해시는 보내는 중 표시가 그려진 뒤에 돈다', async () => {
  const { api } = setup()
  api.on('POST', APPLY_PATH, () => json({ error: 'FAILED' }, 500))
  let busyAtHash: boolean | null = null
  vi.mocked(applyCommand.applyCommandId).mockImplementationOnce((code, body) => {
    busyAtHash = screen.getByRole<HTMLButtonElement>('button', { name: '신청하기' }).disabled
    return applyCommand.applyCommandId(code, body)
  })
  await fillAll()
  await press()
  expect(busyAtHash).toBe(true)
})

test('기본 양식 이름은 숨기고 별도 이름은 보인다', async () => {
  const form = publicForm()
  setup({ ...form, form: { ...form.form, name: '참가 신청' } })
  await screen.findByRole('heading', { name: form.event.name })
  expect(screen.queryByText('참가 신청')).toBeNull()
  cleanup()
  setup(form)
  expect(await screen.findByText(form.form.name)).toBeTruthy()
})

test.each([
  ['before_open', '시작 전', '10월 22일 (목) 09:00부터 신청할 수 있어요.'],
  ['full', '정원 마감', '정원이 다 찼어요.'],
  ['paused', '잠시 멈춤', '신청을 잠시 멈췄어요. 다시 열리면 이 링크로 신청할 수 있어요.'],
  ['closed', '마감', '신청이 마감됐어요.'],
] as const)(
  '%s는 신청 칸 대신 아이콘·제목·설명·돌아가기 카드가 보인다',
  async (status, title, description) => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const { api } = setup(
      publicForm({
        status,
        form: { ...publicForm().form, opensAt: '2026-10-22T09:00' },
      }),
    )
    const card = await screen.findByRole('region', { name: title })
    expect(within(card).getByRole('heading', { name: title })).toBeTruthy()
    expect(within(card).getByText(description)).toBeTruthy()
    expect(card.querySelector('svg[aria-hidden="true"]')).toBeTruthy()
    const button = within(card).getByRole('button', { name: '돌아가기' })
    expect(button.className).toContain('max-sm:min-h-11')
    expect(screen.queryByRole('form')).toBeNull()
    fireEvent.click(button)
    expect(back).toHaveBeenCalledOnce()
    expect(api.calls.some(call => call.method === 'POST')).toBe(false)
    back.mockRestore()
  },
)
