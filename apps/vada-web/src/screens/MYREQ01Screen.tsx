import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import { drawnTitleOf } from '../spec/screens'
import { myReq01 } from '../spec/screen-specs/myReq01'
import {
  MY_REQUESTS_ASSET as ASSET,
  MY_REQUESTS_BREADCRUMB_SEPARATORS,
  MY_REQUESTS_SCREEN as SCREEN,
} from './my-requests/config'
import { MyRequestsContent } from './my-requests/MyRequestsContent'
import { useMyRequests } from './my-requests/useMyRequests'

interface MYREQ01ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function MYREQ01Screen({ screenParams, onNavigate }: MYREQ01ScreenProps) {
  const model = useMyRequests(screenParams, onNavigate)
  if (!model.ready) {
    return (
      <AppShell
        screenId={myReq01.screenId}
        activeNavigationScreenId={myReq01.activeNavigationScreenId}
        eyebrow={myReq01.meta?.eyebrow}
        title={myReq01.meta?.title ?? myReq01.screenId}
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
      screenId={myReq01.screenId}
      activeNavigationScreenId={myReq01.activeNavigationScreenId}
      eyebrow={myReq01.meta?.eyebrow}
      title={drawnTitleOf(myReq01, screenParams)}
      onNavigate={onNavigate}
      breadcrumb={
        model.breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={model.breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={MY_REQUESTS_BREADCRUMB_SEPARATORS}
            items={model.breadcrumbItems ?? []}
          />
        )
      }
    >
      <WorkspaceHeader
        screen={myReq01}
        screenParams={screenParams}
        onNavigate={onNavigate}
        onPending={model.setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
      />
      <MyRequestsContent model={model} />
    </AppShell>
  )
}
