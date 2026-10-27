import type { ChatMessage, RoomSummary } from '@vada/contracts'
import MessageItem from '@/chat/MessageItem'
import RoomRow from '@/chat/RoomRow'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Section } from './GallerySection'
import { longName, unbroken } from './sample-text'

const noop = () => {}
const now = new Date('2026-10-23T05:00:00.000Z')

const chatRoom = (id: string, extra: Partial<RoomSummary>): RoomSummary => ({
  id,
  type: 'all_members',
  name: null,
  departmentId: null,
  readOnly: false,
  unread: 0,
  mentions: 0,
  lastMessageAt: '2026-10-23T03:00:00.000Z',
  lastMessage: null,
  memberCount: 3,
  ...extra,
})

const ROOMS = [
  chatRoom('all', {
    unread: 12,
    mentions: 1,
    memberCount: 24,
    lastMessage: { senderName: '김바다', preview: `이번 주 정기 회의는 목요일 18:00 ${longName}` },
  }),
  chatRoom('lead', { type: 'leadership', lastMessageAt: null, memberCount: 2 }),
  chatRoom('plan', {
    type: 'department',
    name: '기획부',
    departmentId: 'd1',
    unread: 120,
    lastMessage: { senderName: '박해랑', preview: unbroken },
  }),
  chatRoom('photo', {
    type: 'department',
    name: unbroken,
    departmentId: 'd2',
    lastMessageAt: '2026-10-20T03:00:00.000Z',
    lastMessage: { senderName: '정하늘', preview: '사진' },
  }),
  chatRoom('gone', {
    type: 'direct',
    name: '떠난 운영진 2',
    readOnly: true,
    memberCount: 2,
    lastMessage: { senderName: '떠난 운영진 2', preview: '그동안 고마웠어요' },
  }),
]

// 대화 목록 줄(와이어프레임 MSG-01). PC 두 칸의 목록 폭(256px)과 휴대폰 폭(390px)으로 그린다.
export function RoomRowSection() {
  return (
    <Section title="대화 목록 줄">
      {['w-64', 'w-97.5'].map(width => (
        <ul key={width} aria-label={`대화방 ${width}`} className={cn(cardClass, 'divide-y', width)}>
          {ROOMS.map((room, index) => (
            <RoomRow key={room.id} room={room} now={now} active={index === 0} onOpen={noop} />
          ))}
        </ul>
      ))}
    </Section>
  )
}

const chatMessage = (id: string, senderName: string | null, body: string): ChatMessage => ({
  id,
  senderId: senderName,
  senderName,
  body,
  sentAt: '2026-10-23T01:30:00Z',
  deletedAt: null,
  photos: [],
  made: [],
})
// 지운 메시지(DEC-54): 본문 없이 지운 시각만 있다.
const deletedMessage = (id: string, senderName: string): ChatMessage => ({
  ...chatMessage(id, senderName, ''),
  body: null,
  deletedAt: '2026-10-23T02:00:00Z',
})

// 끼룩이 글, 남의 첫 메시지와 이어 쓴 것, 탈퇴한 사람(사람 아이콘), 지운 메시지(남의 것, 내 것), 내 메시지(링크·긴 주소)와 이어 쓴 것.
const FLOW: { message: ChatMessage; mine: boolean; continued: boolean }[] = [
  { message: chatMessage('k', null, '가을 축제가 생겼어요'), mine: false, continued: false },
  {
    message: chatMessage('a', '정하늘', '진행 요원 6명이 입을 조끼가 필요해요'),
    mine: false,
    continued: false,
  },
  {
    message: chatMessage('b', '정하늘', `이걸로 어때요? ${unbroken}`),
    mine: false,
    continued: true,
  },
  {
    message: chatMessage('g', '떠난 운영진 2', '조끼는 작년 것이 창고에 있어요'),
    mine: false,
    continued: false,
  },
  { message: deletedMessage('x', '정하늘'), mine: false, continued: false },
  { message: deletedMessage('y', '박해랑'), mine: true, continued: false },
  {
    message: chatMessage(
      'c',
      '박해랑',
      '좋아요. 다이소몰 것도 봐 주세요\nhttps://www.daisomall.co.kr/goods/1002345',
    ),
    mine: true,
    continued: false,
  },
  { message: chatMessage('d', '박해랑', longName), mine: true, continued: true },
]

// 메시지 말풍선(와이어프레임 메시지 화면). 휴대폰 폭(390px)과 PC 방 칸 폭(약 700px)으로 그린다.
export function MessageBubbleSection() {
  return (
    <Section title="메시지 말풍선">
      {['w-97.5', 'w-176'].map(width => (
        <ul
          key={width}
          aria-label={`메시지 ${width}`}
          className={cn('rounded-lg border bg-white py-2', width)}
        >
          {FLOW.map(item => (
            <MessageItem
              key={item.message.id}
              councilId="sample"
              message={item.message}
              continued={item.continued}
              mine={item.mine}
              canRequest
              onRequest={noop}
              canWriteExpense={false}
              onWriteExpense={noop}
            />
          ))}
        </ul>
      ))}
    </Section>
  )
}

// 같은 원문에 구매 요청과 지출이 함께 연결된 경우, 반려·취소 이력과 긴 제목을 함께 확인한다.
export function MessageMadeSection() {
  const message = {
    ...chatMessage('made', '정하늘', '행사 물품 부탁해요'),
    made: [
      { kind: 'purchase_request' as const, id: 'p1', title: longName, blocking: false },
      { kind: 'purchase_request' as const, id: 'p2', title: '진행 요원 조끼', blocking: true },
      { kind: 'expense' as const, id: 'e1', title: '조끼 구입비', blocking: true },
    ],
  }
  return (
    <Section title="메시지에서 만든 기록">
      {['w-97.5', 'w-176'].map(width => (
        <ul key={width} className={cn('rounded-lg border bg-white py-2', width)}>
          <MessageItem
            councilId="sample"
            message={message}
            continued={false}
            mine={false}
            canRequest
            onRequest={noop}
            canWriteExpense
            onWriteExpense={noop}
          />
        </ul>
      ))}
    </Section>
  )
}
