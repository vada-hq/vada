import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import { NEUTRAL_CHIP, STATE_CHIP } from '../design/tones'
import { readListSource, readObjectSource } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, evt05 } from '../spec/screens'
import { useSubmitAction } from '../spec/useSubmitAction'
import type { ButtonSpec, SubmitAction } from '../spec/types'
import type { ScopeDraft } from '../state/scopes'
import { ASSET, BREADCRUMB_SEPARATORS, NODE, SCREEN, buttonAt, listAt, summaryAt } from './survey-editor/survey-spec'
import { scalar } from './survey-editor/survey-values'
import { useSurveyDraft } from './survey-editor/useSurveyDraft'
import { SurveyBasics } from './survey-editor/SurveyBasics'
import { SurveyRecruitment } from './survey-editor/SurveyRecruitment'
import { SurveyConditions } from './survey-editor/SurveyConditions'
import { SurveyQuestions } from './survey-editor/SurveyQuestions'

// 참여 설문 생성·관리. 데이터 조회와 초안·제출 처리를 연결하고 화면을 조립한다.
// 서버가 막았을 때의 으뜸 단추. design이 그 상태만 그렸다(bg-blue-200·text-blue-400).
const BLOCKED_PRIMARY = 'bg-blue-200 text-blue-400'

interface EVT05ScreenProps {
  screenParams: Record<string, string>
  /** 명세가 stateScopeKey로 말한 자리(eventSurveyDraft). 모집 설정 초안이 여기 산다. */
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EVT05Screen({
  screenParams,
  draft: scopeDraft,
  onChangeDraft,
  onNavigate,
}: EVT05ScreenProps) {
  const submitAction = useSubmitAction()
  const [note, setNote] = useState<string | null>(null)
  // 지운 문항. **아무 데도 보내지 않는다** — 문항을 고치는 제출 계약이 카탈로그에
  // 없고 그림에도 저장 단추가 없다. 지운 것이 화면에서 사라지는 것까지가 명세가
  // 말한 전부다(itemList.itemRemove).
  const [removed, setRemoved] = useState<string[]>([])

  const { missing, draft, setFieldValue } = useSurveyDraft({
    screenParams, draft: scopeDraft, onChangeDraft,
  })

  if (missing.length > 0) {
    return (
      <AppShell
        screenId={evt05.screenId}
        activeNavigationScreenId={evt05.activeNavigationScreenId}
        eyebrow={evt05.meta?.eyebrow}
        title={evt05.meta?.title ?? evt05.screenId}
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

  // 명세가 navigate라고 말한 자리는 실제로 데려간다. pending이면 그 글을 내놓는다.
  const press = (spec: ButtonSpec) => () => {
    if (spec.action.type === 'navigate') {
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

  const activate = buttonAt(NODE.activate)
  const gate = activate.action.type === 'submit' ? activate.action.executeWhen : undefined
  // 서버가 막았는지. 조각에 글이 있으면 막힌 것이고 그 글이 까닭이다.
  const blockedNote =
    gate?.type === 'sourceAllows'
      ? scalar(
          readObjectSource(gate.dataSourceKey, resolveParams(gate.params, { screenParams })),
          gate.blockedNoteField,
        )
      : ''

  const unmetBadge = summaryAt(NODE.unmetBadge)
  const activationRow = readObjectSource(
    unmetBadge.dataSourceKey,
    resolveParams(unmetBadge.params, { screenParams }),
  )

  const basics = summaryAt(NODE.basics)
  const basicsRow = readObjectSource(
    basics.dataSourceKey,
    resolveParams(basics.params, { screenParams }),
  )

  const conditions = listAt(NODE.conditions)
  const conditionGroups = readListSource(
    conditions.dataSourceKey,
    resolveParams(conditions.params, { screenParams }),
  )

  const questions = listAt(NODE.questions)
  const questionRows = readListSource(
    questions.dataSourceKey,
    resolveParams(questions.params, { screenParams }),
  ).filter((row) => !removed.includes(String(row.id)))

  const panel = summaryAt(NODE.questionPanel)

  function pressActivate() {
    if (activate.action.type !== 'submit') return
    // 판정은 한 곳에서만 돈다. 서버가 막았으면 그 까닭을 그대로 내놓는다.
    if (blockedNote !== '') {
      setNote(blockedNote)
      return
    }
    setNote(null)
    void submitAction.run(activate.action as SubmitAction, {
      payload: draft.values,
      onNavigate,
      paramSources: { screenParams },
    })
  }

  return (
    <AppShell
      screenId={evt05.screenId}
      activeNavigationScreenId={evt05.activeNavigationScreenId}
      eyebrow={evt05.meta?.eyebrow}
      title={drawnTitleOf(evt05, screenParams)}
      onNavigate={onNavigate}
      breadcrumb={
        evt05.breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={evt05.breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={evt05.breadcrumb.items.map((item) =>
              item.field === undefined
                ? (item.value ?? '')
                : scalar(
                    readObjectSource(
                      evt05.breadcrumb!.dataSourceKey,
                      resolveParams(evt05.breadcrumb!.params, { screenParams }),
                    ),
                    item.field,
                  ),
            )}
          />
        )
      }
      headerAction={
        <div className="flex items-center gap-2">
          <span
            data-node-id={NODE.statusChip}
            data-design-rule="state-chip"
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              STATE_CHIP[scalar(surveyRow, statusChip.toneField)] ?? NEUTRAL_CHIP
            }`}
          >
            {scalar(surveyRow, (statusChip.items ?? [])[0]?.field)}
          </span>

          <button
            type="button"
            data-node-id={NODE.preview}
            onClick={press(buttonAt(NODE.preview))}
            className="flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.preview} className="size-3" />
            {buttonAt(NODE.preview).label}
          </button>

          <span className="relative inline-flex">
            <button
              type="button"
              data-node-id={NODE.activate}
              onClick={pressActivate}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                blockedNote === '' ? 'bg-blue-600 text-white hover:bg-blue-700' : BLOCKED_PRIMARY
              }`}
            >
              {submitAction.labelOf(activate.action as SubmitAction, activate.label)}
            </button>
            {/* 못 채운 조건 수. 서버가 세고 화면은 그 수만 그린다. */}
            <span
              data-node-id={NODE.unmetBadge}
              className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 px-1.5 text-xs font-bold text-white"
            >
              {scalar(activationRow, (unmetBadge.items ?? [])[0]?.field)}
            </span>
          </span>
        </div>
      }
    >
      <WorkspaceHeader
        screen={evt05}
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
      {submitAction.errorMessage === null ? null : (
        <p role="alert" className="mt-4 text-sm text-red-500">
          {submitAction.errorMessage}
        </p>
      )}

      <div className="flex items-start gap-4 pt-5">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <SurveyBasics basicsRow={basicsRow} onEdit={press(buttonAt(NODE.basicsLink))} />

          <SurveyRecruitment values={draft.values} onChangeValue={setFieldValue} />

          <SurveyConditions
            conditionGroups={conditionGroups}
            activationRow={activationRow}
            screenParams={screenParams}
            onNavigate={onNavigate}
          />

          <SurveyQuestions
            questionRows={questionRows}
            onRemove={(id) => setRemoved((previous) => [...previous, id])}
            values={draft.values}
            onChangeValue={setFieldValue}
          />
        </div>

        {/* 질문 설정 칸. design은 제목만 그리고 안을 비워 두었다 - 무엇이 오는지는
            그림이 말하지 않는다. */}
        <aside className="w-60 shrink-0 self-stretch rounded-md border border-gray-200 bg-white">
          <div data-node-id={NODE.questionPanel} className="border-b border-gray-100 px-3.5 py-2.5">
            <h3 className="text-sm font-semibold text-gray-800">{panel.title}</h3>
          </div>
        </aside>
      </div>
    </AppShell>
  )
}
