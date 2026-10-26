import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { REPLIES_LOAD_FAILED, REPLIES_LOST, REPLIES_SYNC_FAILED, SEND_ERRORS } from '@/lib/messages'
import { useNow } from '@/lib/use-now'
import type { RoomPage } from './ChatPage'
import Composer from './Composer'
import MessageItem from './MessageItem'
import { flowOf } from './message-flow'
import { ARCHIVED_LABEL } from './chat-view'
import { useMessageFlows } from './MessageFlows'
import { ProductOpenContext, useEventProductOpener } from './product-open'
import { ProductPanelFrame } from './ProductPanel'
import type { ReplyTarget } from './reply-open'
import type { ReplyState } from './reply-state'
import { Flow, Older } from './FlowList'
import type { MessageActionSet } from './useMessageActions'
import { useReadMarker } from './useReadMarker'
import { useReplies } from './useReplies'
import { useStickToBottom } from './useStickToBottom'

type Props = { page: RoomPage; target: ReplyTarget }
type Ready = Extract<ReplyState, { kind: 'ready' }>

// 원글과 답글 사이의 줄: '답글 {n}'(서버가 준 수 그대로, 지운 답글도 센다). 답글이 없으면 '답글 없음'이다.
function ReplyCount({ count }: { count: number }) {
  return (
    <li className="flex items-center gap-2 py-2 text-xs font-medium text-gray-500">
      {count === 0 ? '답글 없음' : `답글 ${count}`}
      <span className="h-px flex-1 bg-gray-200" aria-hidden />
    </li>
  )
}

// 원글(맨 위), 답글 수 줄, 답글 흐름. 답글은 보낸 순이고, 원글을 보는 화면이라 새 답글이 오면 아래에 붙는다.
// 부품 확인 화면도 이 모습을 그대로 쓴다.
export function ReplyThread({
  councilId,
  meId,
  state,
  menu,
  onOlder,
}: {
  councilId: string
  meId: string
  state: Omit<Ready, 'kind'>
  menu: MessageActionSet
  onOlder: () => Promise<boolean>
}) {
  const now = useNow()
  const { original, replies } = state
  const last = replies.at(-1)
  const { ref, onScroll } = useStickToBottom(last?.id, last?.senderId === meId)
  return (
    <div ref={ref} onScroll={onScroll} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <ul className="flex flex-col">
        <MessageItem
          councilId={councilId}
          message={original}
          continued={false}
          mine={original.senderId === meId}
          {...menu}
        />
        <ReplyCount count={original.replyCount} />
      </ul>
      {state.hasOlder && <Older onLoad={onOlder} label="이전 답글 보기" />}
      <Flow
        items={flowOf(replies, now, null)}
        councilId={councilId}
        meId={meId}
        menu={menu}
        className=""
      />
      {state.syncFailed && <StateMessage kind="error">{REPLIES_SYNC_FAILED}</StateMessage>}
    </div>
  )
}

// 답글 입력칸. 보기만 되는 방(상대가 떠난 1:1, 완료한 행사의 방)의 원글은 답글을 읽기만 한다(DEC-90 보관).
function ReplyComposer({
  page,
  target,
  onSent,
  onLost,
}: Props & { onSent: () => void; onLost: () => void }) {
  if (target.readOnly)
    return (
      <StateMessage kind="notice">
        {target.eventId ? ARCHIVED_LABEL : SEND_ERRORS.ROOM_READ_ONLY}
      </StateMessage>
    )
  return (
    <div className="shrink-0 bg-white">
      <Composer
        councilId={page.councilId}
        roomId={target.roomId}
        replyTo={target.messageId}
        participants={target.participants}
        meId={page.view.me.memberId}
        onSent={onSent}
        onLost={onLost}
      />
    </div>
  )
}

// 패널 내용: 원글과 답글, 답글 입력칸. 메시지 메뉴(구매 요청·지출)는 방 흐름과 같고 '답글'만 없다(한 단계, DEC-90).
// 마지막 답글까지 읽음을 보낸다(방 단위 읽음이라 방의 안 읽은 수가 준다, 022 정한 것 32).
function ReplyContent({ page, target }: Props) {
  const { councilId, view } = page
  const requestEvent = target.readOnly ? null : target.eventId
  const replies = useReplies(
    { councilId, roomId: target.roomId, messageId: target.messageId },
    target.onOriginal,
  )
  const { state } = replies
  const flows = useMessageFlows({
    councilId,
    meId: view.me.memberId,
    request: {
      canRequest: view.permissions.includes('purchase.request'),
      canAssign: view.permissions.includes('finance.manage'),
      team: page.team.data,
      onOpenRequest: page.onOpenRequest,
    },
    canWriteExpense: view.permissions.includes('finance.manage'),
    onForbidden: page.onForbidden,
    onMade: replies.markMade,
    // 보관된 행사 방에서는 새 요청을 그 행사로 시작하지 않는다(방 흐름과 같다).
    eventId: requestEvent,
  })
  const productOpener = useEventProductOpener(requestEvent)
  const lastId =
    state.kind === 'ready' ? (state.replies.at(-1)?.id ?? state.original.id) : undefined
  useReadMarker({ councilId, roomId: target.roomId }, lastId, {
    onRead: () => void page.rooms.reload(),
    onLost: replies.lose,
  })
  if (state.kind === 'loading') return <StateMessage kind="loading">답글 불러오는 중…</StateMessage>
  if (state.kind === 'lost') return <StateMessage kind="notice">{REPLIES_LOST}</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col gap-3">
        <StateMessage kind="error">{REPLIES_LOAD_FAILED}</StateMessage>
        <Button variant="outline" className="self-start" onClick={() => void replies.retry()}>
          다시 시도
        </Button>
      </div>
    )
  return (
    <>
      {flows.views}
      <ProductOpenContext value={productOpener}>
        <ReplyThread
          councilId={councilId}
          meId={view.me.memberId}
          state={state}
          menu={flows.menu}
          onOlder={replies.loadOlder}
        />
      </ProductOpenContext>
      <ReplyComposer
        page={page}
        target={target}
        onSent={() => {
          void replies.sync()
          void page.rooms.reload()
        }}
        onLost={replies.lose}
      />
    </>
  )
}

// 답글 패널(022 조각 11, DEC-90): 상품 정보 패널과 같은 오른쪽 자리·틀이고 제목은 '답글'이다.
// PC는 오른쪽, 휴대폰은 전체 화면이다. 다른 원글을 열면 내용만 그 원글로 바뀐다.
export default function ReplyPanel({ onClose, ...props }: Props & { onClose: () => void }) {
  const key = `${props.target.roomId} ${props.target.messageId}`
  return (
    <ProductPanelFrame title="답글" focusKey={key} onClose={onClose}>
      <ReplyContent key={key} {...props} />
    </ProductPanelFrame>
  )
}
