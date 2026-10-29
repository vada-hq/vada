import type { ChatMessage } from '@vada/contracts'
import { useState } from 'react'
import { switchName } from '@/chat/chat-view'
import Composer from '@/chat/Composer'
import { MessageHomeHeader } from '@/chat/MessageHome'
import MessageItem from '@/chat/MessageItem'
import RoomRow from '@/chat/RoomRow'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Section } from './GallerySection'
import { chatRoom, DIRECT_ID, ROOMS } from './chat-samples'
import { longName, unbroken } from './sample-text'
import SideChatListView from '@/chat/SideChatListView'
import SideChatRoomTitle from '@/chat/SideChatRoomTitle'
import { SideChatContext } from '@/chat/SideChatContext'
import { useSplit } from '@/lib/use-split'

const noop = () => {}
const now = new Date('2026-10-23T05:00:00.000Z')
const HOME_PREVIEW_COUNT = 2
// 학생회 방 탭과 흐름(US-MSG-01). 방과 입력 띠는 행사 메시지 탭과 같은 부품이다.
function MessageHomeSample() {
  const split = useSplit()
  const rooms = ROOMS.filter(room => room.type !== 'direct')
  const [activeId, setActiveId] = useState('plan')
  const active = rooms.find(room => room.id === activeId)
  return (
    <div className="flex w-full flex-col overflow-hidden rounded-lg border">
      <MessageHomeHeader
        rooms={rooms}
        active={active}
        onPick={setActiveId}
        onAll={noop}
        elsewhereUnread={3}
        direct={!split ? { active: false, unread: 2, onPick: noop } : undefined}
      />
      <div className="flex h-96 flex-col bg-surface-subtle">
        <ul className="mt-auto flex flex-col overflow-y-auto px-2 py-3 sm:px-4">
          {FLOW.slice(1, 1 + HOME_PREVIEW_COUNT).map(item => (
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
        <div className="shrink-0 border-t bg-white px-4 py-3 sm:px-6">
          <Composer
            councilId="sample"
            roomId={activeId}
            roomName={active ? switchName(active) : '공지방'}
            participants={[]}
            meId="sample"
            onSent={noop}
            onLost={noop}
          />
        </div>
      </div>
    </div>
  )
}

// MSG-04 목록과 열린 칸. 새 이름·머리·보내기 글은 실제 부품으로 확인한다.
function SideChatSample() {
  const [opened, setOpened] = useState(false)
  const direct = chatRoom(DIRECT_ID, { type: 'direct', name: '정하늘', unread: 2 })
  const access = {
    meId: 'sample',
    canDirect: true,
    busy: false,
    members: [],
    open: () => {
      setOpened(true)
      return Promise.resolve(true)
    },
  }
  return (
    <SideChatContext value={access}>
      <div className="h-128 w-96 max-w-full border-l-2 border-personal-border-strong bg-personal-surface/60">
        {opened ? (
          <div className="flex h-full flex-col">
            <SideChatRoomTitle
              name="정하늘"
              readOnly={false}
              side
              direct
              onBack={() => setOpened(false)}
            />
            <ul className="mt-auto overflow-y-auto px-2 py-3">
              <MessageItem
                councilId="sample"
                message={FLOW[1]!.message}
                mine={false}
                continued={false}
                canRequest={false}
                onRequest={noop}
                canWriteExpense={false}
                onWriteExpense={noop}
              />
            </ul>
            <div className="border-t bg-white p-4">
              <Composer
                councilId="sample"
                roomId={DIRECT_ID}
                roomName="정하늘"
                direct
                participants={[]}
                meId="sample"
                onSent={noop}
                onLost={noop}
              />
            </div>
          </div>
        ) : (
          <SideChatListView
            canDirect
            state={{
              kind: 'ready',
              data: {
                rooms: [direct, ...ROOMS.filter(room => room.type === 'direct')],
                unreadTotal: 2,
                mentionTotal: 0,
              },
            }}
            now={now}
            note={null}
            onStart={() => setOpened(true)}
            onOpen={() => setOpened(true)}
          />
        )}
      </div>
    </SideChatContext>
  )
}

// 전체 목록 줄(MSG-01)은 한 칸 본문과 휴대폰 폭으로 그린다.
export function RoomRowSection() {
  return (
    <Section title="대화 목록 줄">
      <MessageHomeSample />
      <SideChatSample />
      {/* 휴대폰은 1:1을 전체 화면으로 연다. 머리는 PC 오른쪽 칸과 같은 호박색이다(MSG-04). */}
      <div className={cn(cardClass, 'w-97.5 overflow-hidden')}>
        <SideChatRoomTitle name="정하늘" readOnly={false} side={false} direct onBack={noop} />
      </div>
      {['w-full', 'w-97.5'].map(width => (
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
  editedAt: null,
  photos: [],
  actions: senderName === '박해랑' ? ['message.delete', 'message.edit'] : [],
  made: [],
})
// 지운 메시지(DEC-54): 본문 없이 지운 시각만 있다.
const deletedMessage = (id: string, senderName: string): ChatMessage => ({
  ...chatMessage(id, senderName, ''),
  body: null,
  deletedAt: '2026-10-23T02:00:00Z',
  actions: [],
})

// 시스템 글, 남의 첫 메시지와 이어 쓴 것, 탈퇴한 사람(사람 아이콘), 지운 메시지(남의 것, 내 것), 내 메시지(링크·긴 주소)와 이어 쓴 것.
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
  {
    message: { ...chatMessage('d', '박해랑', longName), editedAt: '2026-10-23T02:00:00Z' },
    mine: true,
    continued: true,
  },
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
