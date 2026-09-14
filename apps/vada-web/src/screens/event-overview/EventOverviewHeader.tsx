import { WorkspaceHeader } from '../../components/WorkspaceHeader'
import { ASSET, SCREEN } from './spec'
import type { EventOverviewModel } from './useEventOverview'

export function EventOverviewHeader({ model }: { model: EventOverviewModel }) {
  return (
    <>
      <WorkspaceHeader
        screen={model.screen}
        screenParams={model.screenParams}
        onNavigate={model.onNavigate}
        onPending={model.setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
      />
      {model.note === null ? null : (
        <p role="status" className="pt-4 text-xs font-medium text-gray-500">
          {model.note}
        </p>
      )}
    </>
  )
}
