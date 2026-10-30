// @vitest-environment jsdom
import { resetAddress } from '@/test-support/address-reset'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { WON_MAX, type BudgetResponse } from '@vada/contracts'
import {
  FINANCE_PERMISSIONS,
  MEMBER_PERMISSIONS,
  teamResponse,
} from '@/test-support/council-fixtures'
import { BUDGET_A, budgetWithPeriod, budgetWithoutPeriod } from '@/test-support/budget-fixtures'
import { asElement } from '@/test-support/elements'
import { eventSummary } from '@/test-support/event-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { BUDGET_ERRORS } from '@/lib/budget-messages'
import { COUNCIL_ID } from '@/test-support/finance-at'
import { BudgetTab } from './BudgetTab'

// 예산 편성(024 조각 6): 학기 기본값, 여러 행 넣기, 항목 고치기·지우기·이력.

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const ORG = `/api/organizations/${COUNCIL_ID}`
const BUDGET = `${ORG}/budget`
const SPRING = '00000000-0000-4000-8000-0000000000e1'
const PLANNING = '00000000-0000-4000-8000-0000000000d2'

function show(permissions = FINANCE_PERMISSIONS, budget: BudgetResponse = budgetWithPeriod()) {
  const api = mockApi()
  api.on('GET', `${ORG}/purchase-requests?view=mine`, () =>
    json({ requests: [], truncated: false }),
  )
  api.on('GET', BUDGET, () => json(budget))
  api.on('GET', `${ORG}/events`, () =>
    json({ events: [eventSummary({ id: SPRING, name: '봄 축제' })] }),
  )
  api.on('GET', `${ORG}/members`, () =>
    json({
      ...teamResponse(),
      departments: [{ id: PLANNING, name: '기획부', role: null, memberCount: 0 }],
    }),
  )
  const handlers = { onForbidden: vi.fn(), onChanged: vi.fn() }
  const rendered = render(
    <BudgetTab
      councilId={COUNCIL_ID}
      canManage={permissions.includes('finance.manage')}
      onForbidden={handlers.onForbidden}
    />,
  )
  return { api, handlers, rendered }
}
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const posts = (api: ReturnType<typeof mockApi>) => api.calls.filter(call => call.method === 'POST')
const input = (label: string) => asElement(screen.getByLabelText(label), HTMLInputElement)

async function openPlan() {
  fireEvent.click(await screen.findByRole('button', { name: '예산 편성' }))
  return screen.findByRole('form', { name: '예산 편성' })
}

test('회계 기간 만들기는 오늘이 든 학기로 채워진다(4월이면 2026년 1학기, 1월 1일~6월 30일)', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-04-15T03:00:00Z'))
  show(FINANCE_PERMISSIONS, budgetWithoutPeriod())
  fireEvent.click(await screen.findByRole('button', { name: '회계 기간 만들기' }))
  await screen.findByRole('form', { name: '회계 기간 만들기' })
  const value = (label: string) => screen.getByLabelText(label).getAttribute('value')
  expect([input('이름').value, value('시작일'), value('끝일')]).toEqual([
    '2026년 1학기',
    '2026-01-01',
    '2026-06-30',
  ])
})

test('예산 편성 창은 행 하나로 열리고, 행사를 고르면 행사 운영비·홍보비·식비 행이 채워진다', async () => {
  show()
  const form = await openPlan()
  expect(input('항목 1 이름').value).toBe('')
  expect(screen.queryByLabelText('항목 2 이름')).toBeNull()
  fireEvent.change(await within(form).findByRole('combobox', { name: /행사/ }), {
    target: { value: SPRING },
  })
  expect([1, 2, 3].map(n => input(`항목 ${n} 이름`).value)).toEqual([
    '행사 운영비',
    '홍보비',
    '식비',
  ])
  expect(input('항목 1 금액').value).toBe('')
})

test('여러 행을 한 번에 보낸다: 빈 행은 버리고, 합계가 보이며, 저장하면 창이 닫힌다', async () => {
  const { api } = show()
  api.on('POST', `${ORG}/budget-items/batch`, () => json(budgetWithPeriod(), 201))
  const form = await openPlan()
  fill('항목 1 이름', '학생회 운영비')
  fill('항목 1 금액', '1,000,000')
  fireEvent.click(within(form).getByRole('button', { name: '항목 추가' }))
  fireEvent.click(within(form).getByRole('button', { name: '항목 추가' }))
  fill('항목 2 이름', '간식')
  fill('항목 2 금액', '50000')
  expect(within(form).getByText(/총 배정 예산/).textContent).toBe('총 배정 예산 1,050,000원')
  fireEvent.click(screen.getByRole('button', { name: '예산 저장' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(posts(api).map(call => call.body)).toEqual([
    {
      items: [
        {
          purpose: '학생회 운영비',
          amount: 1000000,
          type: 'expense',
          eventId: null,
          departmentId: null,
        },
        { purpose: '간식', amount: 50000, type: 'expense', eventId: null, departmentId: null },
      ],
    },
  ])
})

test('담당 부서(선택)는 비어 있고, 고르면 창의 모든 행에 실어 보낸다', async () => {
  const { api } = show()
  api.on('POST', `${ORG}/budget-items/batch`, () => json(budgetWithPeriod(), 201))
  const form = await openPlan()
  const department = asElement(
    await within(form).findByRole('combobox', { name: /^담당 부서/ }),
    HTMLSelectElement,
  )
  await waitFor(() => expect(department.disabled).toBe(false))
  expect(department.value).toBe('')
  expect([...department.options].map(option => option.text)).toEqual(['부서 없음', '기획부'])
  fireEvent.change(department, { target: { value: PLANNING } })
  fill('항목 1 이름', '가을 축제 상금')
  fill('항목 1 금액', '600000')
  fireEvent.click(within(form).getByRole('button', { name: '항목 추가' }))
  fill('항목 2 이름', '홍보비')
  fill('항목 2 금액', '50000')
  fireEvent.click(screen.getByRole('button', { name: '예산 저장' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(posts(api).map(call => call.body)).toEqual([
    {
      items: [
        {
          purpose: '가을 축제 상금',
          amount: 600000,
          type: 'expense',
          eventId: null,
          departmentId: PLANNING,
        },
        {
          purpose: '홍보비',
          amount: 50000,
          type: 'expense',
          eventId: null,
          departmentId: PLANNING,
        },
      ],
    },
  ])
})

test('항목 고치기: 지금 담당 부서가 골라져 있고, 부서 없음으로 바꾸면 비워 보낸다', async () => {
  const budget = budgetWithPeriod()
  budget.items[0] = { ...budget.items[0]!, department: { id: PLANNING, name: '기획부' } }
  const { api } = show(FINANCE_PERMISSIONS, budget)
  api.on('POST', `${ORG}/budget-items/${BUDGET_A}`, () => json(budgetWithPeriod()))
  fireEvent.keyDown(await screen.findByRole('button', { name: '행사 홍보 더 보기' }), {
    key: 'Enter',
  })
  fireEvent.click(await screen.findByRole('menuitem', { name: '고치기' }))
  const form = await screen.findByRole('form', { name: '예산 항목 고치기' })
  const department = asElement(
    within(form).getByRole('combobox', { name: /^담당 부서/ }),
    HTMLSelectElement,
  )
  expect(department.value).toBe(PLANNING)
  await waitFor(() => expect(department.disabled).toBe(false))
  fireEvent.change(department, { target: { value: '' } })
  fill('사유', '재정부가 직접 씀')
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(posts(api).map(call => call.body)).toEqual([
    { purpose: '행사 홍보', amount: 300000, departmentId: null, reason: '재정부가 직접 씀' },
  ])
})

test('0원, 한쪽만 채운 행, 같은 이름은 보내지 않고 그 행 아래에 알린다', async () => {
  const { api } = show()
  const form = await openPlan()
  fill('항목 1 이름', '간식')
  fill('항목 1 금액', '0')
  fireEvent.click(within(form).getByRole('button', { name: '항목 추가' }))
  fill('항목 2 금액', '1000')
  fireEvent.click(within(form).getByRole('button', { name: '항목 추가' }))
  fill('항목 3 이름', '행사 홍보')
  fill('항목 3 금액', '1000')
  fireEvent.click(screen.getByRole('button', { name: '예산 저장' }))
  expect(screen.getByText('0원보다 큰 금액을 입력해 주세요')).toBeTruthy()
  expect(screen.getByText('항목 이름을 입력해 주세요')).toBeTruthy()
  expect(screen.getByText('같은 이름의 항목이 있어요')).toBeTruthy()
  expect(input('항목 1 금액').getAttribute('aria-invalid')).toBe('true')
  expect(input('항목 3 이름').getAttribute('aria-invalid')).toBe('true')
  expect(posts(api)).toHaveLength(0)
})

test('한 행이라도 서버가 400이면 아무것도 저장하지 않았다고 알리고 모든 행이 그대로 남는다', async () => {
  const { api } = show()
  api.on('POST', `${ORG}/budget-items/batch`, () => json({ error: 'BUDGET_ITEM_DUPLICATE' }, 400))
  const form = await openPlan()
  fill('항목 1 이름', '비품')
  fill('항목 1 금액', '1000')
  fireEvent.click(within(form).getByRole('button', { name: '항목 추가' }))
  fill('항목 2 이름', '간식')
  fill('항목 2 금액', '2000')
  fireEvent.click(screen.getByRole('button', { name: '예산 저장' }))
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain(BUDGET_ERRORS.BUDGET_ITEM_DUPLICATE!)
  expect(alert.textContent).toContain('아무것도 저장하지 않았어요')
  expect([input('항목 1 이름').value, input('항목 2 이름').value]).toEqual(['비품', '간식'])
})

test('재정부가 아니면 [예산 편성]과 고치기·지우기가 없고 이력만 본다', async () => {
  show(MEMBER_PERMISSIONS)
  await screen.findByText('2026년 2학기')
  expect(screen.queryByRole('button', { name: '예산 편성' })).toBeNull()
  fireEvent.keyDown(screen.getByRole('button', { name: '행사 홍보 더 보기' }), { key: 'Enter' })
  const menu = await screen.findByRole('menu')
  expect(
    within(menu)
      .getAllByRole('menuitem')
      .map(item => item.textContent),
  ).toEqual(['이력 보기'])
})

test('항목 고치기: 이름·금액·사유(필수)를 보내고, 판 이력에 이전·이후와 사유가 보인다', async () => {
  const budget = budgetWithPeriod()
  const changed = budgetWithPeriod()
  changed.items[0] = {
    ...changed.items[0]!,
    type: 'expense',
    actual: 120000,
    committed: 30000,
    amount: 250000,
    available: 100000,
    history: [
      ...changed.items[0]!.history,
      {
        versionNo: 2,
        at: '2026-10-25T05:00:00.000Z',
        by: { id: 'm2', name: '김재정' },
        purpose: '행사 홍보',
        amount: 250000,
        reason: '회의에서 줄임',
      },
    ],
  }
  const { api } = show(FINANCE_PERMISSIONS, budget)
  api.on('POST', `${ORG}/budget-items/${BUDGET_A}`, () => json(changed))
  fireEvent.keyDown(await screen.findByRole('button', { name: '행사 홍보 더 보기' }), {
    key: 'Enter',
  })
  fireEvent.click(await screen.findByRole('menuitem', { name: '고치기' }))
  await screen.findByRole('form', { name: '예산 항목 고치기' })
  expect([input('항목 이름').value, input('금액(원)').value]).toEqual(['행사 홍보', '300,000'])
  fill('금액(원)', '250000')
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(screen.getByText('사유를 입력해 주세요')).toBeTruthy()
  expect(posts(api)).toHaveLength(0)
  fill('사유', '회의에서 줄임')
  api.on('GET', BUDGET, () => json(changed))
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(posts(api).map(call => call.body)).toEqual([
    { purpose: '행사 홍보', amount: 250000, departmentId: null, reason: '회의에서 줄임' },
  ])
  fireEvent.keyDown(screen.getByRole('button', { name: '행사 홍보 더 보기' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '이력 보기' }))
  const history = await screen.findByRole('dialog', { name: '이력' })
  expect(within(history).getByText(/금액 300,000원 → 250,000원 · 사유: 회의에서 줄임/)).toBeTruthy()
})

test('줄여서 사용 가능이 음수가 되면 확인 창을 한 번 거친 뒤에 보낸다', async () => {
  const { api } = show()
  api.on('POST', `${ORG}/budget-items/${BUDGET_A}`, () => json(budgetWithPeriod()))
  fireEvent.keyDown(await screen.findByRole('button', { name: '행사 홍보 더 보기' }), {
    key: 'Enter',
  })
  fireEvent.click(await screen.findByRole('menuitem', { name: '고치기' }))
  await screen.findByRole('form', { name: '예산 항목 고치기' })
  // 배정 300,000 · 실제 120,000 · 예정 30,000 → 100,000으로 줄이면 사용 가능 -50,000원
  fill('금액(원)', '100000')
  fill('사유', '줄임')
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  const confirm = await screen.findByRole('dialog', { name: '사용 가능 금액 초과' })
  expect(within(confirm).getByText('행사 홍보')).toBeTruthy()
  expect(within(confirm).getByText(/저장하면 사용 가능/).textContent).toBe(
    '저장하면 사용 가능 -50,000원',
  )
  expect(posts(api)).toHaveLength(0)
  fireEvent.click(within(confirm).getByRole('button', { name: '그래도 저장' }))
  await waitFor(() => expect(posts(api)).toHaveLength(1))
})

test('쓰인 적 없는 항목만 [항목 지우기]가 있고 확인 창 뒤에 지운다. 쓰인 항목은 409 문구다', async () => {
  const budget = budgetWithPeriod()
  budget.items[1] = { ...budget.items[1]!, deletable: false }
  const { api } = show(FINANCE_PERMISSIONS, budget)
  fireEvent.keyDown(await screen.findByRole('button', { name: '소모품 더 보기' }), {
    key: 'Enter',
  })
  const used = await screen.findByRole('menu')
  expect(within(used).queryByRole('menuitem', { name: '항목 지우기' })).toBeNull()
  fireEvent.keyDown(used, { key: 'Escape' })
  api.on('POST', `${ORG}/budget-items/${BUDGET_A}/delete`, () =>
    json({ error: 'BUDGET_ITEM_IN_USE' }, 409),
  )
  fireEvent.keyDown(screen.getByRole('button', { name: '행사 홍보 더 보기' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '항목 지우기' }))
  const confirm = await screen.findByRole('dialog', { name: '예산 항목 지우기' })
  fireEvent.click(within(confirm).getByRole('button', { name: '항목 지우기' }))
  expect(await within(confirm).findByText(BUDGET_ERRORS.BUDGET_ITEM_IN_USE!)).toBeTruthy()
  expect(posts(api).map(call => call.body)).toEqual([{}])
})

test('예산 편성: 금액이 계약 상한을 넘으면 보내지 않고 그 칸 아래에 알리며 그 칸으로 옮긴다', async () => {
  const { api } = show()
  const form = await openPlan()
  fill('항목 1 이름', '학생회 운영비')
  fill('항목 1 금액', String(WON_MAX + 1))
  fireEvent.click(within(form).getByRole('button', { name: '예산 저장' }))
  expect(within(form).getByText('더 작은 값을 입력해 주세요')).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(input('항목 1 금액')))
  expect(posts(api)).toEqual([])
})
