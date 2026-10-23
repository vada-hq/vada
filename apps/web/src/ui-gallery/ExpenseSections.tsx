import type { ChatPhotoListResponse, ExpenseSummary } from '@vada/contracts'
import { ChatPhotoPicker } from '@/finance/ChatPhotoPicker'
import ExpenseCard from '@/finance/ExpenseCard'
import type { useChatEvidence } from '@/finance/useChatEvidence'
import { Section } from './GallerySection'
import { longName, unbroken } from './sample-text'

const expense = (id: string, extra: Partial<ExpenseSummary>): ExpenseSummary => ({
  id,
  vendor: '인쇄소',
  description: '포스터 인쇄',
  amount: 36000,
  paidOn: '2026-10-20',
  method: 'card',
  paidBy: null,
  reimbursed: false,
  evidenceCount: 1,
  cancelled: false,
  event: null,
  ...extra,
})

const noop = () => {}
const photo = (id: string, extra: Partial<ChatPhotoListResponse['photos'][number]> = {}) => ({
  id,
  messageId: `m-${id}`,
  room: { id: 'r1', type: 'all_members' as const, name: null },
  senderId: 'm3',
  senderName: '박새내',
  sentAt: '2026-10-20T03:00:00.000Z',
  ...extra,
})
// 대화 사진 고르기 칸의 상태 모음. 훅 대신 정해 둔 값으로 목록·미리 보기·비어 있음·오류를 한 화면에 둔다.
const chat = (
  extra: Partial<ReturnType<typeof useChatEvidence>>,
): ReturnType<typeof useChatEvidence> => ({
  open: true,
  show: noop,
  close: noop,
  list: { kind: 'ready', data: { photos: [], truncated: false } },
  reload: () => Promise.resolve(),
  chosen: null,
  choose: noop,
  type: 'receipt',
  setType: noop,
  problem: null,
  attaching: false,
  attach: () => Promise.resolve(),
  ...extra,
})
const listed = (photos: ChatPhotoListResponse['photos'], truncated = false) =>
  ({ kind: 'ready', data: { photos, truncated } }) as const
const sample = [
  photo('p1'),
  photo('p2', { room: { id: 'r2', type: 'department', name: '기획부' }, senderName: longName }),
  photo('p3', { room: { id: 'r3', type: 'direct', name: unbroken }, senderName: null }),
]
const payer = { id: 'm3', name: '박새내' }

export function ExpenseSection() {
  return (
    <>
      <Section title="지출 카드">
        <div className="flex w-80 flex-col gap-2">
          <ExpenseCard expense={expense('1', {})} onOpen={noop} />
          <ExpenseCard expense={expense('2', { paidBy: payer, evidenceCount: 0 })} onOpen={noop} />
          <ExpenseCard
            expense={expense('3', { paidBy: payer, reimbursed: true, method: 'cash' })}
            onOpen={noop}
          />
          <ExpenseCard expense={expense('4', { cancelled: true })} onOpen={noop} />
          <ExpenseCard
            expense={expense('5', { vendor: `${unbroken} ${longName}`, description: longName })}
            onOpen={noop}
          />
        </div>
      </Section>
      <Section title="증빙 대화 사진 고르기">
        <div className="flex w-80 flex-col gap-6">
          <ChatPhotoPicker councilId="c1" chat={chat({ list: listed(sample, true) })} />
          <ChatPhotoPicker councilId="c1" chat={chat({ chosen: sample[1]! })} />
          <ChatPhotoPicker councilId="c1" chat={chat({ list: listed([]) })} />
          <ChatPhotoPicker
            councilId="c1"
            chat={chat({ chosen: sample[0]!, problem: '이 사진은 붙일 수 없어요.' })}
          />
        </div>
      </Section>
    </>
  )
}
