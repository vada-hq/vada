import { FigmaAsset } from '../../components/FigmaAsset'
import { nodeIdOf } from '../../spec/screens'
import { home01k } from '../../spec/screen-specs/home01k'
import type { ButtonSpec } from '../../spec/types'
import { SCREEN } from './spec'

interface HomeActionProps {
  spec: ButtonSpec
  onNavigate: (screenId: string) => void
  iconNodeId?: string
  variant?: 'link' | 'outlined'
}

export function HomeAction({
  spec,
  onNavigate,
  iconNodeId,
  variant = 'link',
}: HomeActionProps) {
  const action = spec.action
  const onClick = action.type === 'navigate' ? () => onNavigate(action.targetScreenId) : undefined
  const title = action.type === 'pending' ? action.note : undefined
  const shape =
    variant === 'outlined'
      ? 'rounded border border-gray-300 bg-white px-3 py-1.5 text-gray-700 hover:bg-gray-50'
      : 'rounded px-2 py-1 text-gray-400 hover:bg-gray-100'

  return (
    <button
      type="button"
      data-node-id={nodeIdOf(home01k, spec)}
      title={title}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1 text-xs font-medium focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none ${shape}`}
    >
      {spec.label}
      {iconNodeId === undefined ? null : (
        <FigmaAsset screenId={SCREEN} nodeId={iconNodeId} className="size-3" />
      )}
    </button>
  )
}
