import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { openMenu } from '@/lib/go-to'

export function NoPeriod({ councilId, canManage }: { councilId: string; canManage: boolean }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <StateMessage kind="empty">회계 기간 없음</StateMessage>
      {canManage && (
        <Button touch onClick={() => openMenu('finance', councilId, { tab: 'budget' })}>
          예산 탭에서 만들기
        </Button>
      )}
    </div>
  )
}
