import { Avatar } from '@/components/Avatar'
import { cn } from '@/lib/utils'
import { clockLabel } from './chat-view'
import { bodyParts } from './message-links'
import MessageMenu from './MessageMenu'
import MessagePhotos from './MessagePhotos'
import { useMessageActions, type MessageActionArgs } from './useMessageActions'

type Props = MessageActionArgs & {
  councilId: string
  // 같은 사람이 바로 앞에 이어 쓴 메시지면 이름과 시각을 다시 보이지 않는다.
  continued: boolean
  mine: boolean
}

// 본문 말풍선(와이어프레임 메시지 화면). 줄바꿈은 그대로 두고, 주소는 새 탭에서 여는 링크다(쓰던 입력과 흐름을 잃지 않게, NN/g 새 탭 지침).
// 내 말풍선은 파란 바탕에 흰 글자이고(대비 5.2:1, WCAG 1.4.3), 안의 링크는 같은 흰 글자에 밑줄로 가른다.
// 와이어프레임의 옅은 파랑(blue-100)은 밑줄 없이 색만 달라 링크인지 알기 어렵다(WCAG 1.4.1).
// 남의 말풍선은 흰 바탕에 테두리, 링크는 파란 글자에 밑줄이다.
function Body({ body, mine }: { body: string; mine: boolean }) {
  return (
    <p
      className={cn(
        'rounded-2xl px-4 py-2 text-sm/6 wrap-anywhere whitespace-pre-wrap',
        mine
          ? 'bg-primary text-primary-foreground'
          : 'border border-gray-200 bg-white text-gray-800',
      )}
    >
      {bodyParts(body).map((part, index) =>
        part.kind === 'link' ? (
          <a
            key={index}
            href={part.text}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'underline underline-offset-2',
              mine ? 'text-primary-foreground' : 'text-blue-700',
            )}
          >
            {part.text}
          </a>
        ) : (
          part.text
        ),
      )}
    </p>
  )
}

// 말풍선 위의 보낸 사람. 남의 첫 메시지에만 보이고, 내 메시지는 이름 없이 '나'로 읽힌다(카카오톡).
// 같은 사람이 바로 이어 쓴 메시지는 이름을 다시 보이지 않는다.
function Sender({ message, mine, continued }: Pick<Props, 'message' | 'mine' | 'continued'>) {
  if (mine) return <span className="sr-only">나</span>
  if (continued) return null
  return (
    <span className="text-xs wrap-anywhere text-gray-500">{message.senderName ?? '시스템'}</span>
  )
}

// 말풍선 아래의 시각(와이어프레임). 이어 쓴 메시지는 화면 낭독기에만 읽힌다.
function Time({ message, continued }: Pick<Props, 'message' | 'continued'>) {
  return (
    <time dateTime={message.sentAt} className={continued ? 'sr-only' : 'text-xs text-gray-400'}>
      {clockLabel(message.sentAt)}
    </time>
  )
}

// 남의 메시지 왼쪽의 아바타. 이어 쓴 메시지는 같은 폭만 비워 말풍선 줄을 맞춘다.
function Face({ mine, continued }: Pick<Props, 'mine' | 'continued'>) {
  if (mine) return null
  return continued ? <span aria-hidden className="w-8 shrink-0" /> : <Avatar className="size-8" />
}

// 메시지 하나(와이어프레임 메시지 화면): 내 메시지는 오른쪽 파란 말풍선, 남의 메시지는 왼쪽에 아바타와 이름, 흰 말풍선.
// 아바타와 '…'는 말풍선 묶음의 아래에 맞춘다. '…'는 마우스로 쓰면 올리거나 포커스할 때만, 손가락으로 쓰면 늘 보인다
// (Slack·Teams, NN/g 문맥 메뉴 지침).
export default function MessageItem({ councilId, message, continued, mine, ...actionArgs }: Props) {
  const photos = message.photos
  const { actions } = useMessageActions({ message, ...actionArgs })
  return (
    <li
      className={cn(
        // relative: 숨긴 낭독용 글(sr-only)이 스크롤 칸 밖으로 나가 바깥 스크롤바를 만들지 않게 한다.
        'group relative flex items-end gap-2 rounded-sm px-2',
        continued ? 'py-0.5' : 'mt-2 pt-1.5 pb-0.5',
        mine && 'flex-row-reverse',
      )}
    >
      <Face mine={mine} continued={continued} />
      <div
        className={cn('flex max-w-xl min-w-0 flex-col gap-1', mine ? 'items-end' : 'items-start')}
      >
        <Sender message={message} mine={mine} continued={continued} />
        {message.body !== '' && <Body body={message.body} mine={mine} />}
        {photos.length > 0 && <MessagePhotos councilId={councilId} photos={photos} />}
        <Time message={message} continued={continued} />
      </div>
      <div className="pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100 pointer-fine:has-data-[state=open]:opacity-100">
        <MessageMenu actions={actions} />
      </div>
    </li>
  )
}
