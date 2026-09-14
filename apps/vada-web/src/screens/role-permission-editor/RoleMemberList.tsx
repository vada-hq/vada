import { FigmaAsset } from '../../components/FigmaAsset'
import { BASE_ROLE_CHIP } from '../../design/tones'
import { ASSET, NODE, NODE_FIRST, SCREEN } from './spec'
import type { RolePermissionEditorModel } from './useRolePermissionEditor'
import { roleScalar as scalar } from './useRolePermissionEditor'

export function RoleMemberList({ model }: { model: RolePermissionEditorModel }) {
  return (
    <section
      data-node-id={NODE.members}
      className="flex-1 rounded-xl border border-gray-200 bg-white"
    >
      <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
        <span>
          <span className="block text-sm font-bold text-gray-900">{model.members.title}</span>
          <span className="block pt-1 text-xs text-gray-500">변경할 구성원을 선택하세요.</span>
        </span>
        <span data-node-id={NODE.memberCount} className="text-xs text-gray-400">
          {scalar(model.counts, model.memberCount.items![0].field!)}
        </span>
      </div>
      {model.rows.map((row, index) => {
        const selected = scalar(row, 'id') === scalar(model.person, 'id')
        return (
          <button
            key={scalar(row, 'id')}
            type="button"
            data-node-id={index === 0 ? NODE_FIRST.memberCard : undefined}
            onClick={() => model.chooseMember(row)}
            className={`flex w-full items-center gap-3 border-b border-gray-100 px-5 py-4 text-left last:border-b-0 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none ${
              selected ? 'bg-blue-50' : 'hover:bg-gray-50'
            }`}
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.memberAvatar} className="size-8" />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-gray-800">
                {scalar(row, model.memberCard.titleField!)}
              </span>
              <span className="block text-xs font-medium text-gray-500">
                {scalar(row, model.memberCard.items![0].field!)}
              </span>
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                BASE_ROLE_CHIP[scalar(row, model.memberCard.status![0].toneField)] ?? ''
              }`}
            >
              {scalar(row, model.memberCard.status![0].field)}
            </span>
            <FigmaAsset
              screenId={SCREEN}
              nodeId={selected ? ASSET.memberChevronSelected : ASSET.memberChevron}
              className="size-3"
            />
          </button>
        )
      })}
    </section>
  )
}
