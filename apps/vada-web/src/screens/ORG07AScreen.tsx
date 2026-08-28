import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DataTable } from '../components/DataTable'
import { FigmaAsset } from '../components/FigmaAsset'
import { SearchSelect } from '../components/SearchSelect'
import { findDataSource, readListSource, readObjectSource } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { elementByNodeId, org07a } from '../spec/screens'
import type { ButtonSpec, InputSpec, ItemListSpec, SelectSpec, SummarySpec } from '../spec/types'

// 학생 명단 관리(ORG-07A).
//
// 여기서 처음인 것은 **줄 전체의 색**이다(itemList.rowToneField). 지금까지 색은
// 칸 하나의 딱지였는데, 이 명단은 손봐야 하는 학생의 줄을 통째로 옅게 칠하고
// 이름 옆에 표시를 붙인다 — 명단과 납부 기록이 어긋난 줄이다.
//
// **명세가 말하는 것은 '이 줄은 다른 줄과 다르다'와 그것을 아는 조각뿐이다.**
// 바탕을 칠할지 표시를 붙일지는 design이 정한다.
//
// 이 명단은 학생회 구성원과 다르다 — 단과대학 학생 전체이고, 행사 참가 확인과
// 학생회비 조회에 쓴다(ORG-00의 카드가 그렇게 말한다).

const SCREEN = 'ORG-07A'

const NODE = {
  breadcrumb: '30:5457',
  uploadRoster: '30:5468',
  uploadDues: '30:5474',
  exportRoster: '30:5480',
  scope: '30:5494',
  rosterUpdate: '30:5502',
  duesUpdate: '30:5509',
  search: '30:5517',
  gradeFilter: '30:5523',
  duesFilter: '30:5527',
  students: '30:5531',
} as const

const ASSET = {
  breadcrumbSeparator: '30:5461',
  scopeIcon: '30:5489',
  searchIcon: '30:5518',
  gradeChevron: '30:5525',
  duesChevron: '30:5529',
  uploadRoster: '30:5469',
  uploadDues: '30:5475',
  exportRoster: '30:5481',
  // 손봐야 하는 줄의 이름 옆에 붙는 표시.
  rowMark: '30:5575',
} as const

interface ORG07AScreenProps {
  onNavigate: (screenId: string) => void
}

export function ORG07AScreen({ onNavigate }: ORG07AScreenProps) {
  const scope = elementByNodeId(org07a, NODE.scope).spec as SummarySpec
  const rosterUpdate = elementByNodeId(org07a, NODE.rosterUpdate).spec as SummarySpec
  const duesUpdate = elementByNodeId(org07a, NODE.duesUpdate).spec as SummarySpec
  const search = elementByNodeId(org07a, NODE.search).spec as InputSpec
  const students = elementByNodeId(org07a, NODE.students).spec as ItemListSpec
  const paging = students.paging!

  const [note, setNote] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [grade, setGrade] = useState<{ value: string; label: string } | null>(null)
  const [dues, setDues] = useState<{ value: string; label: string } | null>(null)
  const [page, setPage] = useState(1)

  // 거르는 값은 조회 인자다 — 받아온 것을 화면에서 거르지 않는다.
  const fieldValues: Record<string, string> = {
    [search.fieldKey]: query,
    studentGrade: grade?.value ?? '',
    studentDues: dues?.value ?? '',
  }

  const scopeRow = readObjectSource(scope.dataSourceKey)
  const rows = readListSource(students.dataSourceKey, {
    ...resolveParams(students.params, { fields: fieldValues }),
    [paging.pageParam]: String(page),
  })
  const pageInfo = readObjectSource(
    paging.dataSourceKey,
    resolveParams(paging.params, { fields: fieldValues }),
  )
  const pageCount = Number(pageInfo[paging.pageCountField])

  const breadcrumb = org07a.breadcrumb

  const headerButton = (nodeId: string, assetId: string) => {
    const spec = elementByNodeId(org07a, nodeId).spec as ButtonSpec
    return (
      <button
        type="button"
        data-node-id={nodeId}
        onClick={() => {
          // 아직 정해지지 않은 자리는 그 사실을 남기고, 정해진 자리는 그리로 간다.
          if (spec.action.type === 'pending') setNote(spec.action.note)
          if (spec.action.type === 'navigate') onNavigate(spec.action.targetScreenId)
        }}
        className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
      >
        <FigmaAsset screenId={SCREEN} nodeId={assetId} className="size-3.5" />
        {spec.label}
      </button>
    )
  }

  const filter = (nodeId: string, chevron: string, value: typeof grade, set: typeof setGrade) => {
    const spec = elementByNodeId(org07a, nodeId).spec as SelectSpec
    return (
      <span data-node-id={nodeId} className="w-40">
        <label htmlFor={spec.fieldKey} className="sr-only">
          {spec.label}
        </label>
        <SearchSelect
          id={spec.fieldKey}
          placeholder={spec.placeholder}
          searchable={spec.searchable}
          disabled={false}
          sourceKey={spec.optionsSource.key}
          sourceParams={{}}
          value={value}
          onSelect={(option) => {
            set({ value: option.value, label: option.label })
            setPage(1)
          }}
          chevron={<FigmaAsset screenId={SCREEN} nodeId={chevron} className="size-4" />}
        />
      </span>
    )
  }

  const updateBlock = (nodeId: string, spec: SummarySpec) => {
    const item = spec.items![0]
    return (
      <span data-node-id={nodeId} className="block text-right">
        <span className="block text-xs font-semibold text-blue-700">{spec.title}</span>
        <span className="block pt-1 text-xs text-blue-600">{String(scopeRow[item.field!])}</span>
        <span className="block pt-0.5 text-xs text-blue-500">
          {String(scopeRow[item.descriptionField!])}
        </span>
      </span>
    )
  }

  return (
    <AppShell
      screenId={org07a.screenId}
      activeNavigationScreenId={org07a.activeNavigationScreenId}
      eyebrow={org07a.meta?.eyebrow}
      title={org07a.meta?.title ?? org07a.screenId}
      onNavigate={onNavigate}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={[ASSET.breadcrumbSeparator]}
            items={breadcrumb.items.map((item) => item.value ?? '')}
          />
        )
      }
      headerAction={
        <span className="flex items-center gap-2">
          {headerButton(NODE.uploadRoster, ASSET.uploadRoster)}
          {headerButton(NODE.uploadDues, ASSET.uploadDues)}
          {headerButton(NODE.exportRoster, ASSET.exportRoster)}
        </span>
      }
    >
      <div className="flex items-start justify-between gap-6 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
        <span className="flex items-start gap-3">
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.scopeIcon} className="mt-0.5 size-4" />
          <span data-node-id={NODE.scope}>
            <span className="block text-xs font-semibold text-blue-700">{scope.title}</span>
            <span className="block pt-1 text-xs text-blue-600">
              {String(scopeRow[scope.items![0].field!])}
            </span>
            <span className="block pt-0.5 text-xs text-blue-500">
              {String(scopeRow[scope.descriptionField!])}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 gap-6 border-l border-blue-200 pl-6">
          {updateBlock(NODE.rosterUpdate, rosterUpdate)}
          {updateBlock(NODE.duesUpdate, duesUpdate)}
        </span>
      </div>

      <div className="flex items-center gap-3 pt-5">
        <span data-node-id={NODE.search} className="w-72">
          <label htmlFor={search.fieldKey} className="sr-only">
            {search.label}
          </label>
          {/* design은 돋보기와 입력칸을 한 테두리 안에 함께 담는다(MY-01과 같다). */}
          <span className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-blue-600/50">
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.searchIcon} className="size-4 shrink-0" />
            <input
              id={search.fieldKey}
              type={search.inputType}
              value={query}
              placeholder={search.placeholder ?? search.label}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              className="min-w-0 flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
            />
          </span>
        </span>
        {filter(NODE.gradeFilter, ASSET.gradeChevron, grade, setGrade)}
        {filter(NODE.duesFilter, ASSET.duesChevron, dues, setDues)}
      </div>

      <div className="pt-4">
        <DataTable
          nodeId={NODE.students}
          label="학생 명단"
          columns={students.columns ?? []}
          rows={rows}
          emptyMessage={findDataSource(students.dataSourceKey).messages.empty}
          fieldPresentation={{ name: 'labelStrong', duesLabel: 'status' }}
          rowToneField={students.rowToneField}
          rowToneMark={
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.rowMark} className="size-3.5" />
          }
        />
      </div>

      {/* 쪽 줄은 표와 형제다 — 둘을 함께 품는 노드가 없어 명세가 자리를 따로 갖는다. */}
      <div
        data-node-id={paging.source}
        className="flex items-center justify-between pt-4"
      >
        <span className="text-sm text-gray-500">{String(pageInfo[paging.totalNoteField])}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-design-state={page === 1 ? 'disabled' : undefined}
            disabled={page === 1}
            onClick={() => setPage((at) => Math.max(1, at - 1))}
            className={`rounded border border-gray-200 px-2 py-1 text-sm font-medium ${
              page === 1 ? 'text-gray-400' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            이전
          </button>
          {Array.from({ length: Math.max(1, pageCount) }, (_, at) => at + 1).map((number) => (
            <button
              key={number}
              type="button"
              aria-current={number === page ? 'page' : undefined}
              onClick={() => setPage(number)}
              className={`rounded border px-2 py-1 text-sm font-medium ${
                number === page
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {number}
            </button>
          ))}
          <button
            type="button"
            data-design-state={page === pageCount ? 'disabled' : undefined}
            disabled={page === pageCount}
            onClick={() => setPage((at) => Math.min(pageCount, at + 1))}
            className={`rounded border border-gray-200 px-2 py-1 text-sm font-medium ${
              page === pageCount ? 'text-gray-400' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            다음
          </button>
        </div>
      </div>

      {note === null ? null : (
        <p role="status" className="pt-4 text-xs text-gray-500">
          {note}
        </p>
      )}
    </AppShell>
  )
}
