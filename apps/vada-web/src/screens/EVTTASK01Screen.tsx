import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { FigmaAsset } from '../components/FigmaAsset'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import { readObjectSource } from '../data-sources/catalog'
import { getOptionSource } from '../option-sources/definitions'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, evtTask01 } from '../spec/screens'
import type { ButtonSpec, SelectSpec, SummarySpec } from '../spec/types'
import { EventTaskOverview } from './event-task-board/EventTaskOverview'
import { TaskBoard } from './event-task-board/TaskBoard'
import { ASSET, NODE, SCREEN } from './event-task-board/spec'

interface EVTTASK01ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 행사 업무의 범위와 데이터를 보드 UI에 연결한다. */
export function EVTTASK01Screen({ screenParams, onNavigate }: EVTTASK01ScreenProps) {
  const addTask = elementByNodeId(evtTask01, NODE.addTask).spec as ButtonSpec
  const eventSpec = elementByNodeId(evtTask01, NODE.event).spec as SummarySpec
  const alerts = elementByNodeId(evtTask01, NODE.alerts).spec as SummarySpec
  const scope = elementByNodeId(evtTask01, NODE.scope).spec as SelectSpec
  const [scopeValue, setScopeValue] = useState(scope.initialValue ?? '')
  const [note, setNote] = useState<string | null>(null)
  const missing = (evtTask01.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <AppShell
        screenId={evtTask01.screenId}
        activeNavigationScreenId={evtTask01.activeNavigationScreenId}
        eyebrow={evtTask01.meta?.eyebrow}
        title={evtTask01.meta?.title ?? evtTask01.screenId}
        onNavigate={onNavigate}
      >
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {missing.map((param) => param.missingNote).join(' ')}
        </p>
      </AppShell>
    )
  }

  const argumentsOf = (params: SummarySpec['params']) =>
    resolveParams(params, { screenParams, fields: { [scope.fieldKey]: scopeValue } })
  const event = readObjectSource(eventSpec.dataSourceKey ?? '', argumentsOf(eventSpec.params))
  const alertRow = readObjectSource(alerts.dataSourceKey ?? '', argumentsOf(alerts.params))
  const scopeSource = getOptionSource(scope.optionsSource.key)
  const scopeOptions = scopeSource.type === 'static' ? scopeSource.options : []

  return (
    <AppShell
      screenId={evtTask01.screenId}
      activeNavigationScreenId={evtTask01.activeNavigationScreenId}
      eyebrow={evtTask01.meta?.eyebrow}
      title={drawnTitleOf(evtTask01, screenParams)}
      onNavigate={onNavigate}
      headerAction={
        <button
          type="button"
          data-node-id={NODE.addTask}
          disabled={addTask.initiallyDisabled}
          onClick={() => {
            if (addTask.action.type === 'pending') setNote(addTask.action.note)
          }}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.addTask} className="size-3.5" />
          {addTask.label}
        </button>
      }
    >
      <WorkspaceHeader
        screen={evtTask01}
        screenParams={screenParams}
        onNavigate={onNavigate}
        onPending={setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
      />
      {note === null ? null : (
        <p role="status" className="pt-4 text-xs font-medium text-gray-500">{note}</p>
      )}
      <EventTaskOverview
        eventSpec={eventSpec}
        event={event}
        alerts={alerts}
        alertRow={alertRow}
        scope={scope}
        scopeOptions={scopeOptions}
        scopeValue={scopeValue}
        onScopeChange={setScopeValue}
      />
      <div className="flex items-baseline justify-between gap-4 pb-3">
        <h2 className="text-sm font-bold text-gray-900">{evtTask01.meta?.title}</h2>
        <span className="text-xs text-gray-400">{evtTask01.meta?.description}</span>
      </div>
      <TaskBoard
        screenParams={screenParams}
        scopeFieldKey={scope.fieldKey}
        scopeValue={scopeValue}
        onNavigate={onNavigate}
      />
    </AppShell>
  )
}
