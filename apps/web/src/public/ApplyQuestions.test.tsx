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
  fireEvent.click(screen.getByRole('button', { name: '신청하기' }))
  await waitFor(() => expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1))
  const body = api.calls.find(call => call.method === 'POST')!.body as { answers: unknown }
  expect(body.answers).toEqual([
    { questionId: Q(1), text: 'KHS' },
    { questionId: Q(2), choiceId: Q(4) },
    { questionId: Q(5), choiceIds: [Q(7)] },
  ])
})
