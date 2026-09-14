import { FigmaAsset } from '../../components/FigmaAsset'
import type { DataRow } from '../../data-sources/definitions'
import { ROLE_CARD, ROLE_CHIP } from '../../design/tones'
import type { SummarySpec } from '../../spec/types'
import { SCREEN, scalar } from './spec'

interface PersonCardProps {
  row: DataRow
  spec: SummarySpec
  nodeId?: string
  releaseLabel?: string
  onRelease?: () => void
  onDragStart: () => void
  variant: 'executive' | 'leader' | 'member' | 'pooled'
  art: { avatar: string; grip: string; release: string | null }
}

/** 역할별 색과 이동 손잡이를 가진 조직 구성원 카드다. */
export function PersonCard({
  row, spec, nodeId, releaseLabel, onRelease, onDragStart, variant, art,
}: PersonCardProps) {
  const tone = spec.status === undefined ? '' : scalar(row, spec.status[0].toneField)
  const frame =
    variant === 'executive'
      ? `w-36 ${ROLE_CARD[tone] ?? 'border-gray-200 bg-white'}`
      : variant === 'leader'
        ? 'border-blue-300 bg-white'
        : 'border-gray-200 bg-white'
  return (
    <span
      data-node-id={nodeId}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', scalar(row, 'id'))
        onDragStart()
      }}
      className={`relative mt-2 flex flex-col gap-0.5 rounded-md border p-3 ${frame}`}
    >
      <FigmaAsset screenId={SCREEN} nodeId={art.grip} className="absolute top-2 left-2 size-3" />
      <FigmaAsset screenId={SCREEN} nodeId={art.avatar} className="size-7" />
      <span className="pt-1 text-xs font-semibold text-gray-800">{scalar(row, spec.titleField!)}</span>
      {(spec.items ?? []).map((item, index) => (
        <span
          key={item.field}
          className={`text-[11px] ${variant === 'executive' ? 'font-medium ' : ''}${
            index === 0 ? 'text-gray-500' : 'text-gray-400'
          }`}
        >
          {scalar(row, item.field!)}
        </span>
      ))}
      {spec.status === undefined ? null : (
        <span className={`mt-1 w-fit rounded px-2 py-0.5 text-[11px] font-semibold ${ROLE_CHIP[tone] ?? ''}`}>
          {scalar(row, spec.status[0].field)}
        </span>
      )}
      {releaseLabel === undefined || onRelease === undefined || art.release === null ? null : (
        <button
          type="button"
          aria-label={`${scalar(row, spec.titleField!)} ${releaseLabel}`}
          onClick={onRelease}
          className="absolute -top-2 -right-2 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          <FigmaAsset screenId={SCREEN} nodeId={art.release} className="size-4" />
        </button>
      )}
    </span>
  )
}
