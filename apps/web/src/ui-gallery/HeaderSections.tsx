import { useState, type ReactNode } from 'react'
import { Ellipsis, Plus } from 'lucide-react'
import PageActions, { PageActionsProvider } from '@/components/PageActions'
import PageColumn from '@/components/PageColumn'
import type { PageTrail } from '@/components/PageHeading'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { eventTrail, trailOf } from '../workspace/pages'
import WorkspaceHeader from '../workspace/WorkspaceHeader'
import { Section } from './GallerySection'
import { Width } from './home-frame-samples'
import { longName } from './sample-text'

const noop = () => {}
const COUNCIL = '소프트웨어융합대학 학생회'
const LONG_COUNCIL = '한양대학교 ERICA 소프트웨어융합대학 제38대 함께하는 내일 학생회'

// 머리글 하나와 그 아래 본문 첫 줄. 제목과 본문의 왼쪽 줄이 같은지 본다.
function SampleHeader({ trail, action }: { trail: PageTrail; action?: ReactNode }) {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)
  return (
    <div className="flex flex-col border bg-gray-50">
      <WorkspaceHeader
        crumbs={trail.crumbs}
        title={trail.title}
        onMenu={noop}
        actionsRef={setSlot}
      />
      {action && (
        <PageActionsProvider value={slot}>
          <PageActions>{action}</PageActions>
        </PageActionsProvider>
      )}
      <div className="p-4 sm:p-6">
        <PageColumn>
          <Card className="p-4 text-sm">본문 첫 줄</Card>
        </PageColumn>
      </div>
    </div>
  )
}

const history = (
  <Button variant="ghost" size="icon" aria-label="변경 이력">
    <Ellipsis aria-hidden />
  </Button>
)
const SAMPLES: { key: string; trail: PageTrail; action?: ReactNode }[] = [
  { key: '홈', trail: trailOf('home', COUNCIL, null) },
  {
    key: '행사 업무 탭',
    trail: trailOf('events', COUNCIL, eventTrail('2026 소프트웨어융합대학 체육대회', '업무')),
    action: history,
  },
  {
    key: '긴 학생회 이름과 긴 행사명',
    trail: trailOf('events', LONG_COUNCIL, eventTrail(longName, '인원 관리')),
    action: history,
  },
  {
    key: '행사 목록(행동 단추)',
    trail: trailOf('events', COUNCIL, null),
    action: (
      <Button>
        <Plus aria-hidden />새 행사
      </Button>
    ),
  },
]

// 머리글 경로 줄(028 조각 4, 와이어프레임 사이드바 v6.2 OPS-TASK-01·EVT-02 머리글): h-16, 왼쪽에 붙음,
// 작은 회색 경로 줄(학생회 이름이 맨 앞, 마지막 칸만 진함), 제목, 오른쪽 행동 칸. 1280px 창의 머리글 폭(옆 메뉴 240px을 뺀 1040px)과 420px 창.
export function HeaderSection() {
  return (
    <Section title="머리글 · 경로 줄과 본문 왼쪽 줄">
      {SAMPLES.map(sample => (
        <div key={sample.key} className="flex w-full flex-col gap-2">
          <Width label={`1280px 창 · ${sample.key}`} className="w-260 shrink-0">
            <SampleHeader trail={sample.trail} action={sample.action} />
          </Width>
          <Width label={`420px 창 · ${sample.key}`} className="w-105 max-w-full shrink-0">
            <SampleHeader trail={sample.trail} action={sample.action} />
          </Width>
        </div>
      ))}
    </Section>
  )
}
