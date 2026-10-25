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
}

type Adding = 'request' | 'budget' | 'expense' | null

// 재정 탭의 [구매 요청 내기]·[예산 항목 더하기]·[지출 적기]. 이 행사 화면에서 열면 행사 칸이 이 행사로 채워진다.
// 완료한 행사에는 더할 수 없어 버튼이 없다. 요청은 구매 요청 권한, 예산 항목과 지출은 재정부(내 권한 목록)만 낸다.
export function EventMoneyAdd({ view, event, onAdded, ...handlers }: Props) {
  const [chosen, setAdding] = useState<Adding>(null)
  const can = (action: 'purchase.request' | 'finance.manage') => view.permissions.includes(action)
  const completed = event.status === 'completed'
  // 열려 있는 동안 권한을 잃었거나 행사가 완료되면 창을 닫는다(완료를 취소해도 빈 창이 다시 열리지 않게 상태도 비운다).
  const allowed =
    !completed &&
    (chosen === 'request' ? can('purchase.request') : chosen !== null && can('finance.manage'))
  const adding = allowed ? chosen : null
  useEffect(() => {
    if (chosen !== null && !allowed) setAdding(null)
  }, [chosen, allowed])
  if (completed) return null
  const councilId = view.council.id
  const close = () => setAdding(null)
  const done = () => {
    close()
    onAdded()
  }
  const shared = { councilId, eventId: event.id, onClose: close, ...handlers }
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {can('purchase.request') && (
          <Button variant="outline" size="sm" onClick={() => setAdding('request')}>
            구매 요청 내기
          </Button>
        )}
        {can('finance.manage') && (
          <Button variant="outline" size="sm" onClick={() => setAdding('budget')}>
            예산 항목 더하기
          </Button>
        )}
        {can('finance.manage') && (
          <Button variant="outline" size="sm" onClick={() => setAdding('expense')}>
            지출 적기
          </Button>
        )}
      </div>
      <RequestCreateDialog {...shared} open={adding === 'request'} onCreated={done} />
      {adding === 'budget' && <BudgetItemDialog {...shared} onSaved={done} />}
      <ExpenseCreateDialog
        {...shared}
        memberId={view.me.memberId}
        open={adding === 'expense'}
        onCreated={done}
      />
    </>
  )
}
