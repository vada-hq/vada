import { Inbox } from 'lucide-react'
import type { HomeReceived } from '@vada/contracts'
import { createdDay } from './home-view'
import HomeRow from './HomeRow'
import HomeSection, { HomeEmpty } from './HomeSection'

type Props = {
  received: HomeReceived
  onOpenRequest: (requestId: string) => void
  // 재정 화면으로 간다.
  onSeeAll: () => void
}

// 받은 것(재정부): 결재 대기 요청, 오래된 것부터. 결재는 요청 상세에서 한다(품목마다 정해야 한다).
export default function ReceivedSection({ received, onOpenRequest, onSeeAll }: Props) {
  const { requests, total, truncated } = received
  return (
    <HomeSection
      id="home-received"
      icon={Inbox}
      title="받은 것"
      count={total > 0 ? (truncated ? `${total}+` : total) : undefined}
      onSeeAll={total > requests.length ? onSeeAll : undefined}
    >
      {requests.length === 0 && <HomeEmpty>받은 것 없음</HomeEmpty>}
      {requests.map(request => (
        <HomeRow
          key={request.id}
          title={request.title}
          meta={[
            request.requestedBy.name,
            request.event?.name,
            `${createdDay(request.createdAt)} 요청`,
          ]}
          onOpen={() => onOpenRequest(request.id)}
        />
      ))}
    </HomeSection>
  )
}
