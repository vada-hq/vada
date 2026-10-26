import { useState, type ReactNode } from 'react'
import { ChevronLeft, Ellipsis, Plus } from 'lucide-react'
import type { EventDetail } from '@vada/contracts'
import PageActions, { PageActionsProvider } from '@/components/PageActions'
import PageColumn from '@/components/PageColumn'
import { PageTrailProvider, type PageTrail } from '@/components/PageHeading'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EventHeader } from '@/events/EventHeader'
import { EVENT_COMPLETED_NOTICE } from '@/lib/messages'
import { eventTrail, trailOf, type Page } from '../workspace/pages'
import WorkspaceHeader from '../workspace/WorkspaceHeader'
import { detail, headerHandlers, tabs } from './EventSections'
import { Section } from './GallerySection'
import { Width } from './home-frame-samples'
import { longName } from './sample-text'

const noop = () => {}
const COUNCIL = '소프트웨어융합대학 학생회'
const LONG_COUNCIL = '한양대학교 ERICA 소프트웨어융합대학 제38대 함께하는 내일 학생회'
const SPORTS_DAY = '2026 소프트웨어융합대학 체육대회'

type Sample = {
  key: string
  page: Page
  council: string
  // 화면이 넘길 더 깊은 칸. 본문(body)이 PageHeading으로 넘기면 그것이 먼저다.
  deeper?: PageTrail
  action?: ReactNode
  body?: ReactNode
}

// 머리글 하나와 그 아래 본문. 작업 공간(CouncilMain)처럼 본문이 넘긴 제목·경로 칸과 행동을 머리글이 받는다.
// 제목과 본문의 왼쪽 줄이 같은지 본다.
function SampleHeader({ sample }: { sample: Sample }) {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)
  const [sent, setSent] = useState<PageTrail | null>(null)
  const trail = trailOf(sample.page, sample.council, sent ?? sample.deeper ?? null)
  return (
    <div className="flex flex-col border bg-gray-50">
      <WorkspaceHeader
        crumbs={trail.crumbs}
        title={trail.title}
        onMenu={noop}
        actionsRef={setSlot}
      />
      <PageActionsProvider value={slot}>
        {sample.action && <PageActions>{sample.action}</PageActions>}
        <PageTrailProvider value={setSent}>
          <div className="p-4 sm:p-6">
            <PageColumn>
              {sample.body ?? <Card className="p-4 text-sm">본문 첫 줄</Card>}
            </PageColumn>
          </div>
        </PageTrailProvider>
      </PageActionsProvider>
    </div>
  )
}

// 실제 행사 화면(EventDetailView)의 머리: 뒤로 버튼, 행사 공통 머리(EventHeader)가 머리글로 넘기는 행사명·탭·'⋯',
// 탭 줄과 요약 줄, 완료 행사의 안내. 개요 본문은 자리만 둔다.
function EventPageBody({ event }: { event: EventDetail }) {
  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-3 self-start">
        <ChevronLeft aria-hidden />
        행사 목록
      </Button>
      <EventHeader event={event} tabs={tabs} tabLabel="개요" {...headerHandlers} />
      {event.status === 'completed' && <Alert tone="info">{EVENT_COMPLETED_NOTICE}</Alert>}
      <Card className="p-4 text-sm">개요 본문</Card>
    </>
  )
}

const history = (
  <Button variant="ghost" size="icon" aria-label="변경 이력">
    <Ellipsis aria-hidden />
  </Button>
)
const SAMPLES: Sample[] = [
  { key: '홈', page: 'home', council: COUNCIL },
  {
    key: '행사 업무 탭',
    page: 'events',
    council: COUNCIL,
    deeper: eventTrail(SPORTS_DAY, '업무'),
    action: history,
  },
  {
    key: '긴 학생회 이름과 긴 행사명',
    page: 'events',
    council: LONG_COUNCIL,
    deeper: eventTrail(longName, '인원 관리'),
    action: history,
  },
  {
    key: '행사 목록(행동 단추)',
    page: 'events',
    council: COUNCIL,
    action: (
      <Button>
        <Plus aria-hidden />새 행사
      </Button>
    ),
  },
  {
    key: '실제 행사 화면 · 후속 정리 중(완료 가능)',
    page: 'events',
    council: COUNCIL,
    body: (
      <EventPageBody
        event={detail(
          {
            name: `${SPORTS_DAY} 및 신입생 환영 한마당`,
            status: 'ended',
            departments: ['기획부'],
            endedDays: 3,
          },
          ['event.update', 'event.complete'],
        )}
      />
    ),
  },
  {
    key: '실제 행사 화면 · 완료(완료 사유)',
    page: 'events',
    council: COUNCIL,
    body: (
      <EventPageBody
        event={detail(
          {
            name: SPORTS_DAY,
            status: 'completed',
            departments: ['기획부'],
            approvals: [
              {
                outcome: 'completed',
                by: { id: 'p1', name: '김회장' },
                // 지난해 날짜라 '2025년'이 붙어 시험 날짜와 관계없이 같다.
                at: '2025-11-20T10:00:00+09:00',
                reason: '정산 확인 완료',
              },
            ],
          },
          ['event.cancel_completion'],
        )}
      />
    ),
  },
]

// 머리글 경로 줄(028 조각 4, 와이어프레임 사이드바 v6.2 OPS-TASK-01·EVT-02 머리글): h-16부터, 왼쪽에 붙음,
// 작은 회색 경로 줄(학생회 이름이 맨 앞, 마지막 칸만 진함), 제목, 오른쪽 행동 칸. 1280px 창의 머리글 폭(옆 메뉴 240px을 뺀 1040px)과 390px 창.
// 휴대폰 모양(제목 두 줄, [≡])은 창 폭으로 갈리므로 좁은 창에서 열어 본다.
export function HeaderSection() {
  return (
    <Section title="머리글 · 경로 줄과 본문 왼쪽 줄">
      {SAMPLES.map(sample => (
        <div key={sample.key} className="flex w-full flex-col gap-2">
          <Width label={`1280px 창 · ${sample.key}`} className="w-260 shrink-0">
            <SampleHeader sample={sample} />
          </Width>
          <Width label={`390px 창 · ${sample.key}`} className="w-97.5 max-w-full shrink-0">
            <SampleHeader sample={sample} />
          </Width>
        </div>
      ))}
    </Section>
  )
}
