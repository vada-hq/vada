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

// 열 머리: 와이어프레임은 입력칸 안 예시 글로 칸을 알리지만 예시 글을 쓰지 않으므로(AGENTS '화면 문구와 폼') 머리 한 줄로 둔다.
// 칸마다의 이름은 '항목 n 이름'·'항목 n 금액'으로 따로 붙는다(화면 읽기 프로그램과 시험이 이것으로 찾는다).
function Head() {
  return (
    <div aria-hidden className="flex gap-2 text-xs font-medium text-gray-700">
      <span className="min-w-0 flex-1">
        항목 이름 <span className="text-red-600">*</span>
      </span>
      <span className="w-24 @md:w-36">
        금액(원) <span className="text-red-600">*</span>
      </span>
      <span className="w-9 @md:w-15" />
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

// 한 행: 이름(넓게) · 금액(오른쪽 정렬) · 원 · 빼기. 문제는 그 행 바로 아래에 둔다.
function Row({ row, number, errors, saving, removable, onChange, onRemove }: RowProps) {
  const purposeError = errors[`rows.${number - 1}.purpose`]
  const amountError = errors[`rows.${number - 1}.amount`]
  const errorId = `budget-row-${row.key}-error`
  const described = (error: string | undefined) =>
    error ? { 'aria-invalid': true as const, 'aria-describedby': errorId } : {}
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
          {...described(purposeError)}
        />
        <Input
          aria-label={`항목 ${number} 금액`}
          aria-required
          inputMode="numeric"
          className="w-24 text-right tabular-nums @md:w-36"
          value={row.amount}
          disabled={saving}
          onChange={event => onChange({ amount: event.target.value })}
          {...described(amountError)}
        />
        <span aria-hidden className="hidden text-sm text-gray-500 @md:inline">
          원
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`항목 ${number} 빼기`}
          busy={saving}
          // 행이 하나면 뺄 것이 없다. 버튼을 끄지 않고(린트) 자리만 남겨 행의 폭을 맞춘다.
          className={cn(!removable && 'invisible')}
          onClick={onRemove}
        >
          <Minus />
        </Button>
      </div>
      {(purposeError || amountError) && (
        <p id={errorId} className="text-xs text-red-600">
          {[purposeError, amountError].filter(Boolean).join(' · ')}
        </p>
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
          className="self-start text-blue-700"
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
