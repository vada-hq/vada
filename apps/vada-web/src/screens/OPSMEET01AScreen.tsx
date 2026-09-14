import { AppShell } from '../components/AppShell'
import { MeetingAttention, MeetingFilters } from './meeting-overview/MeetingOverviewControls'
import { MeetingGroups } from './meeting-overview/MeetingGroups'
import { MeetingOverviewHeaderAction } from './meeting-overview/MeetingOverviewHeader'
import {
  useMeetingOverview,
  type MeetingOverviewProps,
} from './meeting-overview/useMeetingOverview'

// 회의 목록(OPS-MEET-01A). 권한별 헤더, 안내, 검색, 행사별 회의 묶음을 조립한다.
export function OPSMEET01AScreen(props: MeetingOverviewProps) {
  const model = useMeetingOverview(props)

  return (
    <AppShell
      screenId={model.screen.screenId}
      activeNavigationScreenId={model.screen.activeNavigationScreenId}
      eyebrow={model.screen.meta?.eyebrow}
      title={model.screen.meta?.title ?? model.screen.screenId}
      onNavigate={model.onNavigate}
      headerAction={
        model.create === null ? undefined : <MeetingOverviewHeaderAction model={model} />
      }
    >
      <MeetingAttention model={model} />
      <MeetingFilters model={model} />
      <MeetingGroups model={model} />
    </AppShell>
  )
}
