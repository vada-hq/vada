import { FigmaAsset } from '../../components/FigmaAsset'
import { MUTED_CHIP, NEUTRAL_CHIP, STATE_CHIP } from '../../design/tones'
import type { DataRow } from '../../data-sources/definitions'
import { ASSET, NODE, SCREEN } from './spec'
import type { FinanceEvidenceModel } from './useFinanceEvidence'
import { evidenceScalar as scalar, nestedRows } from './values'

function EvidencePayment({
  model,
  payment,
  first,
}: {
  model: FinanceEvidenceModel
  payment: DataRow
  first: boolean
}) {
  return (
    <section
      data-node-id={first ? NODE.payments : undefined}
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <span className="flex items-start justify-between gap-6 rounded-lg border border-gray-100 bg-gray-50 p-4">
        <span data-node-id={first ? NODE.vendor : undefined} className="min-w-0">
          <span className="block text-sm font-bold text-gray-700">
            {scalar(payment, model.vendor.titleField ?? '')}
          </span>
          <span className="block pt-1 text-xs font-normal text-gray-400">
            {scalar(payment, model.vendor.descriptionField ?? '')}
          </span>
        </span>
        <span data-node-id={first ? NODE.amount : undefined} className="shrink-0 text-right">
          <span className="block text-xs font-normal text-gray-400">
            {scalar(payment, model.amount.titleField ?? '')}
          </span>
          {payment[model.amount.descriptionField ?? ''] === undefined ? null : (
            <span className="block pt-1 text-xs font-normal text-red-500">
              {scalar(payment, model.amount.descriptionField ?? '')}
            </span>
          )}
        </span>
      </span>

      <span className="mt-4 block" data-node-id={first ? NODE.items : undefined}>
        <span className="block text-xs font-bold text-gray-400">{model.itemsList.title}</span>
        <span className="flex flex-wrap gap-2 pt-2">
          {nestedRows(payment, model.itemsList).map((item) => (
            <span
              key={scalar(item, 'id')}
              className={`inline-flex rounded px-2 py-1 text-xs font-medium ${MUTED_CHIP}`}
            >
              {scalar(item, model.itemName)}
            </span>
          ))}
        </span>
      </span>

      <span className="mt-4 block" data-node-id={first ? NODE.documents : undefined}>
        <span className="block text-xs font-bold text-gray-400">
          {model.documentsList.title}
        </span>
        <span className="flex flex-wrap items-center gap-2 pt-2">
          {nestedRows(payment, model.documentsList).map((document) => (
            <span key={scalar(document, 'id')} className="flex items-center gap-1.5">
              <span className="text-xs font-normal text-gray-600">
                {scalar(document, model.documentLabel)}
              </span>
              <span
                data-design-rule="state-chip"
                className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${
                  STATE_CHIP[scalar(document, model.documentTone)] ?? NEUTRAL_CHIP
                }`}
              >
                {scalar(document, model.documentStatus)}
              </span>
            </span>
          ))}
          <button
            type="button"
            data-node-id={first ? NODE.addFile : undefined}
            onClick={model.pressPending(model.addFile)}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-400 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.addFile} className="size-3" />
            {model.addFile.label}
          </button>
        </span>
      </span>
    </section>
  )
}

export function EvidencePaymentList({ model }: { model: FinanceEvidenceModel }) {
  if (model.payments.length === 0) {
    return <p className="text-sm text-gray-500">{model.emptyMessage}</p>
  }
  return model.payments.map((payment, index) => (
    <EvidencePayment
      key={scalar(payment, 'id')}
      model={model}
      payment={payment}
      first={index === 0}
    />
  ))
}
