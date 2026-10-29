// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { resetAddress } from '@/test-support/address-reset'
import { navigationWidth } from '@/test-support/navigation-width'
import { pickDate } from '@/test-support/date-field'
import { Field } from './field'
import { DateField, dateFieldText } from './date-field'
import { DateTimeField, TIME_OPTIONS, TimeField } from './date-time-field'

afterEach(async () => {
  cleanup()
  vi.unstubAllGlobals()
  await resetAddress()
})

const TODAY = '2026-10-30'

function Harness({
  initial = '',
  optional,
  error,
  min,
  max,
  onValue,
}: {
  initial?: string
  optional?: boolean
  error?: string
  min?: string
  max?: string
  onValue?: (value: string) => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <Field label="결제일" optional={optional ?? false} required={!optional} error={error}>
      <DateField
        today={TODAY}
        value={value}
        clearable={optional}
        min={min}
        max={max}
        onChange={next => {
          setValue(next)
          onValue?.(next)
        }}
      />
    </Field>
  )
}

test('칸에는 고른 날이 앱 날짜 꼴로 보이고, 올해가 아니면 연도를 붙인다', () => {
  expect(dateFieldText('2026-10-30', TODAY)).toBe('10월 30일 (금)')
  expect(dateFieldText('2027-01-02', TODAY)).toBe('2027년 1월 2일 (토)')
  expect(dateFieldText('', TODAY)).toBe('')
  render(<Harness initial="2026-10-30" />)
  const field = screen.getByLabelText('결제일')
  expect(field.textContent).toBe('10월 30일 (금)')
  expect(asButtonValue(field)).toBe('2026-10-30')
})

const asButtonValue = (element: HTMLElement) => element.getAttribute('value')

test('누르면 달력이 뜨고, 날을 고르면 YYYY-MM-DD로 바꾸고 닫히며 칸으로 초점이 돌아온다', async () => {
  const onValue = vi.fn()
  render(<Harness onValue={onValue} />)
  const field = screen.getByRole('combobox', { name: '결제일' })
  expect(field.getAttribute('aria-expanded')).toBe('false')
  await pickDate(field, '2026-11-03')
  expect(onValue).toHaveBeenLastCalledWith('2026-11-03')
  expect(screen.queryByRole('grid')).toBeNull()
  expect(field.textContent).toBe('11월 3일 (화)')
  await waitFor(() => expect(document.activeElement).toBe(field))
})

test('키보드만으로 열고 화살표로 옮겨 Enter로 고르며, Esc는 고르지 않고 닫는다', async () => {
  const onValue = vi.fn()
  render(<Harness initial="2026-10-30" onValue={onValue} />)
  const field = screen.getByLabelText('결제일')
  field.focus()
  fireEvent.keyDown(field, { key: 'ArrowDown' })
  const today = await screen.findByRole('button', { name: '10월 30일 (금)' })
  await waitFor(() => expect(document.activeElement).toBe(today))
  fireEvent.keyDown(today, { key: 'ArrowRight' })
  const next = screen.getByRole('button', { name: '10월 31일 (토)' })
  expect(document.activeElement).toBe(next)
  fireEvent.keyDown(next, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('grid')).toBeNull())
  expect(onValue).not.toHaveBeenCalled()
  // Enter·Space는 버튼 누르기(click)다.
  fireEvent.click(field)
  const again = await screen.findByRole('button', { name: '10월 30일 (금)' })
  fireEvent.keyDown(again, { key: 'ArrowLeft' })
  fireEvent.click(screen.getByRole('button', { name: '10월 29일 (목)' }))
  expect(onValue).toHaveBeenLastCalledWith('2026-10-29')
})

test('필수와 문제는 칸에 이어지고, 문제 칸은 첫 문제 칸 찾기에 걸린다', () => {
  const { container } = render(<Harness error="결제일을 골라 주세요" />)
  const field = screen.getByLabelText('결제일')
  expect(field.getAttribute('aria-required')).toBe('true')
  expect(field.getAttribute('aria-invalid')).toBe('true')
  expect(field.getAttribute('aria-describedby')).toContain('-error')
  expect(container.querySelector('[aria-invalid="true"]')).toBe(field)
})

test('선택 칸은 날짜 지우기로 비운다. 필수 칸에는 없다', async () => {
  const onValue = vi.fn()
  render(<Harness initial="2026-10-30" optional onValue={onValue} />)
  fireEvent.click(screen.getByLabelText('결제일'))
  fireEvent.click(await screen.findByRole('button', { name: '날짜 지우기' }))
  expect(onValue).toHaveBeenLastCalledWith('')
  expect(screen.getByLabelText('결제일').textContent).toBe('')
  cleanup()
  render(<Harness initial="2026-10-30" />)
  fireEvent.click(screen.getByLabelText('결제일'))
  await screen.findByRole('grid')
  expect(screen.queryByRole('button', { name: '날짜 지우기' })).toBeNull()
})

test('고를 수 있는 기간 밖의 날은 막히고 눌러도 바뀌지 않는다', async () => {
  const onValue = vi.fn()
  render(<Harness max={TODAY} onValue={onValue} />)
  fireEvent.click(screen.getByLabelText('결제일'))
  const after = await screen.findByRole('button', { name: '10월 31일 (토)' })
  expect(after.getAttribute('aria-disabled')).toBe('true')
  fireEvent.click(after)
  expect(onValue).not.toHaveBeenCalled()
  expect(screen.getByRole('grid')).toBeTruthy()
})

test('비어 있으면 오늘이 든 달을, 오늘이 기간 밖이면 가장 가까운 끝 달을 연다', async () => {
  render(<Harness min="2027-03-01" max="2027-06-30" />)
  fireEvent.click(screen.getByLabelText('결제일'))
  expect((await screen.findByRole('grid')).getAttribute('aria-label')).toBe('2027년 3월')
})

test('휴대폰 폭에서는 아래에서 올라오는 시트로 열고 날 칸은 44px로 키운다', async () => {
  navigationWidth(390)
  render(<Harness />)
  fireEvent.click(screen.getByLabelText('결제일'))
  const sheet = await screen.findByRole('dialog', { name: '날짜 선택' })
  const day = within(sheet).getByRole('button', { name: '10월 30일 (금)' })
  expect(day.className).toContain('size-11')
  fireEvent.click(day)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByLabelText('결제일').textContent).toBe('10월 30일 (금)')
})

test('데스크탑 폭의 달력 날 칸은 지금 크기(size-9) 그대로다', async () => {
  navigationWidth(1280)
  render(<Harness />)
  fireEvent.click(screen.getByLabelText('결제일'))
  const day = await screen.findByRole('button', { name: '10월 30일 (금)' })
  expect(day.className).toContain('size-9')
  expect(day.className).not.toContain('size-11')
})

test('읽기 전용이면 달력을 열지 않는 읽기 칸으로 보인다', () => {
  render(
    <Field label="임기 시작">
      <DateField today={TODAY} value="2027-03-01" readOnly onChange={() => {}} />
    </Field>,
  )
  const field = screen.getByLabelText('임기 시작')
  expect(field.getAttribute('readonly')).not.toBeNull()
  expect((field as HTMLInputElement).value).toBe('2027년 3월 1일 (월)')
})

function DateTimeHarness({
  initial = '',
  onValue,
}: {
  initial?: string
  onValue: (value: string) => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <Field label="시작 일시" optional>
      <DateTimeField
        today={TODAY}
        timeLabel="시작 시각"
        name="startsAt"
        value={value}
        clearable
        onChange={next => {
          setValue(next)
          onValue(next)
        }}
      />
    </Field>
  )
}

test('시각은 30분 단위 목록이다', () => {
  expect(TIME_OPTIONS[0]).toBe('00:00')
  expect(TIME_OPTIONS[1]).toBe('00:30')
  expect(TIME_OPTIONS.at(-1)).toBe('23:30')
  expect(TIME_OPTIONS).toHaveLength(48)
})

test('날짜와 시각을 고르면 datetime-local과 같은 YYYY-MM-DDTHH:mm로 내보낸다', async () => {
  const onValue = vi.fn()
  render(<DateTimeHarness initial="2026-10-24T14:00" onValue={onValue} />)
  const date = screen.getByLabelText('시작 일시')
  expect(date.getAttribute('name')).toBe('startsAt')
  expect(date.textContent).toBe('10월 24일 (토)')
  const time = screen.getByRole('combobox', { name: '시작 시각' })
  expect(time).toHaveProperty('value', '14:00')
  fireEvent.change(time, { target: { value: '18:30' } })
  expect(onValue).toHaveBeenLastCalledWith('2026-10-24T18:30')
  await pickDate(date, '2026-11-02')
  expect(onValue).toHaveBeenLastCalledWith('2026-11-02T18:30')
})

test('목록에 없는 지금 시각(14:10)도 그대로 보이고 바뀌지 않는다', () => {
  render(<DateTimeHarness initial="2026-10-24T14:10" onValue={vi.fn()} />)
  expect(screen.getByRole('combobox', { name: '시작 시각' })).toHaveProperty('value', '14:10')
})

test('빈 칸에서 날짜만 고르면 09:00, 시각을 먼저 고르면 그 시각으로 채운다. 날짜를 지우면 빈 값이다', async () => {
  const onValue = vi.fn()
  render(<DateTimeHarness onValue={onValue} />)
  const time = screen.getByRole('combobox', { name: '시작 시각' })
  fireEvent.change(time, { target: { value: '19:00' } })
  expect(onValue).not.toHaveBeenCalled()
  await pickDate(screen.getByLabelText('시작 일시'), '2026-11-02')
  expect(onValue).toHaveBeenLastCalledWith('2026-11-02T19:00')
  fireEvent.click(screen.getByLabelText('시작 일시'))
  fireEvent.click(await screen.findByRole('button', { name: '날짜 지우기' }))
  expect(onValue).toHaveBeenLastCalledWith('')
  expect(time).toHaveProperty('value', '19:00')
  cleanup()
  const second = vi.fn()
  render(<DateTimeHarness onValue={second} />)
  await pickDate(screen.getByLabelText('시작 일시'), '2026-11-02')
  expect(second).toHaveBeenLastCalledWith('2026-11-02T09:00')
})

test('시각만 고르는 칸은 같은 목록이고 HH:mm를 내보낸다', () => {
  const onChange = vi.fn()
  render(
    <Field label="시작" required error="시작 시각을 골라 주세요">
      <TimeField value="" onChange={onChange} />
    </Field>,
  )
  const time = screen.getByLabelText('시작')
  expect(time.getAttribute('aria-invalid')).toBe('true')
  expect(time.getAttribute('aria-required')).toBe('true')
  expect(within(time).getAllByRole('option')).toHaveLength(TIME_OPTIONS.length + 1)
  fireEvent.change(time, { target: { value: '15:30' } })
  expect(onChange).toHaveBeenLastCalledWith('15:30')
})
