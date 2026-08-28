import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { FigmaAsset } from '../components/FigmaAsset'
import { FilterSelect } from '../components/FilterSelect'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import { NEUTRAL_CHIP, STATE_CHIP } from '../design/tones'
import { findDataSource, readListSource, readObjectSource } from '../data-sources/catalog'
import type { Option } from '../option-sources/catalog'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, evt04 } from '../spec/screens'
import type { ButtonSpec, InputSpec, ItemListSpec, SelectSpec } from '../spec/types'

// 행사 참가자 명단(EVT-04).
//
// 행사 작업 공간의 **여섯 번째** 화면이고, 지금까지 중 가장 큰 화면이다. 처음인
// 것이 셋이다.
//
// 1. **상태 줄에 행동이 온다.** 다른 다섯 화면은 그 자리에 '행사 관리 행동은 담당
//    운영진에게 제공됩니다'라는 안내를 그린다 — 그 문구가 바로 이 자리의 임자가
//    누구인지 말하고 있었다. 운영진이 보는 이 화면에서는 안내 대신 행동이 온다.
//    자리는 하나이고 셸의 headerAction과 같은 규칙이다: 그리는 자리만 공간이 갖고
//    무엇을 그릴지는 화면이 준다.
// 2. **목록이 쪽으로 나뉜다.** 한 쪽만큼만 받아 오므로 총 몇 명인지·몇 쪽인지는
//    목록이 말할 수 없어 그것을 아는 출처가 따로 있다(itemList.paging).
// 3. **항목을 여럿 고른다.** 고른 다음 무엇을 하는지는 디자인에 없어 pending이다 —
//    고르기만 그리고 무엇을 하는지는 모른다고 적는다.

const SCREEN = 'EVT-04'

const NODE = {
  survey: '20:7605',
  qr: '20:7607',
  export: '20:7622',
  editBasics: '20:7671',
  startEvent: '20:7673',
  staffTab: '20:7678',
  participantsTab: '20:7681',
  search: '20:7689',
  affiliation: '20:7691',
  applyStatus: '20:7695',
  payStatus: '20:7699',
  attendStatus: '20:7703',
  table: '20:7707',
} as const

const ASSET = {
  workspaceStatus: { startAt: '20:7661' } as Record<string, string>,
  qr: '20:7608',
  export: '20:7623',
  // 거르기 넷의 화살표. 자리마다 다른 노드라 넷을 다 지목한다.
  chevron: {
    affiliation: '20:7693',
    applyStatus: '20:7697',
    payStatus: '20:7701',
    attendStatus: '20:7705',
  },
  // 표의 두 그림. 줄마다 같은 그림이 다른 노드로 있어 첫 줄의 것만 지목한다.
  nameAlert: '20:7727',
  rowMenu: '20:7739',
} as const

// 열 폭은 명세의 것이 아니다 — 명세는 무엇이 어느 열에 오는지만 말한다.
// design(20:7709)이 그린 비율을 화면이 안다.
const COLUMN_WIDTH = [
  'flex-1',
  'w-32 shrink-0',
  'w-32 shrink-0',
  'w-24 shrink-0',
  'w-24 shrink-0',
  'w-24 shrink-0',
] as const

interface EVT04ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EVT04Screen({ screenParams, onNavigate }: EVT04ScreenProps) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Record<string, Option>>({})
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState<string[]>([])
  const [note, setNote] = useState<string | null>(null)

  const missing = (evt04.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <AppShell
        screenId={evt04.screenId}
        activeNavigationScreenId={evt04.activeNavigationScreenId}
        eyebrow={evt04.meta?.eyebrow}
        title={evt04.meta?.title ?? evt04.screenId}
        onNavigate={onNavigate}
      >
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {missing.map((param) => param.missingNote).join(' ')}
        </p>
      </AppShell>
    )
  }

  const buttonAt = (nodeId: string) => elementByNodeId(evt04, nodeId).spec as ButtonSpec
  const pend = (spec: { action: ButtonSpec['action'] }) => () => {
    if (spec.action.type === 'pending') setNote(spec.action.note)
  }

  const searchSpec = elementByNodeId(evt04, NODE.search).spec as InputSpec
  const table = elementByNodeId(evt04, NODE.table).spec as ItemListSpec
  const paging = table.paging!

  // 거르는 값은 전부 화면 필드다. 명세가 어느 필드를 가리키는지 말하므로
  // 화면이 이름을 다시 적지 않는다.
  const fieldValues: Record<string, string> = {
    [searchSpec.fieldKey]: query,
    ...Object.fromEntries(
      Object.entries(filters).map(([fieldKey, option]) => [fieldKey, option.value]),
    ),
  }
  const listParams = resolveParams(table.params, { screenParams, fields: fieldValues })
  const rows = readListSource(table.dataSourceKey, {
    ...listParams,
    [paging.pageParam]: String(page),
  })
  const pageInfo = readObjectSource(
    paging.dataSourceKey,
    resolveParams(paging.params, { screenParams, fields: fieldValues }),
  )
  const pageCount = Number(pageInfo[paging.pageCountField])

  function setFilter(fieldKey: string, option: Option) {
    setFilters((previous) => ({ ...previous, [fieldKey]: option }))
    setPage(1)
  }

  const filterOf = (nodeId: string) => {
    const spec = elementByNodeId(evt04, nodeId).spec as SelectSpec
    return {
      spec,
      value: filters[spec.fieldKey] ?? null,
      onSelect: (option: Option) => setFilter(spec.fieldKey, option),
      sourceParams: resolveParams(spec.optionsSource.params, { screenParams }),
    }
  }

  return (
    <AppShell
      screenId={evt04.screenId}
      activeNavigationScreenId={evt04.activeNavigationScreenId}
      eyebrow={evt04.meta?.eyebrow}
      title={drawnTitleOf(evt04, screenParams)}
      onNavigate={onNavigate}
      headerAction={
        <div className="flex gap-2">
          {[
            { nodeId: NODE.survey, asset: null },
            { nodeId: NODE.qr, asset: ASSET.qr },
            { nodeId: NODE.export, asset: ASSET.export },
          ].map(({ nodeId, asset }) => {
            const spec = buttonAt(nodeId)
            return (
              <button
                key={nodeId}
                type="button"
                data-node-id={nodeId}
                onClick={pend(spec)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                {asset === null ? null : (
                  <FigmaAsset screenId={SCREEN} nodeId={asset} className="size-3" />
                )}
                {spec.label}
              </button>
            )
          })}
        </div>
      }
    >
      <WorkspaceHeader
        screen={evt04}
        screenParams={screenParams}
        onNavigate={onNavigate}
        onPending={setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
        actions={
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              data-node-id={NODE.editBasics}
              onClick={pend(buttonAt(NODE.editBasics))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {buttonAt(NODE.editBasics).label}
            </button>
            <button
              type="button"
              data-node-id={NODE.startEvent}
              onClick={pend(buttonAt(NODE.startEvent))}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              {buttonAt(NODE.startEvent).label}
            </button>
          </div>
        }
      />

      {/* 인원 관리 안에서 다시 둘로 갈린다 — 작업 공간의 갈피보다 한 층 안쪽이다.
          갈피마다 다른 화면이므로 고르는 것이 아니라 옮겨 가는 것이다. */}
      <div className="-mx-8 flex gap-2 border-b border-gray-200 px-8 pt-6">
        {([NODE.staffTab, NODE.participantsTab] as const).map((nodeId) => {
          const spec = buttonAt(nodeId)
          const here = spec.initiallyDisabled
          return (
            <button
              key={nodeId}
              type="button"
              data-node-id={nodeId}
              disabled={here}
              aria-current={here ? 'page' : undefined}
              onClick={() => {
                if (spec.action.type === 'navigate') {
                  onNavigate(
                    spec.action.targetScreenId,
                    resolveParams(spec.action.params, { screenParams }),
                  )
                }
              }}
              className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-medium ${
                here
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {spec.label}
            </button>
          )
        })}
      </div>

      {note === null ? null : (
        <p role="status" className="pt-3 text-xs font-medium text-gray-500">
          {note}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-4">
        <input
          data-node-id={NODE.search}
          type={searchSpec.inputType}
          aria-label={searchSpec.label}
          // design이 빈 칸에 그린 글은 안내 문구다 — 라벨 노드가 따로 없다.
          placeholder={searchSpec.placeholder ?? searchSpec.label}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setPage(1)
          }}
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
          const filter = filterOf(nodeId)
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

      <div
        data-node-id={NODE.table}
        className="mt-4 overflow-hidden rounded border border-gray-200 bg-white"
      >
        <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
          {/* 머리의 칸은 이 쪽의 줄을 한꺼번에 고른다. */}
          <input
            type="checkbox"
            aria-label={`이 쪽의 참가자 모두 ${table.selection?.action.label ?? ''}`}
            checked={picked.length > 0 && picked.length === rows.length}
            onChange={(event) =>
              setPicked(event.target.checked ? rows.map((row) => String(row.id)) : [])
            }
            className="size-3.5 shrink-0 rounded border-gray-400"
          />
          {(table.columns ?? []).map((column, at) => (
            <span
              key={column.label}
              className={`text-xs font-medium text-gray-500 ${COLUMN_WIDTH[at]}`}
            >
              {column.label}
            </span>
          ))}
          <span className="w-6 shrink-0" />
        </div>

        {rows.length === 0 ? (
          <p data-design-state="empty" className="px-4 py-6 text-xs text-gray-400">
            {findDataSource(table.dataSourceKey).messages.empty}
          </p>
        ) : (
          <ul>
            {rows.map((row) => {
              const id = String(row.id)
              return (
                <li
                  key={id}
                  className="flex items-center gap-3 border-b border-gray-100 bg-yellow-50 px-4 py-3 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    aria-label={`${String(row.name)} 고르기`}
                    checked={picked.includes(id)}
                    onChange={(event) =>
                      setPicked((previous) =>
                        event.target.checked
                          ? [...previous, id]
                          : previous.filter((other) => other !== id),
                      )
                    }
                    className="size-3.5 shrink-0 rounded border-gray-400"
                  />
                  <span className={`flex items-center gap-1.5 ${COLUMN_WIDTH[0]}`}>
                    <span className="text-xs font-medium text-gray-900">
                      {String(row.name)}
                    </span>
                    <FigmaAsset
                      screenId={SCREEN}
                      nodeId={ASSET.nameAlert}
                      className="size-3 shrink-0"
                    />
                  </span>
                  <span className={`text-xs text-gray-600 ${COLUMN_WIDTH[1]}`}>
                    {String(row.studentNo)}
                  </span>
                  <span className={`text-xs text-gray-600 ${COLUMN_WIDTH[2]}`}>
                    {String(row.affiliation)}
                  </span>
                  {(
                    [
                      ['applyStatus', 'applyStatusTone', 3],
                      ['payStatus', 'payStatusTone', 4],
                      ['attendStatus', 'attendStatusTone', 5],
                    ] as const
                  ).map(([field, toneField, at]) => (
                    <span key={field} className={COLUMN_WIDTH[at]}>
                      <span
                        data-design-rule="state-chip"
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                          STATE_CHIP[String(row[toneField])] ?? NEUTRAL_CHIP
                        }`}
                      >
                        {String(row[field])}
                      </span>
                    </span>
                  ))}
                  <button
                    type="button"
                    aria-label={`${String(row.name)} ${table.itemAction?.label ?? ''}`}
                    onClick={() => {
                      if (table.itemAction?.type === 'pending') setNote(table.itemAction.note)
                    }}
                    className="w-6 shrink-0 rounded p-1 hover:bg-gray-100"
                  >
                    <FigmaAsset
                      screenId={SCREEN}
                      nodeId={ASSET.rowMenu}
                      className="size-3.5"
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {picked.length === 0 ? null : (
        <button
          type="button"
          onClick={() => {
            if (table.selection?.action.type === 'pending') {
              setNote(table.selection.action.note)
            }
          }}
          className="mt-3 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {`${table.selection?.action.label ?? ''} ${picked.length}명`}
        </button>
      )}

      {/* 쪽 줄은 표와 다른 자리에 그려진다 — 명세가 그 자리를 따로 갖는다. */}
      <div
        data-node-id={paging.source}
        className="flex items-center justify-between pt-3"
      >
        <span className="text-xs text-gray-500">
          {String(pageInfo[paging.totalNoteField])}
        </span>
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
    </AppShell>
  )
}
