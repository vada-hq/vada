import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { FigmaAsset } from '../components/FigmaAsset'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import { NEUTRAL_BORDER, SOFT_BOX, SOFT_BOX_TEXT } from '../design/tones'
import { readListSource, readObjectSource } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, evt02 } from '../spec/screens'
import { targetScreenOf } from '../spec/types'
import type { ButtonSpec, ItemListSpec, SummarySpec } from '../spec/types'

// 행사 개요(EVT-02).
//
// 행사 작업 공간의 **두 번째** 화면이다. 그래서 갈피 줄·상태 줄·제목이 여기 없다 —
// 일곱 화면이 똑같이 그리는 것이라 shell.json의 작업 공간으로 옮겼고, 이 화면은
// 어디에 그리는지(nodeId)만 명세에 적는다.
//
// 읽기만 하는 화면이다. 고치는 것은 전부 다른 화면이 한다(모집 설정은 참여 설문
// 화면이, 업무는 업무 보드가).

const SCREEN = 'EVT-02'

const NODE = {
  briefing: '20:4807',
  highlights: ['20:4819', '20:4826', '20:4833'],
  basics: '20:4842',
  recruit: '20:4882',
  recruitEdit: '20:4886',
  stats: '20:4910',
  checklist: '20:4939',
  changes: '20:4988',
} as const

const ASSET = {
  briefing: '20:4808',
  workspaceStatus: { startAt: '20:4793' } as Record<string, string>,
  // 확인해야 할 항목의 아이콘은 그 항목의 성격이 정한다. 순서에 기대지 않는다 —
  // 개수도 순서도 데이터가 정하기 때문이다.
  checklistByTone: {
    yellow: '20:4944',
    orange: '20:4957',
    red: '20:4967',
    green: '20:4980',
  } as Record<string, string>,
} as const

// 카드와 타일의 색. 카드가 명세에 고정이므로 색도 화면이 안다 — 부서 색처럼
// 늘어나는 것이 아니다(EVT-00A의 INFO_CHIP과 같은 판단이다).
const HIGHLIGHT_TONE: Record<string, string> = {
  '20:4819': 'red',
  '20:4826': 'yellow',
  '20:4833': 'blue',
}
const STAT_TONE: Record<string, string> = {
  applicants: 'blue',
  paid: 'green',
  needsCheck: 'yellow',
  unassignedTasks: 'red',
}
interface EVT02ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EVT02Screen({ screenParams, onNavigate }: EVT02ScreenProps) {
  const [note, setNote] = useState<string | null>(null)

  const missing = (evt02.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <AppShell
        screenId={evt02.screenId}
        activeNavigationScreenId={evt02.activeNavigationScreenId}
        eyebrow={evt02.meta?.eyebrow}
        title={evt02.meta?.title ?? evt02.screenId}
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

  const argumentsOf = (params: SummarySpec['params']) => resolveParams(params, { screenParams })
  const readSummary = (nodeId: string) => {
    const spec = elementByNodeId(evt02, nodeId).spec as SummarySpec
    return {
      spec,
      row: readObjectSource(spec.dataSourceKey ?? '', argumentsOf(spec.params)),
    }
  }

  const briefing = readSummary(NODE.briefing)
  const basics = readSummary(NODE.basics)
  const recruit = readSummary(NODE.recruit)
  const stats = readSummary(NODE.stats)
  const recruitEdit = elementByNodeId(evt02, NODE.recruitEdit).spec as ButtonSpec
  const checklistSpec = elementByNodeId(evt02, NODE.checklist).spec as ItemListSpec
  const changesSpec = elementByNodeId(evt02, NODE.changes).spec as ItemListSpec
  const checklist = readListSource(checklistSpec.dataSourceKey, argumentsOf(checklistSpec.params))
  const changes = readListSource(changesSpec.dataSourceKey, argumentsOf(changesSpec.params))

  return (
    <AppShell
      screenId={evt02.screenId}
      activeNavigationScreenId={evt02.activeNavigationScreenId}
      eyebrow={evt02.meta?.eyebrow}
      title={drawnTitleOf(evt02, screenParams)}
      onNavigate={onNavigate}
    >
      <WorkspaceHeader
        screen={evt02}
        screenParams={screenParams}
        onNavigate={onNavigate}
        onPending={setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
      />

      {note === null ? null : (
        <p role="status" className="pt-4 text-xs font-medium text-gray-500">
          {note}
        </p>
      )}

      {/* 안내. 라벨이 없다 — 서버가 문장을 완성해 준다. */}
      <div
        data-node-id={NODE.briefing}
        className={`mt-6 flex gap-3 rounded-xl border p-4 ${SOFT_BOX.blue}`}
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.briefing} className="mt-0.5 size-3.5" />
        <span>
          {(briefing.spec.items ?? []).map((item, at) => (
            <span
              key={item.field}
              className={
                at === 0
                  ? 'block text-sm text-blue-800'
                  : 'block pt-1 text-xs text-blue-600'
              }
            >
              {String(briefing.row[item.field ?? ''])}
            </span>
          ))}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-3">
        {NODE.highlights.map((nodeId) => {
          const spec = elementByNodeId(evt02, nodeId).spec as SummarySpec
          const row = readObjectSource(spec.dataSourceKey ?? '', argumentsOf(spec.params))
          const tone = HIGHLIGHT_TONE[nodeId]
          const item = (spec.items ?? [])[0]
          return (
            <button
              key={nodeId}
              type="button"
              data-node-id={nodeId}
              onClick={() => {
                if (spec.action?.type === 'navigate') {
                  onNavigate(
                    targetScreenOf(spec.action, row) ?? spec.action.type,
                    resolveParams(spec.action.params, { screenParams }),
                  )
                  return
                }
                if (spec.action?.type === 'pending') setNote(spec.action.note)
              }}
              className={`rounded-xl border p-4 text-left hover:brightness-[0.98] focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none ${
                SOFT_BOX[tone] ?? NEUTRAL_BORDER
              }`}
            >
              {/* 카드의 라벨과 부연은 무채색이고, 색이 붙는 것은 값뿐이다. */}
              <span className="block text-xs font-medium text-gray-500">{spec.title}</span>
              <span
                data-design-rule="soft-box-value"
                className={`block pt-1 text-xl font-bold ${SOFT_BOX_TEXT[tone]?.value}`}
              >
                {String(row[item?.field ?? ''])}
              </span>
              {/* design은 부연과 화살표를 한 텍스트 노드로 그린다 — 쪼개지 않는다. */}
              <span className="block pt-1.5 text-xs font-medium text-gray-500">
                {`${String(row[item?.descriptionField ?? ''])} →`}
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 pt-3 lg:grid-cols-[334fr_685fr]">
        <div className="flex flex-col gap-3">
          <LabelledCard nodeId={NODE.basics} spec={basics.spec} row={basics.row} />
          <LabelledCard
            nodeId={NODE.recruit}
            spec={recruit.spec}
            row={recruit.row}
            action={
              <button
                type="button"
                data-node-id={NODE.recruitEdit}
                onClick={() => {
                  // 설문 화면(EVT-05)이 그 뒤에 만들어졌다. 갈 곳이 생겼는데
                  // 안내만 내놓고 있던 자리다.
                  if (recruitEdit.action.type === 'pending') {
                    setNote(recruitEdit.action.note)
                  } else if (
                    recruitEdit.action.type === 'navigate' &&
                    'targetScreenId' in recruitEdit.action
                  ) {
                    onNavigate(
                      recruitEdit.action.targetScreenId,
                      resolveParams(recruitEdit.action.params, { screenParams }),
                    )
                  }
                }}
                className="text-xs font-medium text-blue-500 hover:text-blue-700"
              >
                {recruitEdit.label}
              </button>
            }
          />
        </div>

        <div className="flex flex-col gap-3">
          {/* 참가 현황 타일 넷. 값 아래에 보조 문구가 붙는다 — 값과 크기·색이 다르다. */}
          <div data-node-id={NODE.stats} className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(stats.spec.items ?? []).map((item) => {
              const tone = STAT_TONE[item.field ?? ''] ?? 'blue'
              return (
                <span
                  key={item.label}
                  className={`block rounded-xl border p-3 ${SOFT_BOX[tone] ?? NEUTRAL_BORDER}`}
                >
                  <span className={`block text-xs font-medium ${SOFT_BOX_TEXT[tone]?.label}`}>
                    {item.label}
                  </span>
                  <span
                    data-design-rule="soft-box-value"
                    className={`block pt-1 text-xl font-bold ${SOFT_BOX_TEXT[tone]?.value}`}
                  >
                    {String(stats.row[item.field ?? ''])}
                  </span>
                  <span className={`block pt-1.5 text-xs ${SOFT_BOX_TEXT[tone]?.note}`}>
                    {String(stats.row[item.descriptionField ?? ''])}
                  </span>
                </span>
              )
            })}
          </div>

          <section
            data-node-id={NODE.checklist}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <h2 className="text-sm font-semibold text-gray-700">{checklistSpec.title}</h2>
            <ul className="pt-2">
              {checklist.map((row) => (
                <li key={String(row.title)} className="flex items-start gap-3 rounded border border-gray-50 py-2.5">
                  <FigmaAsset
                    screenId={SCREEN}
                    nodeId={ASSET.checklistByTone[String(row.tone)] ?? ASSET.checklistByTone.red}
                    className="mt-0.5 size-3"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-gray-800">
                      {String(row.title)}
                    </span>
                    <span className="block pt-1 text-xs text-gray-400">
                      {String(row.detail)}
                    </span>
                  </span>
                  {/* 갈 곳이 있는 항목만 문구가 온다. 문구는 항목이 정한다. */}
                  {row[checklistSpec.itemAction?.labelField ?? ''] === undefined ? null : (
                    <button
                      type="button"
                      onClick={() => {
                        const action = checklistSpec.itemAction
                        if (action === undefined) return
                        if (action.type === 'pending') {
                          setNote(action.note)
                          return
                        }
                        // 항목마다 가는 곳이 다르다. 명세가 갈래를 들고 데이터가
                        // 열쇠를 준다 — 데이터가 화면 이름을 주면 없는 화면을
                        // 가리켜도 아무도 모른다.
                        const target = targetScreenOf(action, row)
                        if (target === null) {
                          setNote(
                            `이 항목이 어디로 가는지 명세의 갈래에 없습니다: ${String(
                              row[(action as { targetField?: string }).targetField ?? ''] ?? '',
                            )}`,
                          )
                          return
                        }
                        onNavigate(target, argumentsOf(action.params))
                      }}
                      className="shrink-0 text-xs font-medium text-blue-500 hover:text-blue-700"
                    >
                      {`${String(row[checklistSpec.itemAction?.labelField ?? ''])} →`}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section
            data-node-id={NODE.changes}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <h2 className="text-sm font-semibold text-gray-700">{changesSpec.title}</h2>
            <ul className="pt-2">
              {changes.map((row) => (
                <li key={String(row.title)} className="flex gap-3 py-1">
                  <span className="w-20 shrink-0 text-xs text-gray-400">{String(row.at)}</span>
                  <span className="text-xs text-gray-700">{String(row.title)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </AppShell>
  )
}

// 라벨-값 쌍이 명세에 고정인 카드. 행사 기본 정보와 모집 설정이 같은 모양이다.
function LabelledCard({
  nodeId,
  spec,
  row,
  action,
}: {
  nodeId: string
  spec: SummarySpec
  row: Record<string, unknown>
  action?: React.ReactNode
}) {
  return (
    <section
      data-node-id={nodeId}
      className="rounded-xl border border-gray-200 bg-white p-4"
    >
      <h2 className="flex items-center justify-between gap-2 text-sm font-semibold text-gray-700">
        <span>{spec.title}</span>
        {action}
      </h2>
      <dl className="pt-2">
        {(spec.items ?? []).map((item) => (
          <span key={item.label} className="flex gap-3 py-1.5">
            <dt className="w-20 shrink-0 text-xs text-gray-400">{item.label}</dt>
            <dd className="text-xs text-gray-700">{String(row[item.field ?? ''])}</dd>
          </span>
        ))}
      </dl>
    </section>
  )
}
