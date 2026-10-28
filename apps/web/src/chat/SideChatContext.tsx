import { createContext, useRef, useState, type ReactNode } from 'react'
import { statusOf, type RoomParticipant } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { openMessageRoom } from '@/lib/go-to'
import { DIRECT_ERRORS, DIRECT_FAILED } from '@/lib/messages'
import { openDirect } from './chat-api'
import type { RoomPage } from './ChatPage'
import { useActive } from '@/lib/use-active'

type Access = {
  meId: string
  canDirect: boolean
  members: RoomParticipant[]
  busy: boolean
  open: (memberId: string, beforeOpen?: () => void) => Promise<boolean>
}
export const SideChatContext = createContext<Access | null>(null)

// 이름과 /이름의 중복 누르기·실패 처리는 한 곳에서 한다.
export function useDirectOpener(
  councilId: string,
  callbacks: {
    onOpen: (roomId: string) => void
    onForbidden?: (() => void) | undefined
    onMissing?: (() => void) | undefined
  },
) {
  const pending = useRef(false)
  const active = useActive()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = async (memberId: string, beforeOpen?: () => void) => {
    if (pending.current) return false
    pending.current = true
    setBusy(true)
    setError(null)
    const result = await openDirect(councilId, memberId)
    pending.current = false
    if (!active()) return false
    setBusy(false)
    if (result.ok) {
      beforeOpen?.()
      callbacks.onOpen(result.data.roomId)
      return true
    }
    if (result.status === statusOf('FORBIDDEN')) callbacks.onForbidden?.()
    if (result.status === statusOf('NOT_FOUND')) callbacks.onMissing?.()
    setError(DIRECT_ERRORS[result.code] ?? DIRECT_FAILED)
    return false
  }
  return { busy, error, open }
}

// 행사 탭의 Room도 같은 경로를 쓴다. 여는 자리가 없으면 메시지 화면으로 이동한다.
export function SideChatAccess({
  page,
  onOpen,
  children,
}: {
  page: RoomPage
  onOpen?: ((roomId: string) => void) | undefined
  children: ReactNode
}) {
  const canDirect = page.view.permissions.includes('chat.direct')
  const { busy, error, open } = useDirectOpener(page.councilId, {
    onOpen: roomId => {
      void page.rooms.reload()
      if (onOpen) onOpen(roomId)
      else openMessageRoom(page.councilId, roomId)
    },
    onForbidden: page.onForbidden,
    onMissing: page.team.reload,
  })
  return (
    <SideChatContext
      value={{
        meId: page.view.me.memberId,
        canDirect,
        busy,
        open,
        members: (page.team.data?.members ?? []).map(member => ({
          memberId: member.id,
          name: member.name,
        })),
      }}
    >
      <div className="flex h-full min-h-0 flex-col">
        {error && (
          <StateMessage kind="error" className="shrink-0 px-4 py-2">
            {error}
          </StateMessage>
        )}
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </SideChatContext>
  )
}
