import type { ReactNode } from 'react'
import { AppShell } from '../components/AppShell'
import { Built } from '../components/Built'
import { home01k } from '../spec/screen-specs/home01k'
import { BriefingCard } from './home-dashboard/BriefingCard'
import { EventCountTiles, EventList } from './home-dashboard/EventWidgets'
import { FinanceSummary } from './home-dashboard/FinanceSummary'
import { MyTasksCard } from './home-dashboard/MyTasksCard'
import { OrgAlertList } from './home-dashboard/OrgAlertList'
import { ScheduleList } from './home-dashboard/ScheduleList'

interface HOME01KScreenProps {
  onNavigate: (screenId: string) => void
}

// 홈 대시보드(HOME-01K). 독립적으로 실패할 수 있는 일곱 위젯의 배치만 담당한다.
export function HOME01KScreen({ onNavigate }: HOME01KScreenProps): ReactNode {
  return (
    <AppShell
      screenId={home01k.screenId}
      eyebrow={home01k.meta?.eyebrow}
      title={home01k.meta?.title ?? home01k.screenId}
      description={home01k.meta?.description}
      onNavigate={onNavigate}
    >
      <div className="mx-auto flex max-w-[1152px] flex-col gap-6">
        <Built what="오늘의 브리핑">
          <BriefingCard onNavigate={onNavigate} />
        </Built>
        <Built what="행사·일정 건수">
          <EventCountTiles />
        </Built>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[728fr_352fr]">
          <div className="flex flex-col gap-6">
            <Built what="진행 중·예정 행사">
              <EventList />
            </Built>
            <Built what="다가오는 주요 일정">
              <ScheduleList onNavigate={onNavigate} />
            </Built>
          </div>
          <div className="flex flex-col gap-6">
            <Built what="조직 주요 알림">
              <OrgAlertList />
            </Built>
            <Built what="전체 재정 요약">
              <FinanceSummary onNavigate={onNavigate} />
            </Built>
            <MyTasksCard onNavigate={onNavigate} />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
