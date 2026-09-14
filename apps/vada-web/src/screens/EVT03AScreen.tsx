import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import { readListSource } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, evt03a } from '../spec/screens'
import type { ButtonSpec, ItemListSpec, SummarySpec } from '../spec/types'
import { EmptyStaffState } from './event-staff-view/EmptyStaffState'
import { StaffTree } from './event-staff-view/StaffTree'
import { ASSET, NODE, SCREEN } from './event-staff-view/spec'

interface EVT03AScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 행사 운영 조직의 데이터와 화면 상태를 조직도 UI에 연결한다. */
export function EVT03AScreen({ screenParams, onNavigate }: EVT03AScreenProps) {
  const [note, setNote] = useState<string | null>(null)
  const missing = (evt03a.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <AppShell
        screenId={evt03a.screenId}
        activeNavigationScreenId={evt03a.activeNavigationScreenId}
        eyebrow={evt03a.meta?.eyebrow}
        title={evt03a.meta?.title ?? evt03a.screenId}
        onNavigate={onNavigate}
      >
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {missing.map((param) => param.missingNote).join(' ')}
        </p>
      </AppShell>
    )
  }

  const buttonAt = (nodeId: string) => elementByNodeId(evt03a, nodeId).spec as ButtonSpec
  const leaders = elementByNodeId(evt03a, NODE.leaders).spec as ItemListSpec
  const departments = elementByNodeId(evt03a, NODE.departments).spec as ItemListSpec
  const leaderRows = readListSource(
    leaders.dataSourceKey,
    resolveParams(leaders.params, { screenParams }),
  )
  const departmentRows = readListSource(
    departments.dataSourceKey,
    resolveParams(departments.params, { screenParams }),
  )
  const leaderCard = leaders.itemFields![0].spec as SummarySpec
  const [nameSpec, leaderList, memberList] = departments.itemFields!.map((entry) => entry.spec)
  const configured = leaderRows.length > 0 || departmentRows.length > 0

  return (
    <AppShell
      screenId={evt03a.screenId}
      activeNavigationScreenId={evt03a.activeNavigationScreenId}
      eyebrow={evt03a.meta?.eyebrow}
      title={drawnTitleOf(evt03a, screenParams)}
      onNavigate={onNavigate}
    >
      <WorkspaceHeader
        screen={evt03a}
        screenParams={screenParams}
        onNavigate={onNavigate}
        onPending={setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
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
        <p role="status" className="pt-3 text-xs font-medium text-gray-500">{note}</p>
      )}
      {configured ? (
        <StaffTree
          leaders={leaders}
          departments={departments}
          leaderRows={leaderRows}
          departmentRows={departmentRows}
          leaderCard={leaderCard}
          nameSpec={nameSpec as SummarySpec}
          leaderList={leaderList as ItemListSpec}
          memberList={memberList as ItemListSpec}
          onNote={setNote}
        />
      ) : (
        <EmptyStaffState
          departments={departments}
          screenParams={screenParams}
          onNavigate={onNavigate}
          onNote={setNote}
        />
      )}
    </AppShell>
  )
}
