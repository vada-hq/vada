// @vitest-environment jsdom
import type { VariantProps } from 'class-variance-authority'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ExpensePaymentItems } from '@/finance/ExpenseRequestFields'
import { emptyExpense } from '@/finance/expense-form'
import { FeeValue } from '@/registrations/FormFee'
import { emptyFormValues } from '@/registrations/registration-form'
import { purchaseDetail } from '@/test-support/purchase-fixtures'
import { Button, buttonVariants } from './button'
import { Input } from './input'
import { NativeSelect } from './native-select'
import { Textarea } from './textarea'

afterEach(cleanup)

const desktopFieldClass =
  'w-full min-w-0 rounded-sm border border-input bg-white px-3 py-2 text-base font-normal sm:text-sm text-fg-body outline-none placeholder:text-fg-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-subtle disabled:text-fg-subtle aria-invalid:border-destructive'

const desktopClasses = (className: string) =>
  className
    .split(' ')
    .filter(token => !token.startsWith('max-sm:'))
    .join(' ')

test('입력칸·날짜·선택칸은 휴대폰에서 최소 44px이고 데스크톱 클래스는 그대로다', () => {
  render(
    <>
      <Input aria-label="이름" />
      <Input aria-label="날짜" type="date" />
      <NativeSelect aria-label="계좌">
        <option>학생회</option>
      </NativeSelect>
    </>,
  )
  for (const label of ['이름', '날짜', '계좌']) {
    const field = screen.getByLabelText(label)
    expect(field.classList.contains('max-sm:min-h-11')).toBe(true)
    const extra =
      label === '계좌' ? 'cursor-pointer' : 'read-only:border-border read-only:bg-surface-subtle'
    expect(desktopClasses(field.className)).toBe(`${desktopFieldClass} ${extra}`)
  }
})

test('여러 줄 입력은 휴대폰에서도 최소 80px이고 데스크톱 클래스는 그대로다', () => {
  render(<Textarea aria-label="안내" />)
  const field = screen.getByLabelText('안내')
  expect(field.classList.contains('min-h-20')).toBe(true)
  expect(field.classList.contains('max-sm:min-h-20')).toBe(false)
  expect(field.classList.contains('max-sm:min-h-11')).toBe(false)
  expect(desktopClasses(field.className)).toBe(
    `${desktopFieldClass} min-h-20 resize-y read-only:border-border read-only:bg-surface-subtle`,
  )
})

test('채팅처럼 별도 최소 높이를 지정한 여러 줄 입력은 휴대폰에서도 그 높이를 유지한다', () => {
  render(<Textarea aria-label="메시지" className="min-h-11" />)
  const field = screen.getByLabelText('메시지')
  expect(field.classList.contains('min-h-11')).toBe(true)
  expect(field.classList.contains('min-h-20')).toBe(false)
  expect(field.className.split(' ').some(token => token.startsWith('max-sm:min-h-'))).toBe(false)
})

test.each(['md', 'sm', 'icon'] as const)(
  '%s 버튼은 기본으로 휴대폰 높이가 최소 44px이고 데스크톱 클래스는 그대로다',
  size => {
    render(<Button size={size}>확인</Button>)
    const button = screen.getByRole('button', { name: '확인' })
    expect(button.classList.contains('max-sm:min-h-11')).toBe(true)
    expect(button.classList.contains('max-sm:min-w-11')).toBe(size === 'icon')
    expect(desktopClasses(button.className)).toBe(buttonVariants({ size, touch: false }))
  },
)

test.each([
  { variant: 'link', touch: undefined, expected: false },
  { variant: 'link', touch: true, expected: true },
  { variant: 'link', touch: false, expected: false },
  { variant: 'outline', touch: true, expected: true },
  { variant: 'outline', touch: false, expected: false },
] satisfies (VariantProps<typeof buttonVariants> & { expected: boolean })[])(
  '$variant 버튼의 touch=$touch 지정은 기본값보다 우선한다',
  ({ variant, touch, expected }) => {
    render(<Button variant={variant} touch={touch} size="icon" aria-label="닫기" />)
    const button = screen.getByRole('button', { name: '닫기' })
    expect(button.classList.contains('max-sm:min-h-11')).toBe(expected)
    expect(button.classList.contains('max-sm:min-w-11')).toBe(expected)
  },
)

test.each(['default', 'outline', 'secondary', 'ghost', 'destructive', 'link'] as const)(
  '%s 단추 클래스를 직접 구해도 같은 touch 기본값과 데스크톱 모양을 쓴다',
  variant => {
    for (const size of ['md', 'sm', 'icon'] as const) {
      const classes = buttonVariants({ variant, size }).split(' ')
      expect(classes.includes('max-sm:min-h-11')).toBe(variant !== 'link')
      expect(classes.includes('max-sm:min-w-11')).toBe(variant !== 'link' && size === 'icon')
      expect(desktopClasses(classes.join(' '))).toBe(
        buttonVariants({ variant, size, touch: false }),
      )
    }
  },
)

test('인자 없는 단추 클래스도 휴대폰 높이를 키우고 명시한 클래스는 보존한다', () => {
  expect(buttonVariants().split(' ')).toContain('max-sm:min-h-11')
  expect(buttonVariants({ className: 'w-full' }).split(' ')).toContain('w-full')
})

test('신청 양식 참가비 체크칸·라디오는 16px 모양을 유지하고 터치 기기에서 44px 라벨 줄 전체로 고른다', () => {
  const onChange = vi.fn()
  const ids = {
    name: 'n',
    closesAt: 'c',
    opensAt: 'o',
    capacity: 'p',
    fee: 'f',
    payerFee: 'pf',
    nonPayerFee: 'nf',
    account: 'a',
    notice: 't',
  }
  render(
    <FeeValue
      ids={ids}
      values={{ ...emptyFormValues, feeKind: 'one' }}
      errors={{}}
      onChange={onChange}
    />,
  )
  for (const choice of [...screen.getAllByRole('checkbox'), ...screen.getAllByRole('radio')]) {
    expect(choice.className).toBe('size-4 accent-primary-emphasis')
    expect(choice.closest('label')?.classList.contains('pointer-coarse:min-h-11')).toBe(true)
  }
  fireEvent.click(screen.getByText('학생회비 납부자 금액 다름'))
  expect(onChange).toHaveBeenLastCalledWith({ feeKind: 'split' })
  fireEvent.click(screen.getByText('없음'))
  expect(onChange).toHaveBeenLastCalledWith({ feeKind: 'none' })
})

test('지출 품목 체크칸은 16px 모양을 유지하고 휴대폰 라벨 높이만 최소 44px로 키운다', () => {
  const onChange = vi.fn()
  const item = purchaseDetail().items[0]!
  render(
    <ExpensePaymentItems
      items={[item]}
      values={emptyExpense('2026-10-29')}
      disabled={false}
      errors={{}}
      onChange={onChange}
    />,
  )
  const checkbox = screen.getByRole('checkbox')
  const label = checkbox.closest('label')
  expect(checkbox.className).toBe('size-4 accent-primary-emphasis')
  expect(label?.classList.contains('max-sm:min-h-11')).toBe(true)
  expect(desktopClasses(label?.className ?? '')).toBe(
    'font-medium text-fg-secondary flex items-center gap-2 text-sm',
  )
  fireEvent.click(label!)
  expect(onChange).toHaveBeenCalledOnce()
})
