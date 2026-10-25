import { useState } from 'react'
import { EmptyRequestSchema, type BudgetItemView, type BudgetResponse } from '@vada/contracts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { HistoryMenu, type MenuAction } from '@/components/HistoryMenu'
import { budgetHistoryLines } from './budget-text'
import { BudgetItemEditDialog } from './BudgetItemEditDialog'
import { budgetItemDeletePath } from './finance-api'
import { useBudgetChange, type BudgetChangeHandlers } from './useBudgetChange'

type Props = BudgetChangeHandlers & {
  councilId: string
  item: BudgetItemView
  // 재정부(finance.manage)만 고치고 지운다. 이력은 모든 운영진이 본다.
  canManage: boolean
}

type DeleteProps = BudgetChangeHandlers & {
  councilId: string
  item: BudgetItemView
  onClose: () => void
}

// 쓰인 적 없는 항목만 지운다(서버가 다시 막는다, 쓰였으면 409 문구가 이 창에 남는다).
function DeleteConfirm({ councilId, item, onClose, ...handlers }: DeleteProps) {
  const [saving, setSaving] = useState(false)
  const change = useBudgetChange(budgetItemDeletePath(councilId, item.id), {}, EmptyRequestSchema, {
    ...handlers,
    setSaving,
  })
  return (
    <ConfirmDialog
      title="예산 항목 지우기"
      confirmLabel="항목 지우기"
      destructive
      busy={saving}
      error={change.problem}
      onConfirm={() => void change.submit()}
      onClose={onClose}
    >
      <p className="text-sm wrap-anywhere text-gray-700">{item.purpose}</p>
    </ConfirmDialog>
  )
}

// 예산 항목 칸 오른쪽 위의 '⋯' 메뉴(DEC-92): 고치기, 항목 지우기(쓰인 적 없을 때만), 이력 보기.
// 다시 편성하는 화면 대신 항목마다 바로 고치고 이력에 남긴다(Ramp, Brex, QuickBooks).
export function BudgetItemActions({ councilId, item, canManage, ...handlers }: Props) {
  const [open, setOpen] = useState<'edit' | 'delete' | null>(null)
  const close = () => setOpen(null)
  const actions: MenuAction[] = canManage
    ? [
        { label: '고치기', onSelect: () => setOpen('edit') },
        ...(item.deletable
          ? [{ label: '항목 지우기', destructive: true, onSelect: () => setOpen('delete') }]
          : []),
      ]
    : []
  const lines = budgetHistoryLines(item.history)
  // 창은 이 메뉴가 연다. 저장하거나 볼 수 없게 되면 여기서 닫고 예산 탭에 알린다.
  const shared = {
    councilId,
    item,
    onClose: close,
    onForbidden: handlers.onForbidden,
    onSaved: (budget: BudgetResponse) => {
      close()
      handlers.onSaved(budget)
    },
    onLost: (message: string) => {
      close()
      handlers.onLost(message)
    },
  }
  return (
    <>
      <HistoryMenu
        history={lines}
        line={version => version.text}
        label={`${item.purpose} 더 보기`}
        actions={actions}
      />
      {open === 'edit' && <BudgetItemEditDialog {...shared} />}
      {open === 'delete' && <DeleteConfirm {...shared} />}
    </>
  )
}
