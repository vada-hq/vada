import { FigmaAsset } from '../../components/FigmaAsset'
import { ROLE_CARD, ROLE_CHIP } from '../../design/tones'
import { ASSET, NODE, NODE_FIRST, ROLE_AVATAR, SCREEN } from './spec'
import type { OrganizationInviteModel } from './useOrganizationInvite'
import { inviteScalar as scalar } from './useOrganizationInvite'

export function OrganizationInvitePreview({ model }: { model: OrganizationInviteModel }) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <div
        data-node-id={NODE.executives}
        className="w-full max-w-md rounded-md border border-gray-300 bg-white"
      >
        <p className="flex items-center gap-2 rounded-t-md border-b border-gray-200 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-800">
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.executiveIcon} className="size-4" />
          <span>{model.executives.title}</span>
        </p>
        <div className="flex flex-wrap gap-3 px-5 pt-4">
          {model.executiveRows.map((row, index) => {
            const tone = scalar(row, model.executiveCard.status![0].toneField)
            return (
              <span
                key={scalar(row, 'id')}
                data-node-id={index === 0 ? NODE_FIRST.executiveCard : undefined}
                className={`flex w-36 flex-col gap-1 rounded-md border p-3 ${
                  ROLE_CARD[tone] ?? 'border-gray-200 bg-white'
                }`}
              >
                <FigmaAsset screenId={SCREEN} nodeId={ROLE_AVATAR[tone] ?? ''} className="size-7" />
                <span className="pt-1 text-xs font-semibold text-gray-800">
                  {scalar(row, model.executiveCard.titleField!)}
                </span>
                {(model.executiveCard.items ?? []).map((item, at) => (
                  <span
                    key={item.field}
                    className={`text-[11px] font-medium ${
                      at === 0 ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    {scalar(row, item.field!)}
                  </span>
                ))}
                <span
                  className={`mt-1 w-fit rounded px-2 py-0.5 text-[11px] font-semibold ${
                    ROLE_CHIP[tone] ?? ''
                  }`}
                >
                  {scalar(row, model.executiveCard.status![0].field)}
                </span>
              </span>
            )
          })}
        </div>
        <button
          type="button"
          data-node-id={NODE.addExecutive}
          onClick={() => model.press(model.addExecutive)}
          className="flex items-center gap-1 px-5 py-3 text-xs font-medium text-blue-500 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.addExecutive} className="size-3" />
          {model.addExecutive.label}
        </button>
      </div>

      <span aria-hidden className="h-6 w-px bg-gray-300" />
      <div data-node-id={NODE.departments} className="flex w-full flex-wrap justify-center gap-3">
        {model.departmentRows.map((row, index) => (
          <p
            key={scalar(row, 'id')}
            data-node-id={index === 0 ? NODE_FIRST.department : undefined}
            className="w-52 rounded-md border border-gray-200 bg-white px-5 py-4 text-sm font-semibold text-gray-900"
          >
            {scalar(row, model.departmentCard.titleField!)}
          </p>
        ))}
      </div>
    </div>
  )
}
