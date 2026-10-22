import type { HomeReceived } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { createdDay } from './home-view'

type Props = {
  received: HomeReceived
  onOpenRequest: (requestId: string) => void
  // 재정 화면으로 간다.
  onSeeAll: () => void
}

// 받은 것(재정부): 결재 대기 요청. 줄을 누르면 재정 화면에서 그 요청의 상세가 열린다.
export default function ReceivedSection({ received, onOpenRequest, onSeeAll }: Props) {
  const { requests, total, truncated } = received
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">
          받은 것{total > 0 && ` ${total}${truncated ? '개 이상' : ''}`}
        </h2>
        {total > requests.length && (
          <Button variant="link" size="sm" className="px-0" onClick={onSeeAll}>
            모두 보기
          </Button>
        )}
      </div>
      {requests.length === 0 && <StateMessage kind="empty">받은 것이 없어요.</StateMessage>}
      <ul className="flex flex-col">
        {requests.map(request => (
          <li key={request.id}>
            <Button
              variant="ghost"
              className="h-auto w-full flex-col items-start gap-0.5 px-2 py-2 text-left whitespace-normal"
              onClick={() => onOpenRequest(request.id)}
            >
              <span className="text-sm font-medium text-gray-900 wrap-anywhere">
                {request.title}
              </span>
              <span className="flex flex-wrap gap-x-2 text-xs font-normal text-gray-500">
                <span className="wrap-anywhere">{request.requestedBy.name}</span>
                <span>{createdDay(request.createdAt)}</span>
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
