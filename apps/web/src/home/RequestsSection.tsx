import { Send } from 'lucide-react'
import type { PurchaseRequestSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { STATUS_LABEL, STATUS_TONE } from '../finance/purchase-view'
import { createdDay, SHORT_LIST } from './home-view'
import HomeRow from './HomeRow'
import HomeSection from './HomeSection'

type Props = {
  requests: PurchaseRequestSummary[]
  onOpenRequest: (requestId: string) => void
  // 재정 화면(내 요청)으로 간다.
  onSeeAll: () => void
}

// 내 요청: 낸 구매 요청 중 반려·일부 승인과 결재 대기(요구 7). 없으면 부분을 두지 않는다.
export default function RequestsSection({ requests, ...open }: Props) {
  if (requests.length === 0) return null
  return (
    <HomeSection
      id="home-requests"
      icon={Send}
      title="내 요청"
      count={requests.length}
      onSeeAll={open.onSeeAll}
    >
      {requests.slice(0, SHORT_LIST).map(request => (
        <HomeRow
          key={request.id}
          title={request.title}
          meta={[request.event?.name, `${createdDay(request.createdAt)} 요청`]}
          side={<Badge tone={STATUS_TONE[request.status]}>{STATUS_LABEL[request.status]}</Badge>}
          onOpen={() => open.onOpenRequest(request.id)}
        />
      ))}
    </HomeSection>
  )
}
