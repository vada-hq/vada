import { ChoiceGroup } from '../../components/ChoiceGroup'
import { findDataSource } from '../../data-sources/definitions'
import { TYPE_CHIP, VERDICT_CHOICE } from '../../design/tones'
import { NODE, SCREEN, scalar } from './spec'
import type { ReadyPurchaseReviewDraftModel } from './usePurchaseReviewDraft'

/** 서버 품목과 각 품목의 승인액·검토 결과 입력을 표로 그린다. */
export function PurchaseReviewTable({ model }: { model: ReadyPurchaseReviewDraftModel }) {
  return (
    <section data-node-id={NODE.table} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table aria-label={model.screen.meta?.title ?? SCREEN} className="w-full min-w-[880px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {(model.table.columns ?? []).map((column) => (
                <th key={column.label} scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          {model.rows.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={(model.table.columns ?? []).length} className="px-6 py-8 text-center text-sm text-gray-500">
                  {findDataSource(model.table.dataSourceKey).messages.empty}
                </td>
              </tr>
            </tbody>
          ) : (
            model.rows.map((row) => (
              <tbody key={scalar(row, 'id')} className="border-b border-gray-50 last:border-b-0">
                <tr>
                  <td className="px-6 py-3 align-middle">
                    <span className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-gray-800">{scalar(row, 'name')}</span>
                      <span className="text-xs font-medium text-gray-400">{scalar(row, 'categoryNote')}</span>
                      <span data-design-rule="state-chip" className={`inline-flex self-start rounded px-2 py-0.5 text-xs font-normal ${TYPE_CHIP}`}>
                        {scalar(row, 'purchaseType')}
                      </span>
                    </span>
                  </td>
                  <td className="px-6 py-3 align-middle text-xs font-medium text-gray-600">{scalar(row, 'quantityNote')}</td>
                  <td className="px-6 py-3 align-middle text-xs font-normal text-gray-600">{scalar(row, 'amountNote')}</td>
                  <td data-node-id={NODE.approvedAmount} className="px-6 py-3 align-middle">
                    <input
                      type="number"
                      aria-label={`${scalar(row, 'name')} ${model.approvedAmount.label}`}
                      value={model.valueOf(row, model.approvedAmount.fieldKey)}
                      onChange={(event) => model.setValue(row, model.approvedAmount.fieldKey, event.target.value)}
                      className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-normal text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                    />
                  </td>
                  <td data-node-id={NODE.result} className="px-6 py-3 align-middle">
                    <ChoiceGroup
                      id={`${scalar(row, 'id')}-${model.result.fieldKey}`}
                      disabled={model.result.initiallyDisabled}
                      sourceKey={model.result.optionsSource.key}
                      sourceParams={{}}
                      value={model.resultOptions.find((option) => option.value === model.valueOf(row, model.result.fieldKey)) ?? null}
                      onSelect={(option) => model.setValue(row, model.result.fieldKey, option.value)}
                      selectedToneByValue={VERDICT_CHOICE}
                    />
                  </td>
                </tr>
                {model.valueOf(row, model.result.fieldKey) === 'supplement' ? (
                  <tr>
                    <td colSpan={5} className="px-6 pb-3">
                      <label data-node-id={NODE.reviewNote} className="block" htmlFor={`${scalar(row, 'id')}-${model.reviewNote.fieldKey}`}>
                        <span className="block pb-1 text-xs font-medium text-gray-700">{model.reviewNote.label}</span>
                        <input
                          id={`${scalar(row, 'id')}-${model.reviewNote.fieldKey}`}
                          type="text"
                          value={model.valueOf(row, model.reviewNote.fieldKey)}
                          onChange={(event) => model.setValue(row, model.reviewNote.fieldKey, event.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-normal text-gray-800 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                        />
                      </label>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            ))
          )}
        </table>
      </div>
    </section>
  )
}
