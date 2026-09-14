import { FigmaAsset } from '../../components/FigmaAsset'
import { CHIP_ON_TINT } from '../../design/tones'
import { InviteActionButton } from './InviteActionButton'
import { ASSET, NODE, SCREEN } from './spec'
import type { OrganizationInviteModel } from './useOrganizationInvite'
import { inviteScalar as scalar } from './useOrganizationInvite'

const SECONDARY = 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'

export function InvitePanel({ model }: { model: OrganizationInviteModel }) {
  return (
    <aside className="w-80 shrink-0 border-l border-gray-200 pl-6">
      <p className="flex items-center gap-2 pb-5 text-sm font-bold text-gray-900">
        <button
          type="button"
          data-node-id={NODE.close}
          aria-label={model.close.label}
          onClick={() => model.press(model.close)}
          className="focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.close} className="size-4" />
        </button>
        구성원 초대
      </p>

      <div data-node-id={NODE.intro}>
        <p className="text-sm font-semibold text-gray-800">
          {scalar(model.chart, model.intro.titleField!)}
        </p>
        <p className="pt-1 text-xs text-gray-500">{model.intro.description}</p>
      </div>

      <div
        data-node-id={NODE.state}
        className="mt-4 rounded-md border border-green-200 bg-green-50 p-4"
      >
        <p className="flex items-center justify-between">
          <span className="text-xs font-semibold text-green-900">{model.state.title}</span>
          <span
            className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
              CHIP_ON_TINT[scalar(model.invite, model.state.status![0].toneField)] ?? ''
            }`}
          >
            {scalar(model.invite, model.state.status![0].field)}
          </span>
        </p>
        <p className="pt-2 text-xs text-green-800">
          {scalar(model.invite, model.state.descriptionField!)}
        </p>
        <p className="pt-1 text-[11px] text-green-700">
          {scalar(model.invite, model.state.items![0].field!)}
        </p>
      </div>

      <div data-node-id={NODE.link} className="mt-5">
        <p className="text-xs font-medium text-gray-600">{model.link.title}</p>
        <p className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs break-all text-gray-500">
          {scalar(model.invite, model.link.items![0].field!)}
        </p>
      </div>
      <div className="mt-2 flex gap-2">
        <InviteActionButton model={model} spec={model.copyLink} nodeId={NODE.copyLink} assetId={ASSET.copyLink} className={SECONDARY} />
        <InviteActionButton model={model} spec={model.regenerateLink} nodeId={NODE.regenerateLink} assetId={ASSET.regenerateLink} className={SECONDARY} />
      </div>

      <div data-node-id={NODE.code} className="mt-5">
        <p className="text-xs font-medium text-gray-600">{model.code.title}</p>
        <p className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-lg font-bold tracking-widest text-gray-800">
          {scalar(model.invite, model.code.items![0].field!)}
        </p>
      </div>
      <div className="mt-2 flex gap-2">
        <InviteActionButton model={model} spec={model.copyCode} nodeId={NODE.copyCode} assetId={ASSET.copyCode} className={SECONDARY} />
        <InviteActionButton model={model} spec={model.regenerateCode} nodeId={NODE.regenerateCode} assetId={ASSET.regenerateCode} className={SECONDARY} />
      </div>

      <p className="pt-6 text-xs text-gray-500">{model.screen.meta?.footerNote}</p>
      <div className="pt-3">
        <InviteActionButton model={model} spec={model.regenerateAll} nodeId={NODE.regenerateAll} assetId={ASSET.regenerateAll} className="text-red-500 hover:bg-red-50" />
      </div>

      {model.note === null ? null : (
        <p role="status" className="pt-4 text-xs text-gray-500">
          {model.note}
        </p>
      )}
      {model.submitAction.errorMessage === null ? null : (
        <p role="alert" className="pt-4 text-xs text-red-500">
          {model.submitAction.errorMessage}
        </p>
      )}
    </aside>
  )
}
