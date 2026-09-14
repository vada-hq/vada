import { FigmaAsset } from '../../components/FigmaAsset'
import { findDataSource } from '../../data-sources/definitions'
import { resolveParams } from '../../spec/params'
import { targetScreenOf } from '../../spec/types'
import type { ItemListSpec } from '../../spec/types'
import { ASSET, EMPTY_SCREEN } from './spec'

interface EmptyStaffStateProps {
  departments: ItemListSpec
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onNote: (note: string) => void
}

/** 조직이 구성되지 않은 행사의 안내와 시작 동작을 그린다. */
export function EmptyStaffState({
  departments,
  screenParams,
  onNavigate,
  onNote,
}: EmptyStaffStateProps) {
  const messages = findDataSource(departments.dataSourceKey).messages
  return (
    <div data-design-state="empty" className="flex flex-col items-center gap-4 py-20 text-center">
      <FigmaAsset screenId={EMPTY_SCREEN} nodeId={ASSET.emptyIcon} className="size-12" />
      <p className="text-base font-bold text-gray-900">{messages.empty}</p>
      {messages.emptyDetail === undefined ? null : (
        <p className="text-xs whitespace-pre-line text-gray-500">{messages.emptyDetail}</p>
      )}
      <button
        type="button"
        onClick={() => {
          const action = departments.emptyAction
          if (action?.type === 'pending') onNote(action.note)
          if (action?.type === 'navigate') {
            const target = targetScreenOf(action, {})
            if (target !== null) {
              onNavigate(target, resolveParams(action.params, { screenParams }))
            }
          }
        }}
        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
      >
        <FigmaAsset screenId={EMPTY_SCREEN} nodeId={ASSET.emptyAddIcon} className="size-3.5" />
        {departments.emptyAction?.label}
      </button>
    </div>
  )
}
