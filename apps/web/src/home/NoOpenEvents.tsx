import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HomeEmpty } from './HomeSection'

type Props = {
  // 행사를 만들 수 있는 사람에게만 온다(events/event-view.ts canCreateEvent). 없으면 빈 문구만이다.
  onNewEvent?: (() => void) | undefined
}

// 행사 빈 상태의 [새 행사]. 지금 홈과 새 홈 카드(HomeCard의 빈 상태)가 같이 쓴다(명세 027 정한 것 11).
export function NewEventButton({ onNewEvent }: { onNewEvent: () => void }) {
  return (
    <Button size="sm" onClick={onNewEvent}>
      <Plus />새 행사
    </Button>
  )
}

// 진행할 행사가 없을 때의 한 줄: 만들 수 있는 사람에게는 [새 행사]를 함께 둔다(DEC-93, DEC-78 이동 규칙 9).
export default function NoOpenEvents({ onNewEvent }: Props) {
  return (
    <HomeEmpty action={onNewEvent && <NewEventButton onNewEvent={onNewEvent} />}>
      진행할 행사 없음
    </HomeEmpty>
  )
}
