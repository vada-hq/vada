import { useState } from 'react'
import type { CouncilTab } from '@vada/contracts'
import { PageTrailProvider, type PageTrail } from '@/components/PageHeading'
import StateMessage from '@/components/StateMessage'
import { useSplit } from '@/lib/use-split'
import { TaskBoard } from '@/tasks/TaskBoard'
import type { TaskList } from '@/tasks/useTasks'
import CouncilSpace from '@/workspace/CouncilSpace'
import WorkspaceHeader from '@/workspace/WorkspaceHeader'
import { trailOf } from '@/workspace/pages'
import { Section } from './GallerySection'

const noop = () => {}
const empty: TaskList = {
  state: { kind: 'ready', tasks: [], truncated: false },
  reload: async () => {},
}

// 넓은 화면은 실제 본문 폭(1280에서 옆 메뉴 240을 뺀 폭), 휴대폰은 창 폭 그대로다. 네트워크 요청이 없는 공간 틀 견본이다.
function Sample({ initial }: { initial: CouncilTab }) {
  const [tab, setTab] = useState(initial)
  const wide = useSplit()
  const [deeper, setDeeper] = useState<PageTrail | null>(null)
  const trail = trailOf('council', '컴퓨터학부 학생회', deeper)
  return (
    <div className="flex h-144 w-full min-w-0 flex-col border bg-gray-50">
      <WorkspaceHeader {...trail} onMenu={noop} />
      <PageTrailProvider value={setDeeper}>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <CouncilSpace tab={tab} onTab={setTab}>
            {tab === 'messages' ? (
              <div className="flex h-full flex-col gap-3">
                <h3 className="text-base font-semibold">공지방</h3>
                <StateMessage kind="empty">메시지 없음</StateMessage>
              </div>
            ) : !wide ? (
              <StateMessage kind="empty">업무 없음</StateMessage>
            ) : (
              <TaskBoard
                open={empty}
                done={empty}
                departments={[]}
                change={{ busy: new Set<string>(), errors: {}, change: async () => {} }}
                onOpenTask={noop}
                onShowDoneTable={noop}
                councilEmpty
                emptyText="업무 없음"
              />
            )}
          </CouncilSpace>
        </div>
      </PageTrailProvider>
    </div>
  )
}

export function CouncilSpaceSection() {
  return (
    <Section title="우리 학생회 공간 · 틀과 메시지·업무 탭">
      {(['messages', 'tasks'] as const).map(tab => (
        <div key={tab} className="flex w-full flex-col gap-3">
          <div className="w-260 max-w-full">
            <p className="text-xs text-muted-foreground">
              1280px 창 · {tab === 'messages' ? '메시지' : '업무'}
            </p>
            <Sample initial={tab} />
          </div>
          <div className="w-97.5 max-w-full">
            <p className="text-xs text-muted-foreground">
              390px 창 · {tab === 'messages' ? '메시지' : '업무'}
            </p>
            <Sample initial={tab} />
          </div>
        </div>
      ))}
    </Section>
  )
}
