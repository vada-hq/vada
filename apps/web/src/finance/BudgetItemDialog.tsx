import { useState } from 'react'
import { CreateBudgetItemsSchema, type BudgetItemType } from '@vada/contracts'
import { Field } from '@/components/ui/field'
import { NativeSelect } from '@/components/ui/native-select'
import { BUDGET_ROWS_UNSAVED } from '@/lib/budget-messages'
import { useFormCheck } from '@/lib/use-form-check'
import {
  budgetItemsOf,
  budgetRowErrors,
  defaultRows,
  rowContractErrors,
  untouchedRows,
  type BudgetRowsValues,
  type ExistingItem,
} from './budget-rows'
import { BudgetFormDialog } from './BudgetFormDialog'
import { BudgetRows, BudgetRowsTotal } from './BudgetRows'
import { EventField } from './EventField'
import { budgetItemsBatchPath } from './finance-api'
import { useBudgetChange, type BudgetChangeHandlers } from './useBudgetChange'

type Props = BudgetChangeHandlers & {
  councilId: string
  // 행사 화면에서 열면 그 행사의 지출 예산으로 고정하고 기본 행 셋을 둔다(종류·행사 칸 없음, 와이어프레임 그대로).
  eventId?: string | null
  // 같은 이름을 미리 짚을 이미 있는 항목. 연 화면이 이미 읽은 예산(예산 탭)이나 행사의 예산 항목(행사 재정 탭)을 준다.
  existing: readonly ExistingItem[]
  // 서버가 같은 이름으로 막았다(그사이 누가 더함). 연 화면이 예산을 다시 읽어 existing을 새로 준다.
  onStale: () => void
  onClose: () => void
}

type SharedProps = {
  councilId: string
  values: BudgetRowsValues
  saving: boolean
  onChange: (values: BudgetRowsValues) => void
  onForbidden: () => void
}

// 종류와 행사는 창의 모든 행에 같이 걸린다. 사람이 행을 고치기 전이면 바꿀 때 기본 행을 다시 채운다(행사 지출이면 셋).
function SharedFields({ councilId, values, saving, onChange, onForbidden }: SharedProps) {
  const pick = (patch: { type?: BudgetItemType; eventId?: string | null }) => {
    const next = { ...values, ...patch }
    onChange(
      untouchedRows(values.rows) ? { ...next, rows: defaultRows(next.type, next.eventId) } : next,
    )
  }
  return (
    <div className="grid gap-4 @md:grid-cols-2">
      <Field label="종류" required>
        <NativeSelect
          value={values.type}
          disabled={saving}
          onChange={event => pick({ type: event.target.value === 'income' ? 'income' : 'expense' })}
        >
          <option value="expense">지출</option>
          <option value="income">수입</option>
        </NativeSelect>
      </Field>
      <EventField
        councilId={councilId}
        value={values.eventId}
        disabled={saving}
        onChange={eventId => pick({ eventId })}
        onForbidden={onForbidden}
      />
    </div>
  )
}

// 예산 편성(DEC-92, 와이어프레임 EVT-FIN-01B '행사 예산 편성'): 여러 행을 한 창에서 짜고 한 거래로 보낸다.
// 한 행이라도 막히면 아무것도 남지 않으므로, 실패하면 창과 모든 행을 그대로 두고 '아무것도 저장하지 않았어요'를 함께 보인다.
// 같은 이름은 연 화면이 준 항목으로 미리 짚고, 서버가 같은 이름으로 막으면 연 화면이 예산을 다시 읽어 그 행을 짚는다.
// 제출 버튼은 와이어프레임처럼 '예산 저장'이다.
export function BudgetItemDialog({
  councilId,
  eventId = null,
  existing,
  onStale,
  onClose,
  ...handlers
}: Props) {
  const [values, setValues] = useState<BudgetRowsValues>(() => ({
    type: 'expense',
    eventId,
    rows: defaultRows('expense', eventId),
  }))
  const [saving, setSaving] = useState(false)
  const body = budgetItemsOf(values)
  const change = useBudgetChange(budgetItemsBatchPath(councilId), body, CreateBudgetItemsSchema, {
    ...handlers,
    setSaving,
    onRejected: code => {
      if (code === 'BUDGET_ITEM_DUPLICATE') onStale()
    },
  })
  const {
    formRef,
    errors: fieldErrors,
    attempt,
  } = useFormCheck(() => ({
    ...rowContractErrors(values.rows, change.parsed),
    ...budgetRowErrors(values, existing),
  }))
  const title = eventId ? '행사 예산 편성' : '예산 편성'
  return (
    <BudgetFormDialog
      title={title}
      submitLabel="예산 저장"
      saving={saving}
      formRef={formRef}
      attempt={attempt}
      problem={change.problem && `${change.problem} ${BUDGET_ROWS_UNSAVED}`}
      onSubmit={() => void change.submit()}
      onClose={onClose}
      wide
      summary={<BudgetRowsTotal rows={values.rows} income={values.type === 'income'} />}
    >
      {eventId === null && (
        <SharedFields
          councilId={councilId}
          values={values}
          saving={saving}
          onChange={setValues}
          onForbidden={handlers.onForbidden}
        />
      )}
      <BudgetRows
        rows={values.rows}
        errors={fieldErrors}
        saving={saving}
        onChange={rows => setValues({ ...values, rows })}
      />
    </BudgetFormDialog>
  )
}
