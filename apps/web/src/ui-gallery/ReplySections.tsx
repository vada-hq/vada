import { useState } from 'react'
import type { ChatMessage, RoomParticipant } from '@vada/contracts'
import { ARCHIVED_LABEL } from '@/chat/chat-view'
import Composer from '@/chat/Composer'
import MessageItem from '@/chat/MessageItem'
import { ProductPanelFrame } from '@/chat/ProductPanel'
import { ReplyThread } from '@/chat/ReplyPanel'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Section } from './GallerySection'

const noop = () => {}
const ME = 'g-me'
const PARTICIPANTS: RoomParticipant[] = [
  { memberId: ME, name: '박해랑' },
  { memberId: 'g-ha', name: '정하늘' },
  { memberId: 'g-min', name: '김민준' },
]

const sample = (id: string, body: string, options: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  senderId: 'g-ha',
  senderName: '정하늘',
  body,
  sentAt: '2026-10-23T00:30:00Z',
  deletedAt: null,
  photos: [],
  made: [],
  replyCount: 0,
  lastReplyAt: null,
  ...options,
})

// 공지방 흐름: 새 답글이 있는 공지(답글 3), 지난 답글만 있는 공지(답글 1), 답글 없는 글. 시각은 겉 모양 시험이 날마다 바뀌지 않게 고정한다.
const NOTICE = sample('r-notice', '축제 부스 배치 확정했어요. 각 부서 담당 구역 확인해 주세요.', {
  senderId: ME,
  senderName: '박해랑',
  replyCount: 3,
  lastReplyAt: '2026-10-23T01:20:00Z',
})
const OLD = sample('r-old', '다음 주 정기 회의는 수요일 18시예요.', {
  replyCount: 1,
  lastReplyAt: '2026-10-22T09:10:00Z',
})
const PLAIN = sample('r-plain', '회의록 드라이브에 올렸어요.', {
  senderId: 'g-min',
  senderName: '김민준',
})
const FLOW = [OLD, PLAIN, NOTICE]
const FRESH = new Set([NOTICE.id])

const REPLIES: Record<string, ChatMessage[]> = {
  [NOTICE.id]: [
    sample('r1', '기획부 구역이 입구 쪽 맞나요?', { sentAt: '2026-10-23T01:00:00Z' }),
    sample('r2', '네, 입구 왼쪽 세 칸이에요.', {
      senderId: ME,
      senderName: '박해랑',
      sentAt: '2026-10-23T01:05:00Z',
    }),
    sample('r3', '재정부는 테이블 몇 개 쓰나요?', {
      senderId: 'g-min',
      senderName: '김민준',
      sentAt: '2026-10-23T01:20:00Z',
    }),
  ],
  [OLD.id]: [
    sample('r4', '확인했어요.', {
      senderId: 'g-min',
      senderName: '김민준',
      sentAt: '2026-10-22T09:10:00Z',
    }),
  ],
  [PLAIN.id]: [],
}

type Open = { original: ChatMessage; readOnly: boolean }
const OPENERS: { label: string; open: Open }[] = [
  { label: '답글 있음', open: { original: NOTICE, readOnly: false } },
  { label: '답글 없음', open: { original: PLAIN, readOnly: false } },
  { label: '보관 방 읽기만', open: { original: OLD, readOnly: true } },
]
const menu = { canRequest: false, onRequest: noop, canWriteExpense: false, onWriteExpense: noop }

// 답글 패널 하나. 실제 답글 읽기 대신 견본 답글과 입력칸(보관 방은 읽기만 알림)을 넣는다.
function SamplePanel({ open, onClose }: { open: Open; onClose: () => void }) {
  const { original, readOnly } = open
  const replies = REPLIES[original.id] ?? []
  return (
    <ProductPanelFrame title="답글" focusKey={original.id} onClose={onClose}>
      <ReplyThread
        councilId="sample"
        meId={ME}
        state={{ original: { ...original, replyCount: replies.length }, replies, hasOlder: false }}
        menu={menu}
        onOlder={() => Promise.resolve(true)}
      />
      {readOnly ? (
        <StateMessage kind="notice">{ARCHIVED_LABEL}</StateMessage>
      ) : (
        <Composer
          key={original.id}
          councilId="sample"
          roomId="reply-sample"
          replyTo={original.id}
          participants={PARTICIPANTS}
          meId={ME}
          onSent={noop}
          onLost={noop}
        />
      )}
    </ProductPanelFrame>
  )
}

// 답글(022 조각 11, DEC-90): 와이어프레임에 없어 명세대로 그린다. 방 흐름의 원글 아래 '답글 {n}'·마지막 답글 시각·'새 답글',
// 메시지 위 [답글] 단추와 '…'의 '답글'. 누르면 상품 정보 패널과 같은 오른쪽 자리(휴대폰은 전체 화면)에 원글·답글·답글 입력칸이 열린다.
export function ReplyPanelSection() {
  const [open, setOpen] = useState<Open | null>(null)
  const onReply = (message: ChatMessage) =>
    setOpen({ original: message, readOnly: message.id === OLD.id })
  return (
    <Section title="답글 패널">
      {OPENERS.map(({ label, open: target }) => (
        <Button key={label} variant="outline" onClick={() => setOpen(target)}>
          {`답글 패널 열기 (${label})`}
        </Button>
      ))}
      <div className="flex h-160 w-full overflow-hidden rounded-lg border bg-white">
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <h3 className="text-base font-semibold text-gray-900">공지방</h3>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <ul className="mt-auto flex flex-col">
              {FLOW.map(item => (
                <MessageItem
                  key={item.id}
                  councilId="sample"
                  message={item}
                  continued={false}
                  mine={item.senderId === ME}
                  newReplies={FRESH.has(item.id)}
                  {...menu}
                  onReply={onReply}
                />
              ))}
            </ul>
          </div>
        </div>
        {open && <SamplePanel open={open} onClose={() => setOpen(null)} />}
      </div>
    </Section>
  )
}
