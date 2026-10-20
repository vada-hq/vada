import { useState } from 'react'
import type { ChatMessage } from '@vada/contracts'
import { Ellipsis, Megaphone } from 'lucide-react'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { timeLabel } from './chat-view'

type Props = {
  message: ChatMessage
  now: Date
  // 공지 붙이기·떼기 메뉴는 회장단이 전체방 메시지에서만 본다.
  canMarkNotice: boolean
  // 실패하면 보여 줄 문구를, 성공하면 null을 돌려준다.
  onMarkNotice: (message: ChatMessage, isNotice: boolean) => Promise<string | null>
}

function NoticeMenu({ message, onMarkNotice }: Pick<Props, 'message' | 'onMarkNotice'>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toggle = async () => {
    setBusy(true)
    setError(await onMarkNotice(message, !message.isNotice))
    setBusy(false)
  }
  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="메시지 동작" disabled={busy}>
            <Ellipsis />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem
            disabled={busy}
            onSelect={() => {
              void toggle()
            }}
          >
            <Megaphone aria-hidden />
            {message.isNotice ? '공지 해제' : '공지로 표시'}
          </MenuItem>
        </MenuContent>
      </Menu>
      {error && (
        <StateMessage kind="error" className="basis-full">
          {error}
        </StateMessage>
      )}
    </>
  )
}

// 메시지 하나: 보낸 사람, 시각, 공지 표시, 본문. 본문의 줄바꿈은 그대로 두고 긴 글은 꺾는다.
export default function MessageItem({ message, now, canMarkNotice, onMarkNotice }: Props) {
  return (
    <li className="flex flex-wrap items-start gap-x-2 gap-y-1 px-1 py-2">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
          <span className="font-medium wrap-anywhere text-gray-700">
            {message.senderName ?? '시스템'}
          </span>
          <time dateTime={message.sentAt}>{timeLabel(message.sentAt, now)}</time>
          {message.isNotice && (
            <Badge tone="info">
              <Megaphone aria-hidden className="size-3" />
              공지
            </Badge>
          )}
        </p>
        <p className="mt-1 text-sm/6 wrap-anywhere whitespace-pre-wrap text-gray-900">
          {message.body}
        </p>
      </div>
      {canMarkNotice && <NoticeMenu message={message} onMarkNotice={onMarkNotice} />}
    </li>
  )
}
