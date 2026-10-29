import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'

// 회의 읽기가 실패했을 때의 자리. 회의 메뉴와 행사 회의 탭이 같이 쓴다.
export function MeetingReadFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <StateMessage kind="error">{message}</StateMessage>
      <Button variant="outline" touch onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  )
}
