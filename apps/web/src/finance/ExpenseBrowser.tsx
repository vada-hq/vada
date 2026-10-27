import { useMenuQuery } from '@/lib/use-menu-query'
import { Button } from '@/components/ui/button'
import { ExpensesPanel } from './ExpensesPanel'
import { CommitmentsPanel } from './CommitmentsPanel'
import type { ExpenseList } from './useExpenses'

export function ExpenseBrowser({
  councilId,
  list,
  onOpen,
  onForbidden,
}: {
  councilId: string
  list: ExpenseList
  onOpen: (id: string) => void
  onForbidden: () => void
}) {
  const url = useMenuQuery('finance', councilId)
  const periodId = url.query['period'] ?? null
  if (url.query['spending'] === 'committed')
    return (
      <>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">지출 예정</h2>
          <Button variant="outline" touch onClick={() => url.set({ spending: null })}>
            실제 지출
          </Button>
        </div>
        <CommitmentsPanel councilId={councilId} periodId={periodId} onForbidden={onForbidden} />
      </>
    )
  return (
    <ExpensesPanel
      list={list}
      onOpen={onOpen}
      periodId={periodId}
      onPeriod={period => url.set({ period })}
    />
  )
}
