import { FigmaAsset } from '../../components/FigmaAsset'
import type { DataRow } from '../../data-sources/definitions'
import { ROW_TONE } from '../../design/tones'
import { resolveParams } from '../../spec/params'
import { targetScreenOf } from '../../spec/types'
import { ASSET, NODE, SCREEN, listAt, summaryAt } from './survey-spec'
import { rowsOf, scalar } from './survey-values'

// 조건 줄이 톤 이름을 어떤 모습으로 옮기는지. design/tones.ts의 표들과 달리 이
// 자리에만 있어서 여기 둔다 - 두 번째 화면에서 다시 나오면 그때 올릴 자리다.
// (ROW_TONE은 줄 바탕만 갖고 있고, 여기서는 글자 색과 앞머리 그림까지 갈린다.)
const CONDITION_TONE: Record<
  string,
  { row: string; label: string; detail: string; icon: string }
> = {
  green: {
    row: '',
    label: 'text-gray-700',
    detail: 'text-gray-400',
    icon: ASSET.conditionMet,
  },
  red: {
    row: ROW_TONE.red,
    label: 'text-red-700',
    detail: 'text-red-500',
    icon: ASSET.conditionUnmet,
  },
}

interface SurveyConditionsProps {
  conditionGroups: DataRow[]
  activationRow: DataRow
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

// 충족 여부와 부족한 수는 서버가 정한다. 이곳은 표시와 보완 화면 이동을 맡는다.
export function SurveyConditions({ conditionGroups, activationRow, screenParams, onNavigate }: SurveyConditionsProps) {
  const conditions = listAt(NODE.conditions)
  const unmetNote = summaryAt(NODE.unmetNote)
  return (
    <section
      data-node-id={NODE.conditions}
      className="rounded-md border border-gray-200 bg-white px-3.5 py-3.5"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-gray-700">{conditions.title}</h3>
        <span
          data-node-id={NODE.unmetNote}
          className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-600"
        >
          {scalar(activationRow, (unmetNote.items ?? [])[0]?.field)}
        </span>
      </div>

      {conditionGroups.map((group) => (
        <div key={scalar(group, conditions.group!.headerFields![0].fields![0])}>
          <p className="pt-3.5 pb-1 text-xs font-semibold text-gray-400">
            {scalar(group, conditions.group!.headerFields![0].fields![0])}
          </p>
          <ul>
            {rowsOf(group, conditions.group!.itemsField).map((row) => {
              const columns = conditions.columns ?? []
              const tone =
                CONDITION_TONE[scalar(row, columns[0]?.toneField)] ?? CONDITION_TONE.green
              const label = scalar(row, columns[0]?.fields?.[0])
              const detail = scalar(row, columns[1]?.fields?.[0])
              const location = scalar(row, columns[2]?.fields?.[0])
              const action = conditions.itemAction
              const actionLabel =
                action?.labelField === undefined ? '' : scalar(row, action.labelField)
              return (
                <li
                  key={scalar(row, 'key')}
                  className={`flex items-start gap-2.5 border-b border-gray-50 px-2.5 py-2 last:border-b-0 ${tone.row}`}
                >
                  <FigmaAsset
                    screenId={SCREEN}
                    nodeId={tone.icon}
                    className="mt-0.5 size-3.5 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-xs font-medium ${tone.label}`}>
                      {label}
                    </span>
                    {detail === '' ? null : (
                      <span className={`block pt-0.5 text-xs ${tone.detail}`}>
                        {detail}
                      </span>
                    )}
                    {location === '' ? null : (
                      <span className="block pt-0.5 text-xs text-gray-400">{location}</span>
                    )}
                  </span>
                  {/* 채우러 가는 곳은 명세가 든다 - 데이터는 열쇠만 준다. */}
                  {actionLabel === '' || action === undefined ? null : (
                    <button
                      type="button"
                      onClick={() => {
                        if (action.type !== 'navigate') return
                        const target = targetScreenOf(action, row)
                        if (target !== null) {
                          onNavigate(
                            target,
                            resolveParams(action.params, { screenParams, row }),
                          )
                        }
                      }}
                      className="shrink-0 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-100"
                    >
                      {actionLabel}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
