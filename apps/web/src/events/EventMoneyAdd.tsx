import { useEffect, useState } from 'react'
import type { CouncilView, EventDetail } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { BudgetItemDialog } from '../finance/BudgetItemDialog'
import { ExpenseCreateDialog } from '../finance/ExpenseCreateDialog'
import { RequestCreateDialog } from '../finance/RequestCreateDialog'
import type { EventDialogHandlers } from './useEventSubmit'

type Props = EventDialogHandlers & {
  view: CouncilView
  event: EventDetail
  // 더했다. 정산을 다시 읽는다.
  onAdded: () => void
  // 이 행사의 예산 항목 이름(정산이 읽은 것). 예산 편성 창이 같은 이름을 미리 짚는다.
  budgetNames: readonly string[]
}

type Adding = 'request' | 'budget' | 'expense' | null

// 구매 탭의 새 구매 요청·예산 편성·지출 적기. 이 행사 화면에서 열면 행사 칸이 이 행사로 채워진다.
// 완료한 행사에는 더할 수 없어 열 수 없다. 요청은 구매 요청 권한, 예산 항목과 지출은 재정부(내 권한 목록)만 낸다.
// 새 요청은 머리글에, 예산 편성·지출 적기는 예산 카드 옆에 두므로 여는 함수와 창을 따로 준다.
export function useEventMoneyAdd({ view, event, onAdded, budgetNames, ...handlers }: Props) {
  const [chosen, setAdding] = useState<Adding>(null)
  const completed = event.status === 'completed'
  const can = (action: 'purchase.request' | 'finance.manage') =>
    !completed && view.permissions.includes(action)
  // 열려 있는 동안 권한을 잃었거나 행사가 완료되면 창을 닫는다(완료를 취소해도 빈 창이 다시 열리지 않게 상태도 비운다).
  const allowed =
    chosen === 'request' ? can('purchase.request') : chosen !== null && can('finance.manage')
  const adding = allowed ? chosen : null
  useEffect(() => {
    if (chosen !== null && !allowed) setAdding(null)
  }, [chosen, allowed])
  const councilId = view.council.id
  const close = () => setAdding(null)
  const done = () => {
    close()
    onAdded()
  }
  const shared = { councilId, eventId: event.id, onClose: close, ...handlers }
  const dialogs = (
    <>
      <RequestCreateDialog
        {...shared}
        memberId={view.me.memberId}
        open={adding === 'request'}
        onCreated={done}
      />
      {adding === 'budget' && (
        <BudgetItemDialog
          {...shared}
          existing={budgetNames.map(purpose => ({ purpose, event: { id: event.id } }))}
          onStale={onAdded}
          onSaved={done}
        />
      )}
      <ExpenseCreateDialog
        {...shared}
        memberId={view.me.memberId}
        open={adding === 'expense'}
        onCreated={done}
      />
    </>
  )
  const financeActions = can('finance.manage') ? (
    <>
      <Button touch variant="outline" onClick={() => setAdding('budget')}>
        예산 편성
      </Button>
      <Button touch variant="outline" onClick={() => setAdding('expense')}>
        지출 적기
      </Button>
    </>
  ) : null
  return {
    createRequest: can('purchase.request') ? () => setAdding('request') : null,
    financeActions,
    dialogs,
  }
}
