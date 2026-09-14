import { FigmaAsset } from '../../components/FigmaAsset'
import type { ButtonSpec, SubmitAction } from '../../spec/types'
import { SCREEN } from './spec'
import type { OrganizationInviteModel } from './useOrganizationInvite'

export function InviteActionButton({
  model,
  spec,
  nodeId,
  assetId,
  className,
}: {
  model: OrganizationInviteModel
  spec: ButtonSpec
  nodeId: string
  assetId: string
  className: string
}) {
  const running =
    spec.action.type === 'submit' && model.submitAction.runningKey === spec.action.mutationKey
  return (
    <button
      type="button"
      data-node-id={nodeId}
      onClick={() => model.press(spec)}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none ${className}`}
    >
      <FigmaAsset screenId={SCREEN} nodeId={assetId} className="size-3.5" />
      {running ? model.submitAction.labelOf(spec.action as SubmitAction, spec.label) : spec.label}
    </button>
  )
}
