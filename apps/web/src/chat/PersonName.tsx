import { useContext } from 'react'
import { isLeftMemberName } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { openMessageRoom } from '@/lib/go-to'
import { directNameLabel } from './message-text'
import { SideChatContext, useDirectOpener } from './SideChatContext'

type Props = {
  councilId: string
  memberId: string
  name: string
  meId: string
  canDirect: boolean
  onOpen?: (roomId: string) => void
  onForbidden?: () => void
  onMissing?: () => void
}

// 업무 담당자도 같은 명시적 인자로 쓸 수 있다. 문맥이 없으면 기록 주소로 메시지 화면을 연다.
export default function PersonName({
  councilId,
  memberId,
  name,
  meId,
  canDirect,
  onOpen,
  onForbidden,
  onMissing,
}: Props) {
  const access = useContext(SideChatContext)
  const opener = useDirectOpener(councilId, {
    onOpen: roomId => {
      if (onOpen) onOpen(roomId)
      else openMessageRoom(councilId, roomId)
    },
    onForbidden,
    onMissing,
  })
  const pick = async () => {
    if (access && !onOpen) await access.open(memberId)
    else await opener.open(memberId)
  }
  if (!canDirect || memberId === meId || isLeftMemberName(name))
    return <span className="break-keep wrap-anywhere">{name}</span>
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        touch
        busy={opener.busy || (access?.busy ?? false)}
        aria-label={directNameLabel(name)}
        className="h-auto min-w-0 justify-start p-0 text-inherit break-keep underline decoration-dotted underline-offset-2 wrap-anywhere whitespace-normal"
        onClick={() => void pick()}
      >
        {name}
      </Button>
      {opener.error && <StateMessage kind="error">{opener.error}</StateMessage>}
    </>
  )
}
