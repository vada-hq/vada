import { useEffect } from 'react'
import type { TeamMember } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DIRECT_PEOPLE_FAILED } from '@/lib/messages'
import type { Team } from '../team/useTeam'
import { useDirectOpener } from './SideChatContext'
import { DIRECT_PEOPLE_EMPTY } from './message-text'

type Props = {
  councilId: string
  meId: string
  team: Team
  open: boolean
  onClose: () => void
  // 열린 방의 번호를 받는다. 목록을 다시 읽고 그 방으로 간다.
  onOpened: (roomId: string) => void
  // 권한이 바뀌었을 때(403). 화면이 대화상자를 닫고 이유를 보인다.
  onForbidden: () => void
}

function People({
  members,
  busy,
  onPick,
}: {
  members: TeamMember[]
  busy: boolean
  onPick: (member: TeamMember) => void
}) {
  if (members.length === 0) return <StateMessage kind="empty">{DIRECT_PEOPLE_EMPTY}</StateMessage>
  return (
    <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
      {members.map(member => (
        <li key={member.id}>
          <Button
            variant="ghost"
            touch
            className="w-full justify-start font-normal wrap-anywhere whitespace-normal text-fg-body"
            busy={busy}
            onClick={() => onPick(member)}
          >
            {member.name}
          </Button>
        </li>
      ))}
    </ul>
  )
}

// 1:1 대화 시작(목록의 '1:1 대화' 묶음 머리 [+]): 운영진 한 사람을 고르면 그 사람과의 방이 열린다(두 번 열어도 같은 방). 고르는 동안에는 다른 사람을 누를 수 없다.
export default function DirectDialog({
  councilId,
  meId,
  team,
  open,
  onClose,
  onOpened,
  onForbidden,
}: Props) {
  const {
    busy,
    error,
    open: pick,
  } = useDirectOpener(councilId, {
    onOpen: onOpened,
    onForbidden,
    onMissing: team.reload,
  })
  // 창을 열 때 운영진을 바로 다시 읽는다(방금 들어온 사람이 보이게).
  const reloadTeam = team.reload
  useEffect(() => {
    if (open) reloadTeam()
  }, [open, reloadTeam])
  const members = (team.data?.members ?? []).filter(member => member.id !== meId)
  return (
    <Dialog open={open} onOpenChange={next => !next && !busy && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>1:1 대화</DialogTitle>
        </DialogHeader>
        {team.data ? (
          <People members={members} busy={busy} onPick={member => void pick(member.id)} />
        ) : (
          <StateMessage kind={team.loadFailed ? 'error' : 'loading'}>
            {team.loadFailed ? DIRECT_PEOPLE_FAILED : '운영진 불러오는 중…'}
          </StateMessage>
        )}
        {error && <StateMessage kind="error">{error}</StateMessage>}
      </DialogContent>
    </Dialog>
  )
}
