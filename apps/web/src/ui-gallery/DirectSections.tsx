import { useMemo, useState } from 'react'
import type { ChatMessage, RoomParticipant } from '@vada/contracts'
import Composer from '@/chat/Composer'
import { keepDraft } from '@/chat/composer-drafts'
import { DirectOpenContext, type DirectOpener, type DirectPerson } from '@/chat/direct-open'
import { DirectPanelFrame } from '@/chat/DirectPanel'
import MessageItem from '@/chat/MessageItem'
import { Button } from '@/components/ui/button'
import { Section } from './GallerySection'
import { longName } from './sample-text'

const noop = () => {}
const LONG_NAME_LENGTH = 24
const ME = 'g-me'
// 패널 머리에서 접히는 긴 이름
const LONG_PERSON_NAME = longName.slice(0, LONG_NAME_LENGTH)
const PEOPLE: DirectPerson[] = [
  { id: ME, name: '박해랑' },
  { id: 'g-ha', name: '정하늘' },
  { id: 'g-min', name: '김민준' },
  { id: 'g-long', name: LONG_PERSON_NAME },
]
const PARTICIPANTS: RoomParticipant[] = PEOPLE.map(person => ({
  memberId: person.id,
  name: person.name,
}))

const sample = (id: string, sender: DirectPerson | null, body: string): ChatMessage => ({
  id,
  senderId: sender?.id ?? null,
  senderName: sender?.name ?? null,
  body,
  sentAt: '2026-10-23T00:30:00Z',
  deletedAt: null,
  photos: [],
  made: [],
})
const MAIN: ChatMessage[] = [
  sample('g1', PEOPLE[1]!, '부스 배치안 초안 올렸어요. 테이블 수는 아직 미정이에요.'),
  sample('g2', { id: 'g-gone', name: '떠난 운영진 2' }, '작년 배치안은 드라이브에 있어요.'),
  sample('g3', PEOPLE[0]!, '확인할게요. 오늘 안에 확정합시다.'),
]
const directThread = (person: DirectPerson): ChatMessage[] => [
  sample(`${person.id}-1`, person, '테이블 몇 개 빌려요?'),
  sample(`${person.id}-2`, PEOPLE[0]!, '8개요. 대여처 견적은 내일 받아요.'),
]

function Flow({ messages }: { messages: ChatMessage[] }) {
  return (
    <ul className="mt-auto flex flex-col">
      {messages.map(item => (
        <MessageItem
          key={item.id}
          councilId="sample"
          message={item}
          continued={false}
          mine={item.senderId === ME}
          canRequest={false}
          onRequest={noop}
          canWriteExpense={false}
          onWriteExpense={noop}
        />
      ))}
    </ul>
  )
}

// 연 사람의 1:1 패널. 실제 방 읽기 대신 견본 대화와 입력칸을 넣는다.
function SamplePanel({ person, onClose }: { person: DirectPerson; onClose: () => void }) {
  return (
    <DirectPanelFrame name={person.name} onClose={onClose}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        <Flow messages={directThread(person)} />
      </div>
      <Composer
        key={person.id}
        councilId="sample"
        roomId={`direct-${person.id}`}
        participants={PARTICIPANTS}
        meId={ME}
        sendLabel={`${person.name}에게 보내기`}
        onSent={noop}
        onLost={noop}
      />
    </DirectPanelFrame>
  )
}

// 1:1 패널(022 조각 7, 와이어프레임 MSG-04): 보낸 사람 이름을 누르거나 입력칸 '/'로 고르면 오른쪽(1280px 이상은 본문 옆, 768~1279px은 겹쳐,
// 휴대폰은 전체 화면)에 그 사람과의 1:1이 열린다. 입력칸은 '/정'을 친 이름 고르기 목록 상태로 시작한다. 떠난 사람과 나는 누를 수 없다.
export function DirectPanelSection() {
  const [open, setOpen] = useState<DirectPerson | null>(null)
  useState(() => keepDraft(ME, 'sample', 'main', { body: '/정', picks: [] }))
  const opener = useMemo<DirectOpener>(
    () => ({ meId: ME, people: PEOPLE, open: person => setOpen(person) }),
    [],
  )
  return (
    <Section title="1:1 패널">
      <DirectOpenContext value={opener}>
        <Button variant="outline" onClick={() => setOpen(PEOPLE[1]!)}>
          1:1 패널 열기
        </Button>
        <div className="flex h-160 w-full overflow-hidden rounded-lg border bg-white">
          <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
            <h3 className="text-base font-semibold text-gray-900">기획부 방</h3>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <Flow messages={MAIN} />
            </div>
            <Composer
              councilId="sample"
              roomId="main"
              participants={PARTICIPANTS}
              meId={ME}
              onSent={noop}
              onLost={noop}
            />
          </div>
          {open && <SamplePanel person={open} onClose={() => setOpen(null)} />}
        </div>
      </DirectOpenContext>
    </Section>
  )
}
