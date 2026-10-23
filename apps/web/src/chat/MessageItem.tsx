import { Megaphone } from 'lucide-react'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { timeLabel } from './chat-view'
import MessageMenu from './MessageMenu'
import MessagePhotos from './MessagePhotos'
import { useMessageActions, type MessageActionArgs } from './useMessageActions'

type Props = MessageActionArgs & {
  councilId: string
  now: Date
}

// 메시지 하나: 보낸 사람, 시각, 공지 표시, 본문. 본문의 줄바꿈은 그대로 두고 긴 글은 꺾는다.
export default function MessageItem({ councilId, message, now, ...actionArgs }: Props) {
  const photos = message.photos
  const { actions, busy, error } = useMessageActions({ message, ...actionArgs })
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
        {message.body !== '' && (
          <p className="mt-1 text-sm/6 wrap-anywhere whitespace-pre-wrap text-gray-900">
            {message.body}
          </p>
        )}
        {photos.length > 0 && <MessagePhotos councilId={councilId} photos={photos} />}
      </div>
      <MessageMenu actions={actions} busy={busy} />
      {error && (
        <StateMessage kind="error" className="basis-full">
          {error}
        </StateMessage>
      )}
    </li>
  )
}
