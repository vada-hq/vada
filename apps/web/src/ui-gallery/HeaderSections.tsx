import { useState, type ReactNode } from 'react'
import { ChevronLeft, Ellipsis, Plus } from 'lucide-react'
import type { EventDetail, RecordKind } from '@vada/contracts'
import PageActions, { PageActionsProvider } from '@/components/PageActions'
import PageColumn from '@/components/PageColumn'
import { pageFrameClass } from '@/components/page-width'
import { PageTrailProvider, type PageTrail } from '@/components/PageHeading'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { EventHeader } from '@/events/EventHeader'
import { financeTrail } from '@/finance/finance-text'
import { eventTrail, pageWidthOf, trailOf, type Page } from '../workspace/pages'
import WorkspaceHeader from '../workspace/WorkspaceHeader'
import { detail, headerHandlers, tabs } from './EventSections'
import { Section } from './GallerySection'
import { Width } from './home-frame-samples'
import { longName } from './sample-text'

const COUNCIL = '소프트웨어융합대학 학생회'
const LONG_COUNCIL = '한양대학교 ERICA 소프트웨어융합대학 제38대 함께하는 내일 학생회'
const SPORTS_DAY = '2026 소프트웨어융합대학 체육대회'

type Sample = {
  key: string
  page: Page
  council: string
  record?: RecordKind
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
  const width = pageWidthOf(sample.page, sample.record)
  return (
    <div className="flex flex-col border bg-surface-subtle">
      <WorkspaceHeader
        width={width}
        crumbs={trail.crumbs}
        title={trail.title}
        actionsRef={setSlot}
      />
      <PageActionsProvider value={slot}>
        {sample.action && <PageActions>{sample.action}</PageActions>}
        <PageTrailProvider value={setSent}>
          <div className="overflow-y-auto p-4 sm:p-6 md:scrollbar-gutter-stable">
            <div className={pageFrameClass(width)}>
              <PageColumn>{sample.body ?? <SampleBody page={sample.page} />}</PageColumn>
            </div>
          </div>
        </PageTrailProvider>
      </PageActionsProvider>
    </div>
  )
}

// 내용을 바꾸지 않고 화면별 폭과 첫 카드의 정렬을 살피는 자리 견본이다.
function SampleBody({ page }: { page: Page }) {
  if (page === 'settings')
    return (
      <Card className="flex flex-col gap-4 p-4">
        <Field label="학생회 이름">
          <Input defaultValue={COUNCIL} readOnly />
        </Field>
        <Field label="학교">
          <Input defaultValue="한양대학교 ERICA" readOnly />
        </Field>
      </Card>
    )
  const labels =
    page === 'tasks'
      ? ['할 일', '진행 중', '끝남']
      : page === 'finance'
        ? ['예산', '지출', '잔액']
        : page === 'people'
          ? ['회장단', '기획부', '재정부']
          : page === 'events'
            ? ['행사 대화방', '메시지']
            : ['내 업무', '다가오는 행사', '받은 요청']
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {labels.map(label => (
        <Card key={label} className="flex min-h-32 flex-col gap-4 p-4">
          <h3 className="text-sm break-keep">{label}</h3>
          {page === 'tasks' && <Card className="p-3 text-sm">현수막 주문</Card>}
        </Card>
      ))}
    </div>
  )
}

// 실제 행사 화면(EventDetailView)의 머리: 뒤로 버튼, 행사 공통 머리(EventHeader)가 머리글로 넘기는 행사명·탭·'⋯',
// 탭 줄과 요약 줄. 개요 본문은 자리만 둔다.
function EventPageBody({ event }: { event: EventDetail }) {
  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-3 self-start">
        <ChevronLeft aria-hidden />
        행사 목록
      </Button>
      <EventHeader event={event} tabs={tabs} tabLabel="개요" {...headerHandlers} />
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
    record: 'events',
    council: COUNCIL,
    deeper: eventTrail(SPORTS_DAY, '업무'),
    action: history,
    body: <SampleBody page="tasks" />,
  },
  {
    key: '긴 학생회 이름과 긴 행사명',
    page: 'events',
    record: 'events',
    council: LONG_COUNCIL,
    deeper: eventTrail(longName, '인원 관리'),
    action: history,
  },
  {
    key: '행사 목록(행동 단추)',
    page: 'events',
    council: COUNCIL,
    body: <Card className="p-4 text-sm">신입생 환영회</Card>,
    action: (
      <Button>
        <Plus aria-hidden />새 행사
      </Button>
    ),
  },
  {
    key: '실제 행사 화면 · 후속 정리 중(완료 가능)',
    page: 'events',
    record: 'events',
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
    record: 'events',
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
  {
    key: '행사 메시지 탭',
    page: 'events',
    record: 'events',
    council: COUNCIL,
    deeper: eventTrail(SPORTS_DAY, '메시지'),
    action: history,
  },
  { key: '재정 결산 탭', page: 'finance', council: COUNCIL, deeper: financeTrail('closing') },
  {
    key: '긴 학생회 이름과 재정 결산 탭',
    page: 'finance',
    council: LONG_COUNCIL,
    deeper: financeTrail('closing'),
  },
  { key: '조직', page: 'people', council: COUNCIL },
  { key: '업무 보드', page: 'tasks', council: COUNCIL },
  { key: '학생회 정보 설정', page: 'settings', council: COUNCIL },
]

// 머리글과 본문은 같은 폭으로 가운데에 둔다(DEC-101). 높이·경로·제목·행동은 DEC-96 그대로다.
// 1280·1920px 창은 옆 메뉴 240px을 뺀 1040·1680px, 휴대폰은 390px로 본다.
// 휴대폰 모양(제목 두 줄)은 창 폭으로 갈리므로 좁은 창에서 열어 본다.
export function HeaderSection() {
  return (
    <Section title="머리글 · 경로 줄과 본문 왼쪽 줄">
      {SAMPLES.map(sample => (
        <div key={sample.key} className="flex w-full flex-col gap-2">
          <Width label={`1280px 창 · ${sample.key}`} className="w-260 shrink-0">
            <SampleHeader sample={sample} />
          </Width>
          <Width label={`1920px 창 · ${sample.key}`} className="w-420 shrink-0">
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
