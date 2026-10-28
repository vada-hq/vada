import { useState } from 'react'
import type { CouncilView, MyCouncil, SidebarEvent } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { CountBadge } from '@/components/ui/count-badge'
import type { TaskCount } from '@/tasks/task-view'
import WorkspaceSidebar from '../workspace/WorkspaceSidebar'
import SidebarFooter from '../workspace/SidebarFooter'
import type { ActiveItem } from '../workspace/space-view'
import { Section } from './GallerySection'

const noop = () => {}
const user = { id: 'u1', name: '김구글', email: 'kim.google@example.com' }
const titles = { president: '회장', vicePresident: '부회장', head: '부장', viceHead: '차장' }
const council: MyCouncil = {
  id: 'c1',
  name: '소프트웨어융합대학 학생회',
  unit: 'college',
  schoolName: '한양대학교 ERICA',
  councilRank: null,
  departments: [],
}

const viewOf = (me: Pick<CouncilView['me'], 'councilRank' | 'departments'>): CouncilView => ({
  council: {
    id: 'c1',
    name: council.name,
    unit: 'college',
    schoolName: '한양대학교 ERICA',
    titles,
  },
  cohort: { id: 'k1', name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' },
  me: { memberId: 'm1', name: '박해랑', ...me },
  permissions: [],
})
const department = (id: string, name: string) => ({ id, name, role: null, rank: 'head' as const })
// 발 셋: 부서 둘인 부장, 부서 없는 회장, 부서도 직급도 없는 운영진.
const FOOTERS = [
  {
    key: '부서 둘(부장)',
    view: viewOf({
      councilRank: null,
      departments: [department('d1', '기획부'), department('d2', '홍보부')],
    }),
  },
  { key: '직급만(회장)', view: viewOf({ councilRank: 'president', departments: [] }) },
  { key: '둘 다 없음', view: viewOf({ councilRank: null, departments: [] }) },
]

const EVENTS: SidebarEvent[] = [
  { id: 'e1', name: '2026 소프트웨어융합대학 체육대회', status: 'ongoing' },
  { id: 'e2', name: '2026학년도 새내기 배움터', status: 'upcoming' },
  { id: 'e3', name: '봄 축제 학생회 부스', status: 'ended' },
]
const space = {
  events: EVENTS,
  onOpenEvent: noop,
  onSeeAll: noop,
  onNewEvent: noop,
  lost: null,
}
const tasks = (count: number): TaskCount => ({ count, more: false })
// 배지 0·2·120: 안 읽은 메시지와 지난 업무를 같은 수로 둔다(120이면 '99+').
const SIDEBARS: { key: string; unread: number; active: ActiveItem; width: string }[] = [
  {
    key: '1280 옆 메뉴, 배지 120',
    unread: 120,
    active: { kind: 'menu', menu: 'home' },
    width: 'w-60',
  },
  { key: '1280 옆 메뉴, 배지 2', unread: 2, active: { kind: 'event', id: 'e1' }, width: 'w-60' },
  { key: '420 서랍, 배지 0', unread: 0, active: { kind: 'menu', menu: 'finance' }, width: 'w-72' },
]

export function SampleSidebar({
  unread,
  active,
  inSheet,
}: {
  unread: number
  active: ActiveItem
  inSheet: boolean
}) {
  return (
    <WorkspaceSidebar
      council={council}
      councils={[council]}
      view={FOOTERS[0]!.view}
      active={active}
      unread={unread}
      taskCount={tasks(unread)}
      space={space}
      onSelect={noop}
      onPage={noop}
      inSheet={inSheet}
      user={user}
      logoutBusy={false}
      onLogout={noop}
      onRenamed={noop}
    />
  )
}

// 실제 휴대폰 서랍(닫기 단추가 있는 시트) 안의 옆 메뉴. 420 폭에서 머리 화살표와 닫기 단추가 겹치지 않는지 본다.
function DrawerSample() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        휴대폰 서랍 열기
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent title="학생회 작업 공간 예시">
          <SampleSidebar unread={120} active={{ kind: 'menu', menu: 'chat' }} inSheet />
        </SheetContent>
      </Sheet>
    </>
  )
}

// 옆 메뉴 틀(028 조각 3, 와이어프레임 사이드바 v6.2 US-MSG-01 옆 메뉴): 머리 두 줄, 최상위 칸과 배지 둘, '공간', 발 두 줄.
// 넓은 화면의 옆 메뉴 폭(1280에서 240px)과 휴대폰 서랍 폭(420에서 288px)으로 본다.
export function SidebarSection() {
  return (
    <Section title="옆 메뉴 · 틀과 수 배지">
      {SIDEBARS.map(sample => (
        <div key={sample.key} className={`flex flex-col gap-1 ${sample.width}`}>
          <p className="text-xs text-gray-400">{sample.key}</p>
          <div className="h-160 rounded-lg border bg-white">
            <SampleSidebar
              unread={sample.unread}
              active={sample.active}
              inSheet={sample.width === 'w-72'}
            />
          </div>
        </div>
      ))}
      <div className="flex w-60 flex-col gap-3">
        {FOOTERS.map(sample => (
          <div key={sample.key} className="flex flex-col gap-1">
            <p className="text-xs text-gray-400">발: {sample.key}</p>
            <div className="rounded-lg border bg-white">
              <SidebarFooter
                view={sample.view}
                user={user}
                logoutBusy={false}
                onLogout={noop}
                onRenamed={noop}
              />
            </div>
          </div>
        ))}
        <p className="text-xs text-gray-400">수 배지 0 · 2 · 120 · 지남 2 · 지남 3+</p>
        <div className="flex items-center gap-2">
          <CountBadge count={0} label="안 읽은 메시지 0개" />
          <CountBadge count={2} label="안 읽은 메시지 2개" />
          <CountBadge count={120} label="안 읽은 메시지 120개" />
          <CountBadge count={2} prefix="지남" label="지난 업무 2개" />
          <CountBadge count={3} prefix="지남" more label="지난 업무 3개 이상" />
        </div>
        <DrawerSample />
      </div>
    </Section>
  )
}
