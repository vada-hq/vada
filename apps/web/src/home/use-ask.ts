import type { HomeOpsPerson } from '@vada/contracts'
import { openMessageRoom } from '@/lib/go-to'
import { useDirectOpener } from '../chat/SideChatContext'
import type { TaskDirect } from '../tasks/TaskAssigneeName'

// 사람마다 '…에게 묻기'를 누를 때 할 일. 없으면 그 사람에게는 묻기가 글로만 보인다.
export type AskOf = (person: HomeOpsPerson) => (() => void) | undefined

// '…에게 묻기'는 그 사람과의 1:1을 열어 메시지 화면 오른쪽 1:1 칸에 띄운다(업무 담당자 이름과 같은 길, PersonName).
// 1:1 권한이 없거나 나 자신이면 열 곳이 없다.
export function useAsk(councilId: string, direct: TaskDirect | undefined) {
  const opener = useDirectOpener(councilId, {
    onOpen: roomId => openMessageRoom(councilId, roomId),
  })
  const askOf: AskOf = person =>
    direct?.canDirect && person.memberId !== direct.meId
      ? () => void opener.open(person.memberId)
      : undefined
  return { askOf, error: opener.error }
}
