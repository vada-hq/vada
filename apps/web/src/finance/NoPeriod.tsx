import { whoDoes } from '@vada/contracts'
import { EmptyMessage } from '@/components/EmptyMessage'
import { Button } from '@/components/ui/button'
import { openMenu } from '@/lib/go-to'

export function NoPeriod({ councilId, canManage }: { councilId: string; canManage: boolean }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <EmptyMessage who={canManage ? null : whoDoes('finance.manage', '만들어요')}>
        회계 기간 없음
      </EmptyMessage>
      {canManage && (
        <Button touch onClick={() => openMenu('finance', councilId)}>
          예산 현황에서 만들기
        </Button>
      )}
    </div>
  )
}
