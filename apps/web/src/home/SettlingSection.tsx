import { Wallet } from 'lucide-react'
import type { HomeSettling } from '@vada/contracts'
import { settlementLabel, whenLabel } from '../events/event-view'
import HomeRow from './HomeRow'
import HomeSection, { HomeEmpty } from './HomeSection'

type Props = {
  settling: HomeSettling
  // 그 행사의 '재정' 탭으로 간다.
  onOpenEvent: (eventId: string, tab: 'money') => void
  onSeeAll: () => void
}

// 정산할 행사(재정부): 끝났고 완료하지 않은 행사와 정산에 남은 것.
export default function SettlingSection({ settling, onOpenEvent, onSeeAll }: Props) {
  const { events, total } = settling
  return (
    <HomeSection
      icon={Wallet}
      title="정산할 행사"
      count={total > 0 ? total : undefined}
      onSeeAll={total > events.length ? onSeeAll : undefined}
    >
      {events.length === 0 && <HomeEmpty>정산할 행사 없음</HomeEmpty>}
      {events.map(({ event, settlement }) => (
        <HomeRow
          key={event.id}
          title={event.name}
          meta={[whenLabel(event)]}
          side={<span className="font-medium text-gray-700">{settlementLabel(settlement)}</span>}
          onOpen={() => onOpenEvent(event.id, 'money')}
        />
      ))}
    </HomeSection>
  )
}
