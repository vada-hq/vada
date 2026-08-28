import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import {
  BANNER_TEXT,
  CONFIRM_NOTE,
  DANGER_BUTTON,
  NEUTRAL_CHIP,
  STATE_CHIP,
} from '../design/tones'
import { readFieldRows, readObjectSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { getOptionSource } from '../option-sources/catalog'
import type { Option } from '../option-sources/catalog'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, evt05b } from '../spec/screens'
import { useFieldDraft } from '../spec/useFieldDraft'
import { useSubmitAction } from '../spec/useSubmitAction'
import { columnFieldOf } from '../spec/types'
import type { ButtonSpec, ItemListSpec, SelectSpec, SubmitAction, SummarySpec } from '../spec/types'
import type { ScopeDraft } from '../state/scopes'

// 설문 교체(EVT-05B). **응답이 있는 설문은 직접 고칠 수 없다** — 그래서 고치는
// 대신 새 설문으로 갈아 끼우고, 그 여파를 서버가 세어 준다.
//
// **겹쳐 뜨는 화면이 아니다.** 이 와이어프레임의 모달은 예외 없이 뒤에 남는 화면을
// 형제 프레임으로 함께 그리고 그 위에 검은 막(opacity 0.4)을 깐다. 여기에는 그
// 구조가 없다 - 셸·갈피 줄·상태 줄이 이 프레임 안에 그려져 있고 카드가 본문 자리
// 가운데에 놓인다. 그래서 overlay가 아니라 제 셸을 그리는 화면이다(EVT-01과 같다).
//
// 카드 가운데의 점 넷('기존 설문은 교체됨 상태로 변경됩니다' 등)은
// event.surveyReplaceImpact의 `notes[]`다. **한 건을 조회하고 그 안의 조각을 항목으로
// 받는다**(itemList의 dataSourceKey + itemsField) — 이 꼴이 없던 동안 이 화면과
// OPS-MEET-06A·EXT-02B가 그림에 있는 글을 못 그렸다.
//
// **점은 그림이다.** 그림이 기호를 글과 다른 노드로 그렸고(25:1146), 무엇으로 앞을
// 세울지는 표현이라 명세가 정하지 않는다 — EXT-02B는 같은 자리를 글 안에 담았다.

const SCREEN = 'EVT-05B'

const NODE = {
  statusChip: '25:1074',
  editBasics: '25:1119',
  startEvent: '25:1121',
  head: '25:1126',
  impact: '25:1132',
  notes: '25:1143',
  mode: '25:1160',
  cancel: '25:1182',
  replace: '25:1184',
} as const

const ASSET = {
  workspaceStatus: { startAt: '25:1109' } as Record<string, string>,
} as const

const BREADCRUMB_SEPARATORS = ['25:1058', '25:1063', '25:1068']

interface EVT05BScreenProps {
  screenParams: Record<string, string>
  /** 명세가 stateScopeKey로 말한 자리(eventSurveyReplaceDraft). */
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

function scalar(row: DataRow, field: string | undefined): string {
  const value = row[field ?? '']
  if (value === undefined || Array.isArray(value)) {
    return ''
  }
  return String(value)
}

export function EVT05BScreen({
  screenParams,
  draft: scopeDraft,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
}: EVT05BScreenProps) {
  const submitAction = useSubmitAction()
  const [note, setNote] = useState<string | null>(null)

  const mode = elementByNodeId(evt05b, NODE.mode).spec as SelectSpec
  const modeSource = getOptionSource(mode.optionsSource.key)
  const modeOptions: Option[] = modeSource.type === 'static' ? modeSource.options : []

  // 명세가 정한 처음 값(select.initialValue). 스코프에 담아 두어야 보내는 값에도
  // 실린다 — 화면에만 두면 그린 것과 보내는 것이 갈린다.
  const [seed] = useState<ScopeDraft>(() => {
    if (mode.initialValue === null) {
      return { values: {}, labels: {} }
    }
    const chosen = modeOptions.find((option) => option.value === mode.initialValue)
    return {
      values: { [mode.fieldKey]: mode.initialValue },
      labels: chosen === undefined ? {} : { [mode.fieldKey]: chosen.label },
    }
  })
  const draft = Object.keys(scopeDraft.values).length === 0 ? seed : scopeDraft
  const field = useFieldDraft({ elements: evt05b.elements, draft, onChangeDraft, screenParams })

  const missing = (evt05b.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <AppShell
        screenId={evt05b.screenId}
        activeNavigationScreenId={evt05b.activeNavigationScreenId}
        eyebrow={evt05b.meta?.eyebrow}
        title={evt05b.meta?.title ?? evt05b.screenId}
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

  const buttonAt = (nodeId: string) => elementByNodeId(evt05b, nodeId).spec as ButtonSpec
  const summaryAt = (nodeId: string) => elementByNodeId(evt05b, nodeId).spec as SummarySpec

  const press = (spec: ButtonSpec) => () => {
    if (spec.action.type === 'navigate') {
      // 떠나면서 초안을 끝낸다고 명세가 말했으면(action.scopeEvent) 그 말을 낸다.
      if (spec.action.scopeEvent !== undefined && evt05b.stateScopeKey !== undefined) {
        onScopeEvent(evt05b.stateScopeKey, spec.action.scopeEvent)
      }
      onNavigate(spec.action.targetScreenId, resolveParams(spec.action.params, { screenParams }))
      return
    }
    if (spec.action.type === 'pending') setNote(spec.action.note)
  }

  const statusChip = summaryAt(NODE.statusChip)
  const surveyRow = readObjectSource(
    statusChip.dataSourceKey,
    resolveParams(statusChip.params, { screenParams }),
  )

  const head = summaryAt(NODE.head)
  const impact = summaryAt(NODE.impact)
  const impactRow = readObjectSource(
    impact.dataSourceKey,
    resolveParams(impact.params, { screenParams }),
  )

  const notes = elementByNodeId(evt05b, NODE.notes).spec as ItemListSpec
  const noteField = columnFieldOf(notes, 0)

  const cancel = buttonAt(NODE.cancel)
  const replace = buttonAt(NODE.replace)
  const chosen = draft.values[mode.fieldKey] ?? null

  return (
    <AppShell
      screenId={evt05b.screenId}
      activeNavigationScreenId={evt05b.activeNavigationScreenId}
      eyebrow={evt05b.meta?.eyebrow}
      title={drawnTitleOf(evt05b, screenParams)}
      onNavigate={onNavigate}
      breadcrumb={
        evt05b.breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={evt05b.breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={evt05b.breadcrumb.items.map((item) =>
              item.field === undefined
                ? (item.value ?? '')
                : scalar(
                    readObjectSource(
                      evt05b.breadcrumb!.dataSourceKey,
                      resolveParams(evt05b.breadcrumb!.params, { screenParams }),
                    ),
                    item.field,
                  ),
            )}
          />
        )
      }
      headerAction={
        <span
          data-node-id={NODE.statusChip}
          data-design-rule="state-chip"
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            STATE_CHIP[scalar(surveyRow, statusChip.toneField)] ?? NEUTRAL_CHIP
          }`}
        >
          {scalar(surveyRow, (statusChip.items ?? [])[0]?.field)}
        </span>
      }
    >
      <WorkspaceHeader
        screen={evt05b}
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
              onClick={press(buttonAt(NODE.editBasics))}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {buttonAt(NODE.editBasics).label}
            </button>
            <button
              type="button"
              data-node-id={NODE.startEvent}
              onClick={press(buttonAt(NODE.startEvent))}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              {buttonAt(NODE.startEvent).label}
            </button>
          </div>
        }
      />

      {note === null ? null : (
        <p role="alert" className="mt-4 rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600">
          {note}
        </p>
      )}

      <div className="flex justify-center pt-10">
        <div className="w-full max-w-[540px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl">
          {/* 무엇을 하려는지와 되돌릴 수 없다는 것. 둘 다 서버가 완성해 준다. */}
          <div
            data-node-id={NODE.head}
            className={`px-5 py-3.5 ${CONFIRM_NOTE.red}`}
          >
            <h2
              data-design-rule="state-banner"
              className={`text-sm font-semibold ${BANNER_TEXT.red.title}`}
            >
              {scalar(impactRow, head.titleField)}
            </h2>
            <p className="pt-0.5 text-xs">{scalar(impactRow, head.descriptionField)}</p>
          </div>

          <div className="flex flex-col gap-4 px-5 py-4">
            {/* 몇 명이 영향을 받는지. 세는 것은 서버이고 화면은 그 글을 그린다. */}
            <div data-node-id={NODE.impact} className="grid grid-cols-2 gap-2.5">
              {(impact.items ?? []).map((item) => (
                <span
                  key={item.field}
                  className="rounded border border-gray-200 px-3 py-2.5"
                >
                  <span className="block text-xs text-gray-400">{item.label}</span>
                  <span className="block pt-1 text-sm font-bold text-gray-800">
                    {scalar(impactRow, item.field)}
                  </span>
                </span>
              ))}
            </div>

            {/* 함께 알아야 할 것들. **몇 줄인지는 데이터가 정한다** — 조직의 규칙이
                바뀌면 줄이 늘고, 화면이 수를 못 박으면 그때 명세가 틀린다. */}
            <ul data-node-id={NODE.notes} className="flex flex-col gap-2">
              {readFieldRows(
                notes.dataSourceKey,
                notes.itemsField,
                resolveParams(notes.params, { screenParams }),
              ).map((note, at) => (
                <li key={at} className="flex items-start gap-2 text-xs text-gray-600">
                  <span aria-hidden className="pt-px text-orange-400">
                    •
                  </span>
                  <span>{String(note[noteField] ?? '')}</span>
                </li>
              ))}
            </ul>

            {/* 새 설문을 어떻게 시작할지. 선택지와 그 부연은 카탈로그가 갖는다. */}
            <div
              data-node-id={NODE.mode}
              className="rounded border border-gray-200 bg-gray-50 px-3.5 py-3.5"
            >
              <span id={`${mode.fieldKey}-label`} className="block text-xs font-semibold text-gray-700">
                {mode.label}
              </span>
              <div
                id={mode.fieldKey}
                role="radiogroup"
                aria-labelledby={`${mode.fieldKey}-label`}
                className="flex flex-col gap-1 pt-2.5"
              >
                {modeOptions.map((option) => {
                  const selected = option.value === chosen
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => field.setFieldValue(mode.fieldKey, option.value, option.label)}
                      className="flex items-start gap-2.5 rounded px-2 py-2 text-left hover:bg-gray-100"
                    >
                      <span
                        className={`mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border ${
                          selected ? 'border-blue-600' : 'border-gray-300'
                        }`}
                      >
                        {selected && <span className="size-1.5 rounded-full bg-blue-600" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-gray-800">
                          {option.label}
                        </span>
                        {option.description === undefined ? null : (
                          <span className="block pt-0.5 text-xs font-medium text-gray-400">
                            {option.description}
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3.5">
            <button
              type="button"
              data-node-id={NODE.cancel}
              onClick={press(cancel)}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {cancel.label}
            </button>
            {/* 되돌릴 수 없는 동작이다 — design이 빨갛게 그렸고 그 뜻은 tones가 든다. */}
            <button
              type="button"
              data-node-id={NODE.replace}
              onClick={() =>
                void submitAction.run(replace.action as SubmitAction, {
                  payload: draft.values,
                  onNavigate,
                  paramSources: { screenParams },
                  onScopeEvent,
                })
              }
              className={`rounded px-3 py-1.5 text-xs font-medium ${DANGER_BUTTON}`}
            >
              {submitAction.labelOf(replace.action as SubmitAction, replace.label)}
            </button>
          </div>

          {submitAction.errorMessage === null ? null : (
            <p role="alert" className="px-5 pb-3.5 text-xs text-red-500">
              {submitAction.errorMessage}
            </p>
          )}
          {/* 보내고 나면 어디로 가는지가 아직 정해지지 않았다고 명세가 적어 두었다. */}
          {submitAction.pendingNote === null ? null : (
            <p role="status" className="px-5 pb-3.5 text-xs text-gray-500">
              {submitAction.pendingNote}
            </p>
          )}
        </div>
      </div>
    </AppShell>
  )
}
