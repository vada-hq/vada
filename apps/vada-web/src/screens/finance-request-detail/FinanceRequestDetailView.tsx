import { ActivityTimeline } from '../../components/ActivityTimeline'
import { CautionButton } from '../../components/CautionButton'
import { DataTable } from '../../components/DataTable'
import { ProgressSteps } from '../../components/ProgressSteps'
import { SummaryCard } from '../../components/SummaryCard'
import { FINANCE_REQUEST_COMPLETED_ICON } from './config'
import type { ReadyFinanceRequestDetail } from './useFinanceRequestDetail'

export function FinanceRequestDetailView({ model }: { model: ReadyFinanceRequestDetail }) {
  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6">
      <ProgressSteps
        nodeId={model.stepNodeId}
        items={model.stepsSpec.items}
        currentKey={model.currentStep}
        completedIconNodeId={FINANCE_REQUEST_COMPLETED_ICON}
      />
      <SummaryCard
        nodeId={model.summaryNodeId}
        variant="detail"
        eyebrow={model.summary.eyebrow}
        status={model.summary.status}
        title={model.summary.title}
        items={model.summary.items}
      />
      <DataTable
        nodeId={model.resultNodeId}
        title={model.resultListSpec.title}
        label={model.resultListSpec.title}
        columns={model.resultListSpec.columns}
        rows={model.resultRows}
        emptyMessage={model.resultEmptyMessage}
        columnWidths={['18%', '19%', '11%', '18%', '34%']}
        fieldPresentation={{
          name: 'title',
          quantityNote: 'muted',
          amountNote: 'body',
          result: 'status',
          note: 'muted',
        }}
        headerAction={
          <CautionButton
            nodeId={model.pendingButtonNodeId}
            label={model.pendingButton.label}
            disabled={model.pendingButton.initiallyDisabled}
            onClick={model.pressSupplement}
          />
        }
      />
      {model.notice === null ? null : <p role="alert" className="text-sm">{model.notice}</p>}
      <ActivityTimeline
        nodeId={model.historyNodeId}
        title={model.historySpec.title}
        rows={model.historyRows}
        titleField={model.historyTitleField}
        noteField={model.historyNoteField}
        emptyMessage={model.historyEmptyMessage}
      />
    </div>
  )
}
