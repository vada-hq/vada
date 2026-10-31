// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { FormQuestion } from '@vada/contracts'
import { APPLY_PATH, FORM_CODE, FORM_PATH, publicForm } from '@/test-support/registration-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import ApplyPage from './ApplyPage'

const Q = (n: number) => `00000000-0000-4000-8000-00000000070${n}`
const questions: FormQuestion[] = [
  { id: Q(1), kind: 'short_text', title: '이니셜', required: true, choices: [] },
  {
    id: Q(2),
    kind: 'single_choice',
    title: '티셔츠 사이즈',
    required: true,
    choices: [
      { id: Q(3), label: 'S' },
      { id: Q(4), label: 'M' },
    ],
  },
  {
    id: Q(5),
    kind: 'multiple_choice',
    title: '참가 종목',
    required: false,
    choices: [
      { id: Q(6), label: '축구' },
      { id: Q(7), label: '농구' },
    ],
  },
]

beforeEach(() => window.localStorage.clear())
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function setup() {
  const api = mockApi()
  api.on('GET', FORM_PATH, () =>
    json(publicForm({ payerFee: 0, nonPayerFee: 0, collectsStudentId: false, questions })),
  )
  api.on('POST', APPLY_PATH, () => json({ token: 'tok' }, 201))
  render(<ApplyPage code={FORM_CODE} onApplied={vi.fn()} />)
  return api
}

test('질문마다 칸이 있고 필수는 별표, 선택은 (선택)이며 고지의 받는 항목에 질문 제목이 실린다', async () => {
  setup()
  expect(await screen.findByLabelText('이니셜')).toBeTruthy()
  expect(screen.getByRole('radiogroup', { name: '티셔츠 사이즈' })).toBeTruthy()
  expect(screen.getByRole('group', { name: '참가 종목' })).toBeTruthy()
  expect(screen.getByText('(선택)')).toBeTruthy()
  expect(screen.getByText(/받는 항목: 이름, 이니셜, 티셔츠 사이즈, 참가 종목 ·/)).toBeTruthy()
})

test('필수 질문을 비우면 칸 아래 오류이고 보내지 않는다. 채우면 질문마다 답을 보낸다', async () => {
  const api = setup()
  fireEvent.change(await screen.findByLabelText('이름'), { target: { value: '김신청' } })
  fireEvent.click(screen.getByRole('button', { name: '신청하기' }))
  expect(await screen.findByText('답을 입력해 주세요')).toBeTruthy()
  expect(screen.getByText('하나를 골라 주세요')).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(0)
  fireEvent.change(screen.getByLabelText('이니셜'), { target: { value: ' KHS ' } })
  fireEvent.click(screen.getByRole('radio', { name: 'M' }))
  fireEvent.click(screen.getByRole('checkbox', { name: '농구' }))
  fireEvent.click(screen.getByRole('checkbox', { name: '축구' }))
  fireEvent.click(screen.getByRole('button', { name: '신청하기' }))
  await waitFor(() => expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1))
  const body = api.calls.find(call => call.method === 'POST')!.body as { answers: unknown }
  expect(body.answers).toEqual([
    { questionId: Q(1), text: 'KHS' },
    { questionId: Q(2), choiceId: Q(4) },
    // 고른 차례(농구, 축구)가 아니라 선택지 차례다.
    { questionId: Q(5), choiceIds: [Q(6), Q(7)] },
  ])
})

test('필수 여럿 고르기가 비면 그 묶음으로 초점이 간다', async () => {
  const api = mockApi()
  api.on('GET', FORM_PATH, () =>
    json(
      publicForm({
        payerFee: 0,
        nonPayerFee: 0,
        collectsStudentId: false,
        questions: [{ ...questions[2]!, required: true }],
      }),
    ),
  )
  render(<ApplyPage code={FORM_CODE} onApplied={vi.fn()} />)
  fireEvent.change(await screen.findByLabelText('이름'), { target: { value: '김신청' } })
  fireEvent.click(screen.getByRole('button', { name: '신청하기' }))
  expect(await screen.findByText('하나 이상 골라 주세요')).toBeTruthy()
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('group', { name: '참가 종목' })),
  )
})

// 고르는 표시(하나 고르기 동그라미, 여럿 고르기 네모)는 늘 왼쪽에 있고, 고른 줄은 표시가 찬다.
test('선택지마다 고르는 표시가 있고 고른 줄만 고른 모양이다', async () => {
  setup()
  const sizes = await screen.findByRole('radiogroup', { name: '티셔츠 사이즈' })
  expect(sizes.querySelectorAll('[data-mark="radio"]')).toHaveLength(2)
  const sports = screen.getByRole('group', { name: '참가 종목' })
  expect(sports.querySelectorAll('[data-mark="checkbox"]')).toHaveLength(2)
  const row = (name: string) =>
    screen.getByRole<HTMLInputElement>('radio', { name }).closest('label')!
  expect(row('M').hasAttribute('data-checked')).toBe(false)
  fireEvent.click(screen.getByRole('radio', { name: 'M' }))
  expect(screen.getByRole<HTMLInputElement>('radio', { name: 'M' }).checked).toBe(true)
  expect(row('M').hasAttribute('data-checked')).toBe(true)
  expect(row('S').hasAttribute('data-checked')).toBe(false)
  fireEvent.click(screen.getByRole('checkbox', { name: '농구' }))
  const basketball = screen.getByRole('checkbox', { name: '농구' }).closest('label')!
  expect(basketball.hasAttribute('data-checked')).toBe(true)
})

// 운영진이 고쳐도 안 바뀐 질문은 번호가 남는다(결정 11). 고른 선택지만 빠지면 번호가 남은 값이 없는 선택지를 가리킨다.
const withoutS = questions.map(question =>
  question.id === Q(2)
    ? {
        ...question,
        choices: [
          { id: Q(4), label: 'M' },
          { id: Q(8), label: 'L' },
        ],
      }
    : question,
)
const pickSizeS = async () => {
  fireEvent.change(await screen.findByLabelText('이니셜'), { target: { value: 'KHS' } })
  fireEvent.change(screen.getByLabelText('이름'), { target: { value: '김새내' } })
  fireEvent.click(screen.getByRole('radio', { name: 'S' }))
}
const applyBodies = (api: ReturnType<typeof setup>) =>
  api.calls.filter(call => call.path === APPLY_PATH).map(call => call.body)

test('양식이 바뀌어 다시 읽어도 안 바뀐 질문의 답은 칸에 남는다', async () => {
  const api = setup()
  await pickSizeS()
  fireEvent.click(screen.getByRole('checkbox', { name: '축구' }))
  const added = { id: Q(9), kind: 'short_text', title: '새 질문', required: false, choices: [] }
  api.on('GET', FORM_PATH, () =>
    json(
      publicForm({
        payerFee: 0,
        nonPayerFee: 0,
        collectsStudentId: false,
        questions: [added as FormQuestion, ...questions],
      }),
    ),
  )
  api.on('POST', APPLY_PATH, () => json({ error: 'FORM_CHANGED' }, 409))
  fireEvent.click(screen.getByRole('button', { name: '신청하기' }))
  await screen.findByLabelText(/새 질문/)
  expect(screen.getByLabelText<HTMLInputElement>('이니셜').value).toBe('KHS')
  expect(screen.getByRole<HTMLInputElement>('radio', { name: 'S' }).checked).toBe(true)
  expect(screen.getByRole<HTMLInputElement>('checkbox', { name: '축구' }).checked).toBe(true)
})

test('고른 선택지가 양식에서 빠지면 고르지 않은 것으로 보고, 다시 고르게 한다', async () => {
  const api = setup()
  await pickSizeS()
  api.on('GET', FORM_PATH, () =>
    json(
      publicForm({ payerFee: 0, nonPayerFee: 0, collectsStudentId: false, questions: withoutS }),
    ),
  )
  api.on('POST', APPLY_PATH, () => json({ error: 'FORM_CHANGED' }, 409))
  fireEvent.click(screen.getByRole('button', { name: '신청하기' }))
  await screen.findByRole('radio', { name: 'L' })
  const before = applyBodies(api).length
  fireEvent.click(screen.getByRole('button', { name: '신청하기' }))
  expect(await screen.findByText('하나를 골라 주세요')).toBeTruthy()
  expect(applyBodies(api).length).toBe(before)
  expect(screen.getByLabelText<HTMLInputElement>('이니셜').value).toBe('KHS')
  api.on('POST', APPLY_PATH, () => json({ token: 'tok' }, 201))
  fireEvent.click(screen.getByRole('radio', { name: 'M' }))
  fireEvent.click(screen.getByRole('button', { name: '신청하기' }))
  await waitFor(() => expect(applyBodies(api).length).toBe(before + 1))
  expect(JSON.stringify(applyBodies(api).at(-1))).toContain(`"choiceId":"${Q(4)}"`)
})

test('여럿 고르기도 빠진 선택지는 보내지 않고, 다 빠진 필수 질문은 다시 고르게 한다', async () => {
  const required = questions.map(question =>
    question.id === Q(5) ? { ...question, required: true } : question,
  )
  const dropped = required.map(question =>
    question.id === Q(5) ? { ...question, choices: [{ id: Q(7), label: '농구' }] } : question,
  )
  const api = mockApi()
  let current = required
  api.on('GET', FORM_PATH, () =>
    json(publicForm({ payerFee: 0, nonPayerFee: 0, collectsStudentId: false, questions: current })),
  )
  render(<ApplyPage code={FORM_CODE} onApplied={vi.fn()} />)
  await pickSizeS()
  fireEvent.click(screen.getByRole('checkbox', { name: '축구' }))
  current = dropped
  api.on('POST', APPLY_PATH, () => json({ error: 'FORM_CHANGED' }, 409))
  fireEvent.click(screen.getByRole('button', { name: '신청하기' }))
  await waitFor(() => expect(screen.queryByRole('checkbox', { name: '축구' })).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: '신청하기' }))
  expect(await screen.findByText('하나 이상 골라 주세요')).toBeTruthy()
})

test('열린 화면에서 질문이 필수로 바뀌어 서버가 거절하면 양식을 다시 읽어 칸에서 알린다', async () => {
  const api = setup()
  fireEvent.change(await screen.findByLabelText('이니셜'), { target: { value: 'KHS' } })
  fireEvent.change(screen.getByLabelText('이름'), { target: { value: '김새내' } })
  fireEvent.click(screen.getByRole('radio', { name: 'S' }))
  const nowRequired = questions.map(question =>
    question.id === Q(5) ? { ...question, required: true } : question,
  )
  api.on('GET', FORM_PATH, () =>
    json(
      publicForm({ payerFee: 0, nonPayerFee: 0, collectsStudentId: false, questions: nowRequired }),
    ),
  )
  api.on('POST', APPLY_PATH, () => json({ error: 'INVALID_INPUT' }, 400))
  fireEvent.click(screen.getByRole('button', { name: '신청하기' }))
  await waitFor(() => expect(screen.queryByText('(선택)')).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: '신청하기' }))
  expect(await screen.findByText('하나 이상 골라 주세요')).toBeTruthy()
})
