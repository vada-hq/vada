import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { org07a } from '../spec/screens'
import {
  STUDENT_ROSTER_ASSET as ASSET,
  STUDENT_ROSTER_SCREEN as SCREEN,
} from './student-roster/config'
import { StudentRosterActions, StudentRosterView } from './student-roster/StudentRosterView'
import { useStudentRoster } from './student-roster/useStudentRoster'

interface ORG07AScreenProps {
  onNavigate: (screenId: string) => void
}

export function ORG07AScreen({ onNavigate }: ORG07AScreenProps) {
  const model = useStudentRoster(onNavigate)
  const breadcrumb = org07a.breadcrumb

  return (
    <AppShell
      screenId={org07a.screenId}
      activeNavigationScreenId={org07a.activeNavigationScreenId}
      eyebrow={org07a.meta?.eyebrow}
      title={org07a.meta?.title ?? org07a.screenId}
      onNavigate={onNavigate}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={[ASSET.breadcrumbSeparator]}
            items={breadcrumb.items.map((item) => item.value ?? '')}
          />
        )
      }
      headerAction={<StudentRosterActions onPress={model.pressHeaderAction} />}
    >
      <StudentRosterView model={model} />
    </AppShell>
  )
}
