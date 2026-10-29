import { useState } from 'react'
import { NativeSelect } from '@/components/ui/native-select'
import MobileNavigation from '@/workspace/MobileNavigation'
import WorkspaceFrame from '@/workspace/WorkspaceFrame'
import WorkspaceHeader from '@/workspace/WorkspaceHeader'
import { activeItemOf } from '@/workspace/space-view'
import { pageTitles, type Page } from '@/workspace/pages'
import { SampleSidebar } from './SidebarSections'
import { Section } from './GallerySection'

const noop = () => {}
const BADGE_COUNTS = { none: 0, few: 2, overflow: 120 } as const
const STATES = [
  { page: 'home', label: '홈', count: BADGE_COUNTS.none },
  { page: 'chat', label: '메시지', count: BADGE_COUNTS.few },
  { page: 'tasks', label: '업무', count: BADGE_COUNTS.overflow },
  { page: 'events', label: '행사', count: BADGE_COUNTS.few },
  { page: 'finance', label: '메뉴', count: BADGE_COUNTS.none },
] as const

function Preview() {
  const [page, setPage] = useState<Page>('tasks')
  const [count, setCount] = useState<number>(BADGE_COUNTS.overflow)
  const [open, setOpen] = useState(false)
  const active = activeItemOf(page, null, [])
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <label>
          켜진 탭
          <NativeSelect
            aria-label="켜진 탭"
            value={page}
            onChange={e => setPage(e.target.value as Page)}
          >
            {STATES.map(state => (
              <option key={state.page} value={state.page}>
                {state.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label>
          배지
          <NativeSelect
            aria-label="배지"
            value={count}
            onChange={e => setCount(Number(e.target.value))}
          >
            {Object.values(BADGE_COUNTS).map(value => (
              <option key={value}>{value}</option>
            ))}
          </NativeSelect>
        </label>
      </div>
      <div className="relative -mx-4 flex h-112 w-screen flex-col overflow-hidden border bg-surface-subtle sm:mx-0 sm:w-full">
        <WorkspaceFrame
          sidebar={() => <SampleSidebar unread={count} active={active} inSheet={open} />}
          navOpen={open}
          onNavOpenChange={setOpen}
        >
          <WorkspaceHeader
            width="full"
            crumbs={[{ label: '소프트웨어융합대학 학생회', truncate: true }]}
            title={pageTitles[page].title}
          />
          <div className="min-h-0 flex-1 overflow-y-auto p-4 max-md:bottom-navigation-space">
            <p>신입생 환영회</p>
          </div>
          <MobileNavigation
            active={active}
            unread={count}
            taskCount={{ count, more: false }}
            onPage={setPage}
            onMenu={() => setOpen(true)}
            className="absolute"
          />
        </WorkspaceFrame>
      </div>
    </div>
  )
}

// 실제 창 폭으로 md 경계를 확인한다. 좁은 창에서 390·420 견본과 켜짐 다섯·배지 세 값을 함께 본다.
export function BottomNavigationSection() {
  return (
    <Section title="휴대폰 아래 탭 줄">
      <Preview />
      {['w-97.5', 'w-105'].map(width => (
        <div key={width} className={`flex max-w-full flex-col gap-3 ${width}`}>
          <h3>{width === 'w-97.5' ? '390px' : '420px'}</h3>
          {STATES.map(({ page, label, count }) => (
            <div key={page} className="flex flex-col gap-1">
              <p className="text-xs">
                {label} · 배지 {count}
              </p>
              <MobileNavigation
                active={activeItemOf(page, null, [])}
                unread={count}
                taskCount={{ count, more: false }}
                onPage={noop}
                onMenu={noop}
                className="relative"
              />
            </div>
          ))}
        </div>
      ))}
    </Section>
  )
}
