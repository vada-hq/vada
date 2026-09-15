import { DataTable } from '../../components/DataTable'
import { FigmaAsset } from '../../components/FigmaAsset'
import { SearchSelect } from '../../components/SearchSelect'
import { findDataSource } from '../../data-sources/definitions'
import { elementByNodeId } from '../../spec/screens'
import { org07a } from '../../spec/screen-specs/org07a'
import type { ButtonSpec, SelectSpec, SummarySpec } from '../../spec/types'
import {
  STUDENT_ROSTER_ASSET as ASSET,
  STUDENT_ROSTER_NODE as NODE,
  STUDENT_ROSTER_SCREEN as SCREEN,
} from './config'
import type { RosterOption, StudentRosterModel } from './useStudentRoster'

const HEADER_ACTIONS = [
  { nodeId: NODE.uploadRoster, assetId: ASSET.uploadRoster },
  { nodeId: NODE.uploadDues, assetId: ASSET.uploadDues },
  { nodeId: NODE.exportRoster, assetId: ASSET.exportRoster },
] as const

export function StudentRosterActions({ onPress }: { onPress: (nodeId: string) => void }) {
  return (
    <span className="flex items-center gap-2">
      {HEADER_ACTIONS.map(({ nodeId, assetId }) => {
        const spec = elementByNodeId(org07a, nodeId).spec as ButtonSpec
        return (
          <button
            key={nodeId}
            type="button"
            data-node-id={nodeId}
            onClick={() => onPress(nodeId)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            <FigmaAsset screenId={SCREEN} nodeId={assetId} className="size-3.5" />
            {spec.label}
          </button>
        )
      })}
    </span>
  )
}

function UpdateBlock({ nodeId, spec, model }: { nodeId: string; spec: SummarySpec; model: StudentRosterModel }) {
  const item = spec.items![0]
  return (
    <span data-node-id={nodeId} className="block text-right">
      <span className="block text-xs font-semibold text-blue-700">{spec.title}</span>
      <span className="block pt-1 text-xs text-blue-600">{String(model.scopeRow[item.field!])}</span>
      <span className="block pt-0.5 text-xs text-blue-500">{String(model.scopeRow[item.descriptionField!])}</span>
    </span>
  )
}

interface RosterFilterProps {
  nodeId: string
  chevronId: string
  value: RosterOption | null
  onSelect: (option: RosterOption) => void
}

function RosterFilter({ nodeId, chevronId, value, onSelect }: RosterFilterProps) {
  const spec = elementByNodeId(org07a, nodeId).spec as SelectSpec
  return (
    <span data-node-id={nodeId} className="w-40">
      <label htmlFor={spec.fieldKey} className="sr-only">{spec.label}</label>
      <SearchSelect
        id={spec.fieldKey}
        placeholder={spec.placeholder}
        searchable={spec.searchable}
        disabled={false}
        sourceKey={spec.optionsSource.key}
        sourceParams={{}}
        value={value}
        onSelect={onSelect}
        chevron={<FigmaAsset screenId={SCREEN} nodeId={chevronId} className="size-4" />}
      />
    </span>
  )
}

export function StudentRosterView({ model }: { model: StudentRosterModel }) {
  const scopeItem = model.scope.items![0]
  return (
    <>
      <div className="flex items-start justify-between gap-6 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
        <span className="flex items-start gap-3">
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.scopeIcon} className="mt-0.5 size-4" />
          <span data-node-id={NODE.scope}>
            <span className="block text-xs font-semibold text-blue-700">{model.scope.title}</span>
            <span className="block pt-1 text-xs text-blue-600">{String(model.scopeRow[scopeItem.field!])}</span>
            <span className="block pt-0.5 text-xs text-blue-500">{String(model.scopeRow[model.scope.descriptionField!])}</span>
          </span>
        </span>
        <span className="flex shrink-0 gap-6 border-l border-blue-200 pl-6">
          <UpdateBlock nodeId={NODE.rosterUpdate} spec={model.rosterUpdate} model={model} />
          <UpdateBlock nodeId={NODE.duesUpdate} spec={model.duesUpdate} model={model} />
        </span>
      </div>

      <div className="flex items-center gap-3 pt-5">
        <span data-node-id={NODE.search} className="w-72">
          <label htmlFor={model.search.fieldKey} className="sr-only">{model.search.label}</label>
          <span className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-blue-600/50">
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.searchIcon} className="size-4 shrink-0" />
            <input
              id={model.search.fieldKey}
              type={model.search.inputType}
              value={model.query}
              placeholder={model.search.placeholder ?? model.search.label}
              onChange={(event) => model.changeQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
            />
          </span>
        </span>
        <RosterFilter nodeId={NODE.gradeFilter} chevronId={ASSET.gradeChevron} value={model.grade} onSelect={model.selectGrade} />
        <RosterFilter nodeId={NODE.duesFilter} chevronId={ASSET.duesChevron} value={model.dues} onSelect={model.selectDues} />
      </div>

      <div className="pt-4">
        <DataTable
          nodeId={NODE.students}
          label="학생 명단"
          columns={model.students.columns ?? []}
          rows={model.rows}
          emptyMessage={findDataSource(model.students.dataSourceKey).messages.empty}
          fieldPresentation={{ name: 'labelStrong', duesLabel: 'status' }}
          rowToneField={model.students.rowToneField}
          rowToneMark={<FigmaAsset screenId={SCREEN} nodeId={ASSET.rowMark} className="size-3.5" />}
        />
      </div>

      <div data-node-id={model.paging.source} className="flex items-center justify-between pt-4">
        <span className="text-sm text-gray-500">{String(model.pageInfo[model.paging.totalNoteField])}</span>
        <div className="flex items-center gap-1.5">
          <button type="button" data-design-state={model.page === 1 ? 'disabled' : undefined} disabled={model.page === 1} onClick={() => model.setPage((at) => Math.max(1, at - 1))} className={`rounded border border-gray-200 px-2 py-1 text-sm font-medium ${model.page === 1 ? 'text-gray-400' : 'text-gray-600 hover:bg-gray-50'}`}>이전</button>
          {Array.from({ length: Math.max(1, model.pageCount) }, (_, at) => at + 1).map((number) => (
            <button key={number} type="button" aria-current={number === model.page ? 'page' : undefined} onClick={() => model.setPage(number)} className={`rounded border px-2 py-1 text-sm font-medium ${number === model.page ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{number}</button>
          ))}
          <button type="button" data-design-state={model.page === model.pageCount ? 'disabled' : undefined} disabled={model.page === model.pageCount} onClick={() => model.setPage((at) => Math.min(model.pageCount, at + 1))} className={`rounded border border-gray-200 px-2 py-1 text-sm font-medium ${model.page === model.pageCount ? 'text-gray-400' : 'text-gray-600 hover:bg-gray-50'}`}>다음</button>
        </div>
      </div>

      {model.note === null ? null : <p role="status" className="pt-4 text-xs text-gray-500">{model.note}</p>}
    </>
  )
}
