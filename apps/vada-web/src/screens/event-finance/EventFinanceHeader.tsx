import { FigmaAsset } from '../../components/FigmaAsset'
import { WorkspaceHeader } from '../../components/WorkspaceHeader'
import { ASSET, NODE, SCREEN } from './spec'
import type { EventFinanceModel } from './useEventFinance'

export function EventFinanceHeaderActions({ model }: { model: EventFinanceModel }) {
  const actions = [
    { nodeId: NODE.myRequests, asset: ASSET.myRequests, primary: false, spec: model.myRequests },
    { nodeId: NODE.newRequest, asset: ASSET.newRequest, primary: true, spec: model.newRequest },
  ]
  return (
    <div className="flex gap-2">
      {actions.map(({ nodeId, asset, primary, spec }) => (
        <button
          key={nodeId}
          type="button"
          data-node-id={nodeId}
          onClick={model.press(spec)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
            primary
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FigmaAsset screenId={SCREEN} nodeId={asset} className="size-3" />
          {spec.label}
        </button>
      ))}
    </div>
  )
}

export function EventFinanceWorkspaceHeader({ model }: { model: EventFinanceModel }) {
  return (
    <WorkspaceHeader
      screen={model.screen}
      screenParams={model.screenParams}
      onNavigate={model.onNavigate}
      onPending={model.setNote}
      assetScreenId={SCREEN}
      statusAssets={ASSET.workspaceStatus}
    />
  )
}
