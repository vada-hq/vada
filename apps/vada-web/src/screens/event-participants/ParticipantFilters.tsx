import { FilterSelect } from '../../components/FilterSelect'
import { ASSET, NODE, SCREEN } from './spec'
import type { ParticipantDirectoryModel } from './useParticipantDirectory'

export function ParticipantFilters({ model }: { model: ParticipantDirectoryModel }) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-4">
      <input
        data-node-id={NODE.search}
        type={model.specs.search.inputType}
        aria-label={model.specs.search.label}
        placeholder={model.specs.search.placeholder ?? model.specs.search.label}
        value={model.query}
        onChange={(event) => model.setQuery(event.target.value)}
        className="w-56 rounded border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 placeholder:text-gray-900"
      />
      {(
        [
          [NODE.affiliation, ASSET.chevron.affiliation],
          [NODE.applyStatus, ASSET.chevron.applyStatus],
          [NODE.payStatus, ASSET.chevron.payStatus],
          [NODE.attendStatus, ASSET.chevron.attendStatus],
        ] as const
      ).map(([nodeId, chevron]) => {
        const filter = model.filterOf(nodeId)
        return (
          <FilterSelect
            key={nodeId}
            nodeId={nodeId}
            screenId={SCREEN}
            chevronNodeId={chevron}
            placeholder={filter.spec.placeholder ?? ''}
            sourceKey={filter.spec.optionsSource.key}
            sourceParams={filter.sourceParams}
            value={filter.value}
            onSelect={filter.onSelect}
          />
        )
      })}
    </div>
  )
}
