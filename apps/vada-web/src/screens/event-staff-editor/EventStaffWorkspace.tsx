import { AppShell } from '../../components/AppShell'
import { WorkspaceHeader } from '../../components/WorkspaceHeader'
import { resolveParams } from '../../spec/params'
import { drawnTitleOf, evt03b } from '../../spec/screens'
import type { SubmitAction } from '../../spec/types'
import type { ScopeDraft } from '../../state/scopes'
import { EventStaffBasics } from './EventStaffBasics'
import { EventStaffTree } from './EventStaffTree'
import { UnassignedStaff } from './UnassignedStaff'
import { ASSET, NODE, SCREEN } from './spec'
import { useEventStaffDraft } from './useEventStaffDraft'

interface EventStaffWorkspaceProps {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 유효한 행사 안에서 조직 초안과 편집 화면을 연결한다. */
export function EventStaffWorkspace(props: EventStaffWorkspaceProps) {
  const model = useEventStaffDraft(props)
  const { cancel, done, buttonAt } = model.specs

  return (
    <AppShell
      screenId={evt03b.screenId}
      activeNavigationScreenId={evt03b.activeNavigationScreenId}
      eyebrow={evt03b.meta?.eyebrow}
      title={drawnTitleOf(evt03b, props.screenParams)}
      onNavigate={props.onNavigate}
      headerAction={
        <span className="flex items-center gap-2">
          <button
            type="button"
            data-node-id={NODE.cancel}
            onClick={model.pressCancel}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            {cancel.label}
          </button>
          <button
            type="button"
            data-node-id={NODE.done}
            onClick={model.pressDone}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            {model.submitAction.labelOf(done.action as SubmitAction, done.label)}
          </button>
        </span>
      }
    >
      <WorkspaceHeader
        screen={evt03b}
        screenParams={props.screenParams}
        onNavigate={props.onNavigate}
        onPending={model.setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
        actions={
          <div className="ml-auto flex gap-2">
            {[NODE.editBasics, NODE.startEvent].map((nodeId) => {
              const spec = buttonAt(nodeId)
              return (
                <button
                  key={nodeId}
                  type="button"
                  data-node-id={nodeId}
                  onClick={model.pressAction(spec)}
                  className={
                    nodeId === NODE.editBasics
                      ? 'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50'
                      : 'rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700'
                  }
                >
                  {spec.label}
                </button>
              )
            })}
          </div>
        }
      />

      <div className="-mx-8 flex gap-2 border-b border-gray-200 px-8 pt-6">
        {([NODE.staffTab, NODE.participantsTab] as const).map((nodeId) => {
          const spec = buttonAt(nodeId)
          const here = spec.action.type === 'current'
          return (
            <button
              key={nodeId}
              type="button"
              data-node-id={nodeId}
              disabled={here}
              aria-current={here ? 'page' : undefined}
              onClick={() => {
                if (spec.action.type === 'navigate') {
                  props.onNavigate(
                    spec.action.targetScreenId,
                    resolveParams(spec.action.params, { screenParams: props.screenParams }),
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

      <div className="flex gap-6 pt-6">
        <div className="min-w-0 flex-1">
          <EventStaffBasics model={model} />
          <EventStaffTree model={model} />
          {model.note === null ? null : (
            <p role="status" className="pt-6 text-xs font-medium text-gray-500">
              {model.note}
            </p>
          )}
          {model.submitAction.errorMessage === null ? null : (
            <p role="alert" className="pt-6 text-xs text-red-500">
              {model.submitAction.errorMessage}
            </p>
          )}
        </div>
        <UnassignedStaff model={model} />
      </div>
    </AppShell>
  )
}
