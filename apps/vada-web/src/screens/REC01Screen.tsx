import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { rec01 } from '../spec/screen-specs/rec01'
import {
  RECORDS_ARCHIVE_ASSET as ASSET,
  RECORDS_ARCHIVE_SCREEN as SCREEN,
} from './records-archive/config'
import { RecordsArchiveView } from './records-archive/RecordsArchiveView'
import { useRecordsArchive } from './records-archive/useRecordsArchive'

interface REC01ScreenProps {
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function REC01Screen({ onNavigate }: REC01ScreenProps) {
  const model = useRecordsArchive(onNavigate)
  const breadcrumb = rec01.breadcrumb

  return (
    <AppShell
      screenId={rec01.screenId}
      eyebrow={rec01.meta?.eyebrow}
      title={rec01.meta?.title ?? rec01.screenId}
      description={rec01.meta?.description}
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
    >
      <RecordsArchiveView model={model} />
    </AppShell>
  )
}
