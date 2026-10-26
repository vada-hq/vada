import { useMemo, useRef, useState } from 'react'
import { statusOf, type CouncilView } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { DIRECT_ERRORS, DIRECT_FAILED } from '@/lib/messages'
import { useLatest } from '@/lib/use-latest'
import type { Team } from '../team/useTeam'
import { directPath, type DirectBody, type DirectResponse } from './chat-api'
import { draftOf, keepDraft } from './composer-drafts'
import type { DirectOpener, DirectPerson } from './direct-open'
import type { RoomList } from './useRoomList'

// 오른쪽 1:1 패널에 연 사람과 그 방. 한 번에 하나다(DEC-90, Slack split view).
export type DirectTarget = { person: DirectPerson } & (
  { kind: 'opening' } | { kind: 'open'; roomId: string } | { kind: 'failed'; error: string }
)

type Args = {
  councilId: string
  view: CouncilView | null
  team: Team
  rooms: RoomList
  // 권한이 바뀌었을 때(403) 학생회를 다시 읽게 한다.
  onForbidden: () => void
}

// '/이름' 뒤에 친 글을 그 방의 보내지 않은 글 뒤에 붙인다. 이미 쓰던 글을 덮지 않는다.
function moveDraft(meId: string, councilId: string, roomId: string, text: string) {
  const kept = draftOf(meId, councilId, roomId)
  const body = kept.body === '' ? text : `${kept.body}\n${text}`
  keepDraft(meId, councilId, roomId, { body, picks: kept.picks })
}

// 1:1 열기(지금 API `POST direct`, 없으면 서버가 만든다)와 패널 상태. 다른 사람을 열면 패널이 그 사람으로 바뀌고,
// 늦게 온 앞 사람의 응답은 버린다. 쓰던 글은 방마다 남는다(composer-drafts).
export function useDirectPanel(args: Args) {
  const { view, team } = args
  const [target, setTarget] = useState<DirectTarget | null>(null)
  const turn = useRef(0)
  const latest = useLatest(args)
  const meId = view?.me.memberId ?? null
  const canDirect = view?.permissions.includes('chat.direct') ?? false

  const open = useLatest(async (person: DirectPerson, draft?: string) => {
    const mine = ++turn.current
    const { councilId, rooms, onForbidden } = latest.current
    setTarget({ person, kind: 'opening' })
    const result = await postJson<DirectResponse>(directPath(councilId), {
      memberId: person.id,
    } satisfies DirectBody)
    if (mine !== turn.current) return
    if (result.ok) {
      const { roomId } = result.data
      if (draft && meId) moveDraft(meId, councilId, roomId, draft)
      void rooms.reload()
      return setTarget({ person, kind: 'open', roomId })
    }
    if (result.status === statusOf('FORBIDDEN')) onForbidden()
    if (result.status === statusOf('NOT_FOUND')) latest.current.team.reload()
    setTarget({ person, kind: 'failed', error: DIRECT_ERRORS[result.code] ?? DIRECT_FAILED })
  })

  const members = team.data?.members
  const opener = useMemo<DirectOpener | null>(
    () =>
      canDirect && meId
        ? { meId, people: members ?? [], open: (person, draft) => void open.current(person, draft) }
        : null,
    [canDirect, meId, members, open],
  )
  const close = () => {
    turn.current++
    setTarget(null)
  }
  return { opener, target, close }
}
