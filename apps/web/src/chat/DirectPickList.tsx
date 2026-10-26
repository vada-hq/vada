import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import type { DirectPerson } from './direct-open'

// '/'를 치면 뜨는 1:1 대화할 사람 목록(부르기 목록과 같은 모양). 고르면 그 사람과 1:1이 열린다.
export default function DirectPickList({
  people,
  onPick,
}: {
  people: DirectPerson[]
  onPick: (person: DirectPerson) => void
}) {
  if (people.length === 0) return <StateMessage kind="empty">맞는 운영진 없음</StateMessage>
  return (
    <ul
      aria-label="1:1 대화할 사람"
      className="flex max-h-40 flex-col overflow-y-auto rounded-sm border bg-white"
    >
      {people.map(person => (
        <li key={person.id}>
          <Button
            type="button"
            variant="ghost"
            touch
            className="w-full justify-start wrap-anywhere whitespace-normal"
            // 눌러도 입력칸의 포커스가 풀리지 않게 한다.
            onMouseDown={event => event.preventDefault()}
            onClick={() => onPick(person)}
          >
            {person.name}
          </Button>
        </li>
      ))}
    </ul>
  )
}
