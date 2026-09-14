import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { resolveParams } from '../spec/params'
import { opsMeet04b } from '../spec/screens'
import { PermissionContext } from './meeting-permissions/PermissionContext'
import { PermissionPeople } from './meeting-permissions/PermissionPeople'
import { readMeetingPermissionView } from './meeting-permissions/data'
import {
  ASSET,
  BREADCRUMB_SEPARATORS,
  NODE,
  SCREEN,
  scalar,
} from './meeting-permissions/spec'

interface OPSMEET04BScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 회의 진행 권한의 안내, 생성자, 참가자 관리 영역을 조립한다. */
export function OPSMEET04BScreen({ screenParams, onNavigate }: OPSMEET04BScreenProps) {
  const view = readMeetingPermissionView(screenParams)

  if (view.status === 'unavailable') {
    return (
      <AppShell
        screenId={opsMeet04b.screenId}
        activeNavigationScreenId={opsMeet04b.activeNavigationScreenId}
        eyebrow={view.meta.eyebrow}
        title={view.meta.title}
        description={view.meta.description}
        footerNote={view.meta.footerNote}
        onNavigate={onNavigate}
      >
        <p role="alert" className="text-sm text-red-700">
          {view.message}
        </p>
      </AppShell>
    )
  }

  const breadcrumb = opsMeet04b.breadcrumb
  const done = view.specs.done

  return (
    <AppShell
      screenId={opsMeet04b.screenId}
      activeNavigationScreenId={opsMeet04b.activeNavigationScreenId}
      eyebrow={view.meta.eyebrow}
      title={view.meta.title}
      description={view.meta.description}
      footerNote={view.meta.footerNote}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={breadcrumb.items.map((item) =>
              item.field === undefined ? (item.value ?? '') : scalar(view.meeting, item.field),
            )}
          />
        )
      }
      headerAction={
        <button
          type="button"
          data-node-id={NODE.done}
          onClick={() => {
            if (done.action.type === 'navigate') {
              onNavigate(
                done.action.targetScreenId,
                resolveParams(done.action.params, { screenParams }),
              )
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.doneCheck} className="size-3.5" />
          {done.label}
        </button>
      }
      onNavigate={onNavigate}
    >
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4 pb-8">
        <PermissionContext view={view} />
        <PermissionPeople view={view} screenParams={screenParams} />
      </div>
    </AppShell>
  )
}
