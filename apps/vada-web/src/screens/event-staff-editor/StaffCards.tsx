import { FigmaAsset } from '../../components/FigmaAsset'
import { SearchSelect } from '../../components/SearchSelect'
import type { DataRow } from '../../data-sources/definitions'
import { ROLE_CARD, ROLE_CHIP, STATE_TEXT } from '../../design/tones'
import { resolveParams } from '../../spec/params'
import type { SelectSpec, SummarySpec } from '../../spec/types'
import { ASSET, SCREEN, optional, scalar } from './spec'

export function DepartmentSelect({
  spec,
  id,
  departmentId,
  screenParams,
  chevronNodeId,
  value,
  onSelect,
}: {
  spec: SelectSpec
  id: string
  departmentId: string
  screenParams: Record<string, string>
  chevronNodeId: string
  value: { value: string; label: string } | null
  onSelect: (option: { value: string; label: string }) => void
}) {
  return (
    <SearchSelect
      id={id}
      placeholder={spec.placeholder}
      searchable={spec.searchable}
      disabled={spec.initiallyDisabled}
      sourceKey={spec.optionsSource.key}
      sourceParams={resolveParams(spec.optionsSource.params, {
        screenParams,
        row: { id: departmentId },
      })}
      value={value}
      onSelect={onSelect}
      chevron={<FigmaAsset screenId={SCREEN} nodeId={chevronNodeId} className="size-2.5" />}
    />
  )
}

export function LeaderPerson({
  row,
  spec,
  nodeId,
  releaseLabel,
  onRelease,
}: {
  row: DataRow
  spec: SummarySpec
  nodeId?: string
  releaseLabel: string
  onRelease: () => void
}) {
  const status = spec.status?.[0]
  const tone = optional(row, status?.toneField) ?? ''
  const roleLabel = optional(row, status?.field)
  return (
    <span
      data-node-id={nodeId}
      className={`relative flex flex-col gap-0.5 rounded border p-2.5 ${
        ROLE_CARD[tone] ?? 'border-gray-200 bg-white'
      }`}
    >
      <FigmaAsset screenId={SCREEN} nodeId={ASSET.leaderAvatar} className="size-6" />
      <span className="pt-1 text-xs font-semibold text-gray-800">
        {scalar(row, spec.titleField!)}
      </span>
      {(spec.items ?? []).map((item, index) => (
        <span
          key={item.field}
          className={`text-[11px] ${index === 0 ? 'text-gray-500' : 'text-gray-400'}`}
        >
          {scalar(row, item.field!)}
        </span>
      ))}
      {roleLabel === null ? null : (
        <span className={`mt-1 w-fit rounded px-1.5 py-0.5 text-[11px] font-semibold ${ROLE_CHIP[tone] ?? ''}`}>
          {roleLabel}
        </span>
      )}
      <button
        type="button"
        aria-label={`${scalar(row, spec.titleField!)} ${releaseLabel}`}
        onClick={onRelease}
        className="absolute -top-2 -right-2 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.leaderRelease} className="size-3.5" />
      </button>
    </span>
  )
}

export function MemberRow({
  row,
  spec,
  nodeId,
  releaseLabel,
  releaseNodeId,
  onRelease,
}: {
  row: DataRow
  spec: SummarySpec
  nodeId?: string
  releaseLabel: string
  releaseNodeId: string
  onRelease: () => void
}) {
  const status = spec.status?.[0]
  const tone = optional(row, status?.toneField) ?? ''
  const roleLabel = optional(row, status?.field)
  return (
    <span
      data-node-id={nodeId}
      className="mt-2 flex items-center gap-2 rounded border border-gray-200 px-2 py-1.5"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-gray-800">
          <span>{scalar(row, spec.titleField!)}</span>
          {roleLabel === null ? null : <span className={STATE_TEXT[tone] ?? ''}>{roleLabel}</span>}
        </span>
        <span className="block text-[11px] text-gray-400">
          {(spec.items ?? []).map((item) => scalar(row, item.field!)).join(' · ')}
        </span>
      </span>
      <button
        type="button"
        aria-label={`${scalar(row, spec.titleField!)} ${releaseLabel}`}
        onClick={onRelease}
        className="shrink-0 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
      >
        <FigmaAsset screenId={SCREEN} nodeId={releaseNodeId} className="size-3" />
      </button>
    </span>
  )
}

export function PanelCard({ row, spec, nodeId }: { row: DataRow; spec: SummarySpec; nodeId?: string }) {
  return (
    <span
      data-node-id={nodeId}
      className="flex w-24 flex-col gap-0.5 rounded border border-gray-200 bg-white p-2.5"
    >
      <FigmaAsset screenId={SCREEN} nodeId={ASSET.panelAvatar} className="size-6" />
      <span className="pt-1 text-xs font-semibold text-gray-800">
        {scalar(row, spec.titleField!)}
      </span>
      {(spec.items ?? []).map((item, index) => (
        <span
          key={item.field}
          className={`text-[11px] ${index === 0 ? 'text-gray-500' : 'text-gray-400'}`}
        >
          {scalar(row, item.field!)}
        </span>
      ))}
    </span>
  )
}
