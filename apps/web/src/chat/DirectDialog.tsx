import { useEffect, useState } from 'react'
import { statusOf, type TeamMember } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { postJson } from '@/lib/api'
import { DIRECT_ERRORS, DIRECT_FAILED, DIRECT_PEOPLE_FAILED } from '@/lib/messages'
import type { Team } from '../team/useTeam'
import { directPath, type DirectBody, type DirectResponse } from './chat-api'

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
  if (members.length === 0) return <StateMessage kind="empty">운영진 없음</StateMessage>
  return (
    <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
      {members.map(member => (
        <li key={member.id}>
          <Button
            variant="ghost"
            className="w-full justify-start font-normal wrap-anywhere whitespace-normal text-gray-800"
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 창을 열 때 운영진을 바로 다시 읽는다(방금 들어온 사람이 보이게).
  const reloadTeam = team.reload
  useEffect(() => {
    if (open) reloadTeam()
  }, [open, reloadTeam])
  const members = (team.data?.members ?? []).filter(member => member.id !== meId)
  const pick = async (member: TeamMember) => {
    setBusy(true)
    setError(null)
    const result = await postJson<DirectResponse>(directPath(councilId), {
      memberId: member.id,
    } satisfies DirectBody)
    setBusy(false)
    if (result.ok) return onOpened(result.data.roomId)
    // 권한을 잃었으면 대화상자는 닫히고, 이유는 목록 위에 보인다.
    if (result.status === statusOf('FORBIDDEN')) return onForbidden()
    if (result.status === statusOf('NOT_FOUND')) team.reload()
    setError(DIRECT_ERRORS[result.code] ?? DIRECT_FAILED)
  }
  return (
    <Dialog open={open} onOpenChange={next => !next && !busy && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>1:1 대화</DialogTitle>
        </DialogHeader>
        {team.data ? (
          <People members={members} busy={busy} onPick={member => void pick(member)} />
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
