import { Minus, Plus } from 'lucide-react'
import { BUDGET_ROWS_MAX } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { FieldErrors } from '@/lib/use-form-check'
import { cn } from '@/lib/utils'
import { blankRow, rowsTotal, type BudgetRow } from './budget-rows'
import { wonLabel } from './purchase-view'

type Props = {
  rows: BudgetRow[]
  errors: FieldErrors
  saving: boolean
  onChange: (rows: BudgetRow[]) => void
}

// 세 열의 폭. 금액 열은 휴대폰 글자(16px)로도 WON_MAX('1,000,000,000')가 보이게 넓게 두고 이름 열이 남는 폭을 쓴다.
// 끝 열은 '원'(넓은 창에서만)과 빼기 버튼이다. 빼기 버튼은 휴대폰에서 누르는 크기 44px다(Button touch).
const AMOUNT_COLUMN = 'w-36 shrink-0'
const END_COLUMN = 'w-11 shrink-0 @md:w-15'

// 열 머리: 와이어프레임은 입력칸 안 예시 글로 칸을 알리지만 예시 글을 쓰지 않으므로(AGENTS '화면 문구와 폼') 머리 한 줄로 둔다.
// 칸마다의 이름은 '항목 n 이름'·'항목 n 금액'으로 따로 붙는다(화면 읽기 프로그램과 시험이 이것으로 찾는다).
function Head() {
  return (
    <div aria-hidden className="flex gap-2 text-xs font-medium text-gray-700">
      <span className="min-w-0 flex-1">
        항목 이름 <span className="text-red-600">*</span>
      </span>
      <span className={AMOUNT_COLUMN}>
        금액(원) <span className="text-red-600">*</span>
      </span>
      <span className={END_COLUMN} />
    </div>
  )
}

type RowProps = {
  row: BudgetRow
  number: number
  errors: FieldErrors
  saving: boolean
  removable: boolean
  onChange: (patch: Partial<BudgetRow>) => void
  onRemove: () => void
}

// 한 행: 이름(넓게) · 금액(오른쪽 정렬) · 원 · 빼기. 문제는 그 칸 바로 아래, 같은 열에 둔다(GOV.UK error message).
function Row({ row, number, errors, saving, removable, onChange, onRemove }: RowProps) {
  const purposeError = errors[`rows.${number - 1}.purpose`]
  const amountError = errors[`rows.${number - 1}.amount`]
  const purposeId = `budget-row-${row.key}-purpose-error`
  const amountId = `budget-row-${row.key}-amount-error`
  const described = (error: string | undefined, id: string) =>
    error ? { 'aria-invalid': true as const, 'aria-describedby': id } : {}
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          aria-label={`항목 ${number} 이름`}
          aria-required
          className="min-w-0 flex-1"
          value={row.purpose}
          disabled={saving}
          onChange={event => onChange({ purpose: event.target.value })}
          {...described(purposeError, purposeId)}
        />
        <Input
          aria-label={`항목 ${number} 금액`}
          aria-required
          inputMode="numeric"
          className={cn(AMOUNT_COLUMN, 'text-right tabular-nums')}
          value={row.amount}
          disabled={saving}
          onChange={event => onChange({ amount: event.target.value })}
          {...described(amountError, amountId)}
        />
        <div className={cn(END_COLUMN, 'flex items-center gap-2')}>
          <span aria-hidden className="hidden text-sm text-gray-500 @md:inline">
            원
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            touch
            aria-label={`항목 ${number} 빼기`}
            busy={saving}
            // 행이 하나면 뺄 것이 없다. 버튼을 끄지 않고(린트) 자리만 남겨 행의 폭을 맞춘다.
            className={cn(!removable && 'invisible')}
            onClick={onRemove}
          >
            <Minus />
          </Button>
        </div>
      </div>
      {(purposeError || amountError) && (
        <div className="flex gap-2 text-xs text-red-600">
          <p id={purposeId} className="min-w-0 flex-1">
            {purposeError}
          </p>
          <p id={amountId} className={AMOUNT_COLUMN}>
            {amountError}
          </p>
          <span className={END_COLUMN} />
        </div>
      )}
    </li>
  )
}

// 창 아래 버튼 줄 왼쪽의 합계: '총 배정 예산 3,000,000원'(와이어프레임처럼 금액만 굵게). 수입 예산이면 '총 수입 예산'이다.
export function BudgetRowsTotal({ rows, income }: { rows: BudgetRow[]; income: boolean }) {
  return (
    <p className="text-sm text-gray-700">
      {income ? '총 수입 예산' : '총 배정 예산'}{' '}
      <strong className="font-semibold text-gray-900 tabular-nums">
        {wonLabel(rowsTotal(rows))}
      </strong>
    </p>
  )
}

// 예산 편성 창의 행 목록과 [항목 추가](와이어프레임 EVT-FIN-01B '행사 예산 편성'). 행의 상한은 계약과 같다.
// [항목 추가]는 버튼 안쪽 여백만큼 당겨 '+'를 입력칸 왼쪽 끝에 맞춘다(와이어프레임).
export function BudgetRows({ rows, errors, saving, onChange }: Props) {
  const change = (key: number, patch: Partial<BudgetRow>) =>
    onChange(rows.map(row => (row.key === key ? { ...row, ...patch } : row)))
  return (
    <div className="flex flex-col gap-2">
      <Head />
      <ol aria-label="예산 항목 행" className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <Row
            key={row.key}
            row={row}
            number={index + 1}
            errors={errors}
            saving={saving}
            removable={rows.length > 1}
            onChange={patch => change(row.key, patch)}
            onRemove={() => onChange(rows.filter(other => other.key !== row.key))}
          />
        ))}
      </ol>
      {rows.length < BUDGET_ROWS_MAX && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-3 self-start text-blue-700"
          busy={saving}
          onClick={() => onChange([...rows, blankRow()])}
        >
          <Plus aria-hidden />
          항목 추가
        </Button>
      )}
    </div>
  )
}
