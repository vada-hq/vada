import type { ChatMessage, RoomListResponse, RoomSummary } from '@vada/contracts'
import { ARCHIVED_LABEL, switchName } from '@/chat/chat-view'
import Composer from '@/chat/Composer'
import MessageItem from '@/chat/MessageItem'
import RoomList from '@/chat/RoomList'
import RoomSwitch from '@/chat/RoomSwitch'
import { unreadSum } from '@/chat/space-rooms'
import StateMessage from '@/components/StateMessage'
import { CountBadge } from '@/components/ui/count-badge'
import { TabButton } from '@/components/ui/tab-button'
import { EventHeader } from '@/events/EventHeader'
import { detail, headerHandlers } from './EventSections'
import { Section } from './GallerySection'
import { longName } from './sample-text'

const noop = () => {}
const ME = 'g-me'
// 휴대폰 폭에서 방 전환이 줄을 바꾸는 긴 부서 이름과, 99+로 줄어드는 안 읽은 수
const LONG_DEPT_LENGTH = 30
const MANY_UNREAD = 120
const EVENT = { eventId: 'e1', eventName: '2026 소프트웨어융합대학 체육대회' }

const room = (id: string, extra: Partial<RoomSummary>): RoomSummary => ({
  id,
  type: 'all_members',
  name: null,
  departmentId: null,
  readOnly: false,
  unread: 0,
  mentions: 0,
  lastMessageAt: '2026-10-23T03:00:00.000Z',
  lastMessage: null,
  memberCount: 24,
  ...EVENT,
  ...extra,
})
const notice = (extra: Partial<RoomSummary> = {}) => room('n', { unread: 2, ...extra })
const dept = (id: string, name: string, extra: Partial<RoomSummary> = {}) =>
  room(id, { type: 'department', name, departmentId: id, memberCount: 6, ...extra })

const sample = (id: string, sender: string, body: string): ChatMessage => ({
  id,
  senderId: sender === '박해랑' ? ME : sender,
  senderName: sender,
  body,
  sentAt: '2026-10-23T00:30:00Z',
  deletedAt: null,
  editedAt: null,
  photos: [],
  actions: sender === '박해랑' ? ['message.delete', 'message.edit'] : [],
  made: [],
})
const FLOW = [
  sample(
    'm1',
    '이수현',
    '체육대회 종목 확정본 문서 탭에 올렸어요. 피구·계주·줄다리기 세 종목입니다.',
  ),
  sample('m2', '박해랑', '운영부는 종목별 진행 요원 6명 배치할게요.'),
  sample('m3', '김민준', '상품 구매 요청은 이번 주 금요일까지 올려 주세요.'),
]

// 행사 탭 줄: 메시지가 맨 앞이고 그 옆 배지는 행사 방들의 안 읽은 수 합이다(EventDetailView와 같은 모양).
function Tabs({ unread }: { unread: number }) {
  return (
    <div role="tablist" aria-label="행사 보기" className="flex border-b">
      {['메시지', '개요', '업무', '회의', '구매', '인원 관리'].map((label, index) => (
        <TabButton key={label} aria-selected={index === 0} className="gap-1.5 max-sm:px-2.5">
          {label}
          {index === 0 && <CountBadge count={unread} label={`안 읽은 메시지 ${unread}개`} />}
        </TabButton>
      ))}
    </div>
  )
}

function Flow() {
  return (
    <ul className="mt-auto flex flex-col">
      {FLOW.map(item => (
        <MessageItem
          key={item.id}
          councilId="sample"
          message={item}
          continued={false}
          mine={item.senderId === ME}
          canRequest
          onRequest={noop}
          canWriteExpense={false}
          onWriteExpense={noop}
        />
      ))}
    </ul>
  )
}

type Sample = { key: string; rooms: RoomSummary[]; active: string; archived: boolean }
const SAMPLES: Sample[] = [
  {
    key: '열린 행사: 내 부서방이 먼저, 방마다 안 읽은 배지',
    rooms: [notice(), dept('plan', '기획부', { unread: 3 }), dept('ops', '운영부')],
    active: 'plan',
    archived: false,
  },
  {
    key: '완료된 행사: 읽기만, 입력칸 자리에 완료된 행사',
    rooms: [notice({ readOnly: true, unread: 0 }), dept('plan', '기획부', { readOnly: true })],
    active: 'plan',
    archived: true,
  },
  {
    key: '부서가 없는 회장단: 공지방만',
    rooms: [notice()],
    active: 'n',
    archived: false,
  },
  {
    key: '부서 이름이 길 때(휴대폰에서 줄을 바꾼다)',
    rooms: [
      notice(),
      dept('long', longName.slice(0, LONG_DEPT_LENGTH), { unread: MANY_UNREAD }),
      dept('plan', '기획부'),
    ],
    active: 'long',
    archived: false,
  },
]

function EventMessages({ sample: item }: { sample: Sample }) {
  const event = detail({
    name: EVENT.eventName,
    status: item.archived ? 'completed' : 'upcoming',
    departments: ['기획부'],
  })
  return (
    <div className="flex flex-col gap-3">
      <EventHeader
        event={event}
        tabs={<Tabs unread={unreadSum(item.rooms)} />}
        tabLabel="메시지"
        bar={<RoomSwitch rooms={item.rooms} activeId={item.active} onPick={noop} />}
        {...headerHandlers}
      />
      <div className="flex h-96 flex-col overflow-hidden rounded-lg border bg-gray-50">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-3 sm:px-4">
          <Flow />
        </div>
        <div className="shrink-0 border-t bg-white px-4 py-3 sm:px-6">
          {item.archived ? (
            <StateMessage kind="notice">{ARCHIVED_LABEL}</StateMessage>
          ) : (
            <Composer
              councilId="sample"
              roomId={item.active}
              roomName={switchName(item.rooms.find(room => room.id === item.active)!)}
              participants={[]}
              meId={ME}
              onSent={noop}
              onLost={noop}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// 행사 메시지 탭(022 조각 9, 와이어프레임 EVT-MSG-01): 탭 줄 맨 앞 '메시지', 요약 줄 대신 방 전환. 방 화면은 대화의 방 그대로다.
export function EventMessagesSection() {
  return (
    <Section title="행사 메시지 탭">
      <div className="flex w-full max-w-5xl flex-col gap-8">
        {SAMPLES.map(item => (
          <div key={item.key} className="flex flex-col gap-1">
            <p className="text-xs text-gray-500">{item.key}</p>
            <EventMessages sample={item} />
          </div>
        ))}
      </div>
    </Section>
  )
}

const LIST: RoomListResponse = {
  rooms: [
    room('all', { eventId: null, eventName: null, unread: 1 }),
    room('plan', { eventId: null, eventName: null, type: 'department', name: '기획부' }),
    notice({
      lastMessage: { senderName: '이수현', preview: '체육대회 종목 확정본 올렸어요.' },
    }),
    dept('e-plan', '기획부', { lastMessage: { senderName: '김민준', preview: '상품 목록 정리' } }),
    room('e2', {
      eventName: longName,
      unread: 0,
      lastMessage: { senderName: '박민수', preview: '장소는 대강당 우선으로 알아보고 있어요.' },
    }),
    room('d1', {
      eventId: null,
      eventName: null,
      type: 'direct',
      name: '정하늘',
      memberCount: 2,
      unread: 1,
    }),
  ],
  unreadTotal: 4,
  mentionTotal: 0,
}

// 1:1이 아직 없는 학생회: '1:1 대화' 묶음은 머리의 [+]와 빈 줄로 남는다(notes/chat-redesign 4a).
const NO_DIRECT: RoomListResponse = {
  ...LIST,
  rooms: LIST.rooms.filter(item => item.type !== 'direct'),
}

// 대화 목록의 '행사' 묶음(022 정한 것 27, 와이어프레임 MSG-01): 메시지가 생긴 행사 방이 행사 이름과 함께 학생회 방과 1:1 사이에 있다.
// '1:1 대화' 묶음 머리의 [+]가 1:1을 시작한다. 1:1이 없어도 묶음이 있다.
export function EventRoomListSection() {
  const samples = [
    { key: 'PC 한 칸 목록', width: 'w-full', data: LIST },
    { key: '휴대폰 폭', width: 'w-97.5', data: LIST },
    { key: '1:1 없음', width: 'w-full', data: NO_DIRECT },
  ]
  return (
    <Section title="대화 목록의 행사·1:1 묶음">
      {samples.map(sample => (
        <div key={sample.key} className={sample.width}>
          <RoomList
            data={sample.data}
            note={null}
            activeRoomId={null}
            canDirect
            onOpenRoom={noop}
            onDirect={noop}
          />
        </div>
      ))}
    </Section>
  )
}
