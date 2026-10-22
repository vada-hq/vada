import { useState } from 'react'
import { INCOME_LIST_LIMIT, type FiscalPeriodSummary } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { INCOMES_LOAD_FAILED, PERIODS_LOAD_FAILED, PERMISSION_CHANGED } from '@/lib/messages'
import { useDialogGuard } from '@/lib/use-dialog-guard'
import { useRecordDialogs } from '@/lib/use-record-dialogs'
import { IncomeCreateDialog } from './IncomeCreateDialog'
import { IncomeDetailDialog } from './IncomeDetailDialog'
import IncomeCard from './IncomeCard'
import { useIncomes, usePeriods, type IncomeList } from './useIncomes'

type Props = {
  councilId: string
  // 수입 적기는 `finance.manage`가 있을 때만. 보는 것은 모든 운영진이다.
  canManage: boolean
  onForbidden: () => void
}

// 고른 기간이 없거나 목록에서 사라졌으면 지금 기간, 그것도 없으면 가장 최근 기간이다.
function chosenPeriod(periods: FiscalPeriodSummary[], chosenId: string | null) {
  return (
    periods.find(period => period.id === chosenId) ??
    periods.find(period => period.current) ??
    periods[0] ??
    null
  )
}

function IncomeBody({ list, onOpen }: { list: IncomeList; onOpen: (incomeId: string) => void }) {
  const { state } = list
  if (state.kind === 'loading') return <StateMessage kind="loading">수입 불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col gap-3">
        <StateMessage kind="error">{INCOMES_LOAD_FAILED}</StateMessage>
        <Button variant="outline" className="self-start" onClick={() => void list.reload()}>
          다시 시도
        </Button>
      </div>
    )
  const { incomes, truncated } = state.data
  if (incomes.length === 0) return <StateMessage kind="empty">적힌 수입이 없어요.</StateMessage>
  return (
    <>
      <ul className="flex flex-col gap-2">
        {incomes.map(income => (
          <li key={income.id}>
            <IncomeCard income={income} onOpen={() => onOpen(income.id)} />
          </li>
        ))}
      </ul>
      {truncated && (
        <StateMessage kind="notice">수입이 많아서 {INCOME_LIST_LIMIT}개만 보여요.</StateMessage>
      )}
    </>
  )
}

function PeriodSelect({
  periods,
  value,
  onChange,
}: {
  periods: FiscalPeriodSummary[]
  value: string
  onChange: (periodId: string) => void
}) {
  return (
    <Label className="flex flex-col gap-2">
      회계 기간
      <NativeSelect value={value} onChange={event => onChange(event.target.value)}>
        {periods.map(period => (
          <option key={period.id} value={period.id}>
            {period.current ? `${period.name} (지금)` : period.name}
          </option>
        ))}
      </NativeSelect>
    </Label>
  )
}

// 수입 상세와 수입 적기 대화상자. 바꾸면 목록을 다시 읽고, 열려 있던 수입이 사라졌거나 권한을 잃으면 닫고 이유를 목록 위에 보인다.
function IncomeDialogs({
  councilId,
  period,
  dialogs,
  onChanged,
  onForbidden,
}: {
  councilId: string
  period: FiscalPeriodSummary
  dialogs: ReturnType<typeof useRecordDialogs>
  onChanged: () => void
  onForbidden: () => void
}) {
  const lose = (message: string) => {
    dialogs.lose(message)
    onChanged()
  }
  return (
    <>
      <IncomeDetailDialog
        councilId={councilId}
        incomeId={dialogs.openId}
        onClose={dialogs.closeDetail}
        onChanged={onChanged}
        onLost={lose}
        onForbidden={onForbidden}
      />
      <IncomeCreateDialog
        councilId={councilId}
        period={period}
        open={dialogs.creating}
        onClose={dialogs.closeCreate}
        onCreated={() => {
          onChanged()
          dialogs.closeCreate()
        }}
        onLost={lose}
        onForbidden={onForbidden}
      />
    </>
  )
}

// 수입 탭: 기간을 고르고(기본 지금 기간) 그 기간의 수입을 받은 날 최근 순으로 본다. 적고 취소하는 것은 재정부다.
// 수입 적기를 연 동안 재정 권한이 빠져도 닫고 이유를 보인다.
export function IncomesTab({ councilId, canManage, onForbidden }: Props) {
  const periods = usePeriods(councilId, onForbidden)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const list = periods.state.kind === 'ready' ? periods.state.data.periods : []
  const period = chosenPeriod(list, chosenId)
  const incomes = useIncomes(councilId, period?.id ?? null, onForbidden)
  const dialogs = useRecordDialogs()
  useDialogGuard(dialogs.creating, canManage ? null : PERMISSION_CHANGED, dialogs.lose)
  if (periods.state.kind === 'failed')
    return <StateMessage kind="error">{PERIODS_LOAD_FAILED}</StateMessage>
  if (periods.state.kind === 'loading')
    return <StateMessage kind="loading">불러오는 중…</StateMessage>
  if (period === null)
    return (
      <StateMessage kind="empty">회계 기간이 없어요. 예산 탭에서 먼저 만들어 주세요.</StateMessage>
    )
  return (
    <div className="flex flex-col gap-3">
      <PeriodSelect periods={list} value={period.id} onChange={setChosenId} />
      <div className="flex flex-wrap items-center gap-3">
        {canManage && (
          <Button variant="outline" onClick={dialogs.startCreate}>
            수입 적기
          </Button>
        )}
        {dialogs.lost && <StateMessage kind="error">{dialogs.lost}</StateMessage>}
      </div>
      <IncomeBody list={incomes} onOpen={dialogs.openRecord} />
      <IncomeDialogs
        councilId={councilId}
        period={period}
        dialogs={dialogs}
        onChanged={() => void incomes.reload()}
        onForbidden={onForbidden}
      />
    </div>
  )
}
