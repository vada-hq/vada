import { useState } from 'react'
import {
  coupangProductOf,
  DELETED_MESSAGE,
  isLeftMemberName,
  type ChatMessage,
} from '@vada/contracts'
import { Avatar } from '@/components/Avatar'
import { cn } from '@/lib/utils'
import { clockLabel } from './chat-view'
import { bodyParts } from './message-links'
import MessageMenu from './MessageMenu'
import MessageMade from './MessageMade'
import MessagePhotos from './MessagePhotos'
import { useProductOpener } from './product-open'
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
function Body({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const openProduct = useProductOpener()
  return (
    <p
      className={cn(
        'rounded-2xl px-4 py-2 text-sm/6 wrap-anywhere whitespace-pre-wrap',
        mine
          ? 'bg-primary text-primary-foreground'
          : 'border border-gray-200 bg-white text-gray-800',
      )}
    >
      {bodyParts(message.body ?? '').map((part, index) =>
        part.kind === 'link' ? (
          <a
            key={index}
            href={part.text}
            target="_blank"
            rel="noopener noreferrer"
            onClick={event => {
              if (openProduct && coupangProductOf(part.text)) {
                event.preventDefault()
                openProduct({ url: part.text, message })
              }
            }}
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

// 지운 메시지의 자리(DEC-54). 본문과 사진은 서버가 주지 않는다. 내 것이든 남의 것이든 같은 옅은 말풍선이라
// 파란 내 말풍선처럼 강조되어 읽히지 않는다(카카오톡·Slack의 '삭제된 메시지' 자리).
function Deleted() {
  return (
    <p className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm/6 text-gray-500">
      {DELETED_MESSAGE}
    </p>
  )
}

// 말풍선 위의 보낸 사람. 남의 첫 메시지에만 보이고, 내 메시지는 이름 없이 '나'로 읽힌다(카카오톡).
// 같은 사람이 바로 이어 쓴 메시지는 이름을 다시 보이지 않는다.
function Sender({ message, mine, continued }: Pick<Props, 'message' | 'mine' | 'continued'>) {
  if (mine) return <span className="sr-only">나</span>
  if (continued) return null
  return <span className="text-xs wrap-anywhere text-gray-500">{message.senderName}</span>
}

// 말풍선 아래의 시각(와이어프레임). 이어 쓴 메시지는 화면 낭독기에만 읽힌다.
function Time({ message, continued }: Pick<Props, 'message' | 'continued'>) {
  return (
    <time dateTime={message.sentAt} className={continued ? 'sr-only' : 'text-xs text-gray-500'}>
      {clockLabel(message.sentAt)}
    </time>
  )
}

// 남의 메시지 왼쪽의 얼굴(와이어프레임): 흰 원에 이름 첫 글자. 탈퇴한 사람('떠난 운영진 N')은 첫 글자가 '떠'라
// 사람처럼 읽히지 않으므로 사람 아이콘이다. 이어 쓴 메시지는 같은 폭만 비워 말풍선 줄을 맞춘다. 이름은 바로 위에 있어 꾸밈이다.
function Face({ message, mine, continued }: Pick<Props, 'message' | 'mine' | 'continued'>) {
  if (mine) return null
  if (continued) return <span aria-hidden className="w-8 shrink-0" />
  const name = message.senderName ?? ''
  if (isLeftMemberName(name)) return <Avatar className="size-8" />
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-xs font-bold text-gray-500"
    >
      {Array.from(name)[0]}
    </span>
  )
}

// 보낸 사람 없는 글(행사 알림, DEC-90·DEC-93). 와이어프레임 MSG-03 03의 시스템 글처럼 가운데 정렬한 작은 회색 글이고
// 끼룩이 그림·이름·말풍선·메뉴가 없다. 알림은 VADA가 해 준 일이 아니라 끼룩이가 말하지 않는다(Slack·카카오톡의 시스템 줄).
// 시각은 와이어프레임처럼 보이지 않고 화면 낭독기에만 읽힌다.
// relative: 숨긴 낭독용 글(sr-only)이 스크롤 칸 밖으로 나가 바깥 스크롤바를 만들지 않게 한다.
function SystemItem({ message }: Pick<Props, 'message'>) {
  return (
    <li className="relative mt-2 px-2 py-1">
      <p className="text-center text-xs/5 wrap-anywhere whitespace-pre-wrap text-gray-500">
        {message.body}
      </p>
      <time dateTime={message.sentAt} className="sr-only">
        {clockLabel(message.sentAt)}
      </time>
    </li>
  )
}

// 메시지 하나: 보낸 사람이 있으면 사람의 글, 없으면 시스템 글이다.
export default function MessageItem(props: Props) {
  return props.message.senderId === null ? (
    <SystemItem message={props.message} />
  ) : (
    <PersonItem {...props} />
  )
}

// 사람의 글(와이어프레임 메시지 화면): 내 메시지는 오른쪽 파란 말풍선, 남의 메시지는 왼쪽에 얼굴과 이름, 흰 말풍선.
// 말풍선 묶음은 줄의 60%까지다(와이어프레임). 휴대폰은 칸이 좁아 80%다(사이드챗의 85%와 비슷하게). 얼굴과 '…'는 묶음의 아래에 맞춘다. '…'는 마우스로 쓰면 올리거나
// 포커스할 때만, 손가락으로 쓰면 늘 보인다(Slack·Teams, NN/g 문맥 메뉴 지침).
function PersonItem({ councilId, message: original, continued, mine, ...actionArgs }: Props) {
  const [deletedActions, setDeletedActions] = useState<ChatMessage['actions'] | null>(null)
  const message =
    deletedActions !== null
      ? { ...original, body: null, photos: [], actions: deletedActions }
      : original
  const photos = message.photos
  const { actions } = useMessageActions({ councilId, message, ...actionArgs })
  return (
    <li
      className={cn(
        // relative: 숨긴 낭독용 글(sr-only)이 스크롤 칸 밖으로 나가 바깥 스크롤바를 만들지 않게 한다.
        'group relative flex items-end gap-2 rounded-sm px-2',
        continued ? 'py-0.5' : 'mt-2 pt-1.5 pb-0.5',
        mine && 'flex-row-reverse',
      )}
    >
      <Face message={message} mine={mine} continued={continued} />
      <div
        className={cn(
          'flex max-w-3/5 min-w-0 flex-col gap-1 max-sm:max-w-4/5',
          mine ? 'items-end' : 'items-start',
        )}
      >
        <Sender message={message} mine={mine} continued={continued} />
        {message.body === null ? (
          <Deleted />
        ) : (
          message.body !== '' && <Body message={message} mine={mine} />
        )}
        {photos.length > 0 && <MessagePhotos councilId={councilId} photos={photos} />}
        <MessageMade councilId={councilId} records={message.made ?? []} />
        <Time message={message} continued={continued} />
      </div>
      <div className="pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100 pointer-fine:has-data-[state=open]:opacity-100">
        <MessageMenu
          actions={actions}
          councilId={councilId}
          message={message}
          onDeleted={deleted => setDeletedActions(deleted.actions)}
        />
      </div>
    </li>
  )
}
