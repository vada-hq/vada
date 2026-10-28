import type { ChatMessage } from '@vada/contracts'
import { CalendarDays, Check, Ellipsis, Settings } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { BrandMark } from '@/components/BrandMark'
import { EmptyState } from '@/components/EmptyState'
import { HistoryMenu } from '@/components/HistoryMenu'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu'
import { NavItem } from '@/components/ui/nav-item'
import { useState } from 'react'
import type { FinanceTab } from '@vada/contracts'
import { FinanceTabs } from '@/finance/FinanceTabs'
import MessageItem from '@/chat/MessageItem'
import { Section } from './GallerySection'
import { longName, unbroken } from './sample-text'

export function MenuTabsSection() {
  const [tab, setTab] = useState<Exclude<FinanceTab, 'requests'>>('overview')
  return (
    <Section title="메뉴·탭">
      <div className="flex w-60 flex-col gap-0.5 rounded-lg border bg-white p-2">
        <NavItem active>체육대회</NavItem>
        <NavItem>축제</NavItem>
        <NavItem disabled>비활성 행사</NavItem>
      </div>
      <FinanceTabs tab={tab} onTab={setTab} showFees />
    </Section>
  )
}

// 상세 머리의 '⋯' > [이력 보기] 예시. 줄 글은 기능마다 도우미가 만든다.
const HISTORY_SAMPLE = [
  { versionNo: 1, text: '김회장 · 10월 20일 14:03 · 만듦' },
  { versionNo: 2, text: '저절로: 구매 요청 냄 · 10월 21일 09:10 · 상태 할 일 → 진행 중' },
  { versionNo: 3, text: `${longName} · 10월 22일 18:30 · 제목 가 → 나` },
]

export function ActionMenuSection() {
  return (
    <Section title="동작 메뉴">
      <Menu>
        <MenuTrigger asChild>
          <Button variant="outline">학생회 메뉴 열기</Button>
        </MenuTrigger>
        <MenuContent align="start">
          <MenuLabel>학생회 고르기</MenuLabel>
          <MenuItem>
            <Check aria-hidden />
            컴퓨터학부 학생회
          </MenuItem>
          <MenuItem>
            <span aria-hidden className="size-4 shrink-0" />
            {longName}
          </MenuItem>
          <MenuSeparator />
          <MenuItem>
            <Settings aria-hidden />
            설정
          </MenuItem>
        </MenuContent>
      </Menu>
      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="운영진 동작 예시">
            <Ellipsis />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem>부서 배정</MenuItem>
          <MenuItem>부회장 직급 주기</MenuItem>
          <MenuItem destructive>내보내기</MenuItem>
        </MenuContent>
      </Menu>
      <HistoryMenu history={HISTORY_SAMPLE} line={version => version.text} />
    </Section>
  )
}

export function EmptyAvatarSection() {
  return (
    <Section title="빈 화면·아바타·로고">
      <Card className="w-96">
        <EmptyState
          icon={CalendarDays}
          title="행사를 선택해 주세요"
          description="왼쪽에서 행사를 선택하거나 새 행사를 만들어 대화를 시작하세요."
        />
      </Card>
      <div className="flex items-center gap-2">
        <Avatar />
        <span className="text-xs font-medium text-gray-700">박해랑</span>
      </div>
      <div className="flex items-center gap-2">
        <BrandMark />
        <span className="text-base font-semibold">VADA</span>
      </div>
    </Section>
  )
}

// 내 메시지 메뉴: 구매 요청·지출과 메시지 삭제 확인 창을 확인한다.
export function MessageMenuSection() {
  const message: ChatMessage = {
    id: '11111111-1111-4111-8111-111111111111',
    senderId: '22222222-2222-4222-8222-222222222222',
    senderName: '박해랑',
    body: '현수막 2개 사 주세요\n색은 파랑이면 좋겠어요',
    sentAt: '2026-10-23T01:30:00Z',
    deletedAt: null,
    photos: [],
    actions: ['message.delete'],
    made: [],
  }
  return (
    <Section title="메시지 메뉴">
      <ul className="w-96 rounded-lg border bg-white p-2">
        <MessageItem
          councilId="33333333-3333-4333-8333-333333333333"
          message={message}
          continued={false}
          mine
          canRequest
          onRequest={() => {}}
          canWriteExpense
          onWriteExpense={() => {}}
        />
      </ul>
    </Section>
  )
}

// 공지방의 보낸 사람 없는 시스템 글(025 조각 4, MSG-03 03). 사람의 글 사이에서 휴대폰 폭(390px)과 넓은 대화 칸 폭으로 본다.
// 일시·장소를 함께 바꾼 두 줄 글, 만들기 글, 줄바꿈 없는 긴 장소다.
export function SystemMessageSection() {
  const sample = (id: string, body: string, sender: string | null) => ({
    id,
    senderId: sender && `sender-${id}`,
    senderName: sender,
    body,
    sentAt: '2026-10-23T01:30:00Z',
    deletedAt: null,
    photos: [],
    actions: [],
    made: [],
  })
  const flow = [
    sample('k1', '가을 축제가 생겼어요', null),
    sample('k2', '장소 다시 알려 주세요', '이재정'),
    sample(
      'k3',
      [
        '가을 축제 일시가 바뀌었어요 · 11월 5일 (목) 14:00 ~ 18:00 → 11월 6일 (금) 10:00 ~ 12:30',
        '가을 축제 장소가 바뀌었어요 · 대운동장 → 체육관',
      ].join('\n'),
      null,
    ),
    sample('k4', `가을 축제 장소가 바뀌었어요 · 체육관 → ${unbroken}`, null),
  ]
  const list = (width: string) => (
    <ul className={`flex flex-col rounded-lg border bg-white p-2 ${width}`}>
      {flow.map(message => (
        <MessageItem
          key={message.id}
          councilId="sample"
          message={message}
          continued={false}
          mine={false}
          canRequest={false}
          onRequest={() => {}}
          canWriteExpense={false}
          onWriteExpense={() => {}}
        />
      ))}
    </ul>
  )
  return (
    <Section title="시스템 글">
      {list('w-96 max-w-full')}
      {list('w-full max-w-3xl')}
    </Section>
  )
}
