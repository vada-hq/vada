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

// 본문. 줄바꿈은 그대로 두고, 주소는 새 탭에서 여는 링크다(쓰던 입력과 흐름을 잃지 않게, NN/g 새 탭 지침).
// 내 메시지는 옅은 회색 말풍선에 담는다. 오른쪽 정렬만으로는 두 줄이 넘는 글이 한 덩어리로 읽히지 않는다(Teams, iMessage).
function Body({ body, mine }: { body: string; mine: boolean }) {
  return (
    <p
      className={cn(
        'text-sm/6 wrap-anywhere whitespace-pre-wrap text-gray-900',
        mine && 'rounded-2xl rounded-tr-sm bg-gray-100 px-3 py-1.5',
      )}
    >
      {bodyParts(body).map((part, index) =>
        part.kind === 'link' ? (
          <a
            key={index}
            href={part.text}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 underline underline-offset-2"
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

function Header({ message }: Pick<Props, 'message'>) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
      <span className="font-medium wrap-anywhere text-gray-700">
        {message.senderName ?? '시스템'}
      </span>
      <time dateTime={message.sentAt}>{clockLabel(message.sentAt)}</time>
    </p>
  )
}

// 머리: 남의 첫 메시지는 이름·시각. 이어 쓴 메시지와 내 메시지는 화면 낭독기에만 읽힌다.
// 내 메시지는 이름 없이 '나'로 읽히고(카카오톡), 시각은 본문 옆에 둔다.
function Head({ message, mine, continued }: Pick<Props, 'message' | 'mine' | 'continued'>) {
  if (!mine && !continued) return <Header message={message} />
  return mine ? (
    <span className="sr-only">나</span>
  ) : (
    <time dateTime={message.sentAt} className="sr-only">
      {clockLabel(message.sentAt)}
    </time>
  )
}

// 내 메시지의 시각: 본문 왼쪽 아래(카카오톡). 이어 쓴 메시지는 화면 낭독기에만 읽힌다.
function MineTime({ message, continued }: Pick<Props, 'message' | 'continued'>) {
  return (
    <time
      dateTime={message.sentAt}
      className={continued ? 'sr-only' : 'shrink-0 self-end pb-1 text-xs text-gray-400'}
    >
      {clockLabel(message.sentAt)}
    </time>
  )
}

// 메시지 하나: 보낸 사람, 시각, 본문. 내 메시지는 오른쪽에 붙여 가른다(카카오톡, Teams 채팅).
// 색으로 가르지 않는다. 파란색은 공지와 새 소식에 쓰여 내 메시지가 강조처럼 읽힌다. 말풍선은 옅은 회색이다.
// '…'는 마우스로 쓰면 올리거나 포커스할 때만, 손가락으로 쓰면 늘 보인다(Slack·Teams, NN/g 문맥 메뉴 지침).
export default function MessageItem({ councilId, message, continued, mine, ...actionArgs }: Props) {
  const photos = message.photos
  const { actions } = useMessageActions({ message, ...actionArgs })
  return (
    <li
      className={cn(
        // relative: 숨긴 낭독용 글(sr-only)이 스크롤 칸 밖으로 나가 바깥 스크롤바를 만들지 않게 한다.
        'group relative flex flex-wrap items-start gap-x-2 gap-y-1 rounded-sm px-2',
        continued ? 'py-0.5' : 'mt-2 pt-1.5 pb-0.5',
        mine && 'flex-row-reverse',
      )}
    >
      {/* 시각을 본문 묶음 안에 둬야 '…' 단추 높이가 아니라 본문 아래에 맞춘다. */}
      <div className={cn('flex min-w-0 gap-2', mine ? 'flex-row-reverse items-end' : 'flex-1')}>
        <div className={cn('flex min-w-0 flex-col gap-1', mine ? 'max-w-xl items-end' : 'flex-1')}>
          <Head message={message} mine={mine} continued={continued} />
          {message.body !== '' && <Body body={message.body} mine={mine} />}
          {photos.length > 0 && <MessagePhotos councilId={councilId} photos={photos} />}
        </div>
        {mine && <MineTime message={message} continued={continued} />}
      </div>
      <div className="pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100 pointer-fine:has-data-[state=open]:opacity-100">
        <MessageMenu actions={actions} busy={false} />
      </div>
    </li>
  )
}
