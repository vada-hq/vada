import { AppShell } from '../components/AppShell'
import { FigmaAsset } from '../components/FigmaAsset'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import { resolveParams } from '../spec/params'
import { drawnTitleOf } from '../spec/screens'
import { evt04 } from '../spec/screen-specs/evt04'
import { ParticipantFilters } from './event-participants/ParticipantFilters'
import { ParticipantTable } from './event-participants/ParticipantTable'
import { ASSET, NODE, SCREEN } from './event-participants/spec'
import { useParticipantDirectory } from './event-participants/useParticipantDirectory'

interface EVT04ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EVT04Screen(props: EVT04ScreenProps) {
  const missing = (evt04.params ?? []).filter((param) => (props.screenParams[param.key] ?? '') === '')
  if (missing.length > 0) {
    return (
      <AppShell screenId={evt04.screenId} activeNavigationScreenId={evt04.activeNavigationScreenId} eyebrow={evt04.meta?.eyebrow} title={evt04.meta?.title ?? evt04.screenId} onNavigate={props.onNavigate}>
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {missing.map((param) => param.missingNote).join(' ')}
        </p>
      </AppShell>
    )
  }
  return <ParticipantWorkspace {...props} />
}

function ParticipantWorkspace({ screenParams, onNavigate }: EVT04ScreenProps) {
  const model = useParticipantDirectory({ screenParams, onNavigate })
  const { buttonAt } = model.specs
  return (
    <AppShell
      screenId={evt04.screenId}
      activeNavigationScreenId={evt04.activeNavigationScreenId}
      eyebrow={evt04.meta?.eyebrow}
      title={drawnTitleOf(evt04, screenParams)}
      onNavigate={onNavigate}
      headerAction={
        <div className="flex gap-2">
          {[{ nodeId: NODE.survey, asset: null }, { nodeId: NODE.qr, asset: ASSET.qr }, { nodeId: NODE.export, asset: ASSET.export }].map(({ nodeId, asset }) => {
            const spec = buttonAt(nodeId)
            return (
              <button key={nodeId} type="button" data-node-id={nodeId} onClick={model.run(spec)} className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                {asset === null ? null : <FigmaAsset screenId={SCREEN} nodeId={asset} className="size-3" />}
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
        onPending={model.setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
        actions={
          <div className="ml-auto flex gap-2">
            {[NODE.editBasics, NODE.startEvent].map((nodeId) => {
              const spec = buttonAt(nodeId)
              return (
                <button key={nodeId} type="button" data-node-id={nodeId} onClick={model.run(spec)} className={nodeId === NODE.editBasics ? 'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50' : 'rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700'}>
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
                if (spec.action.type === 'navigate') onNavigate(spec.action.targetScreenId, resolveParams(spec.action.params, { screenParams }))
              }}
              className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-medium ${here ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {spec.label}
            </button>
          )
        })}
      </div>

      {model.note === null ? null : <p role="status" className="pt-3 text-xs font-medium text-gray-500">{model.note}</p>}
      <ParticipantFilters model={model} />
      <ParticipantTable model={model} />
    </AppShell>
  )
}
