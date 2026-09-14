import { NEUTRAL_CHIP, STATE_CHIP } from '../../design/tones'
import { NODE, TILE_TEXT } from './spec'
import type { FinanceEvidenceModel } from './useFinanceEvidence'
import { evidenceScalar as scalar } from './values'

export function EvidenceSummary({ model }: { model: FinanceEvidenceModel }) {
  return (
    <section
      data-node-id={NODE.head}
      className="flex items-start justify-between gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-xs font-normal text-gray-400">
            {scalar(model.summaryRow, model.head.eyebrowField ?? '')}
          </span>
          <span
            data-design-state
            data-design-rule="state-chip"
            className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${
              STATE_CHIP[
                scalar(model.summaryRow, model.head.status?.[0]?.toneField ?? '')
              ] ?? NEUTRAL_CHIP
            }`}
          >
            {scalar(model.summaryRow, model.head.status?.[0]?.field ?? '')}
          </span>
        </span>
        <span className="block pt-1 text-lg font-bold text-gray-900">
          {scalar(model.summaryRow, model.head.titleField ?? '')}
        </span>
        <span className="block pt-1 text-xs font-normal text-gray-500">
          {scalar(model.summaryRow, model.head.descriptionField ?? '')}
        </span>
      </span>
      <span className="flex shrink-0 gap-6">
        {(model.head.items ?? []).map((item) => (
          <span key={item.field} className="text-right">
            <span className="block text-xs font-semibold text-gray-400">{item.label}</span>
            <span
              className={`block pt-1 text-lg font-bold ${
                TILE_TEXT[item.field ?? ''] ?? 'text-gray-800'
              }`}
            >
              {scalar(model.summaryRow, item.field ?? '')}
            </span>
          </span>
        ))}
      </span>
    </section>
  )
}
