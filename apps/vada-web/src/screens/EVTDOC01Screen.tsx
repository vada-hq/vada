import { AppShell } from '../components/AppShell'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import { drawnTitleOf, evtDoc01 } from '../spec/screens'
import {
  EVENT_DOCUMENT_ASSET as ASSET,
  EVENT_DOCUMENT_SCREEN as SCREEN,
} from './event-documents/config'
import { EventDocumentContent } from './event-documents/EventDocumentContent'
import { useEventDocuments } from './event-documents/useEventDocuments'

interface EVTDOC01ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EVTDOC01Screen({ screenParams, onNavigate }: EVTDOC01ScreenProps) {
  const model = useEventDocuments(screenParams)

  if (!model.ready) {
    return (
      <AppShell
        screenId={evtDoc01.screenId}
        activeNavigationScreenId={evtDoc01.activeNavigationScreenId}
        eyebrow={evtDoc01.meta?.eyebrow}
        title={evtDoc01.meta?.title ?? evtDoc01.screenId}
        onNavigate={onNavigate}
      >
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {model.message}
        </p>
      </AppShell>
    )
  }

  return (
    <AppShell
      screenId={evtDoc01.screenId}
      activeNavigationScreenId={evtDoc01.activeNavigationScreenId}
      eyebrow={evtDoc01.meta?.eyebrow}
      title={drawnTitleOf(evtDoc01, screenParams)}
      footerNote={evtDoc01.meta?.footerNote}
      onNavigate={onNavigate}
    >
      <WorkspaceHeader
        screen={evtDoc01}
        screenParams={screenParams}
        onNavigate={onNavigate}
        onPending={model.setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
      />
      <EventDocumentContent model={model} />
    </AppShell>
  )
}
