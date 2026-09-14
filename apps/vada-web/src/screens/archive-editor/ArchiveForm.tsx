import { FigmaAsset } from '../../components/FigmaAsset'
import { scalarValue as scalar } from '../../data-sources/values'
import type { SubmitAction } from '../../spec/types'
import { ArchiveDropdown, ArchiveTextArea, FormSection } from './fields'
import { ASSET, NODE, SCREEN } from './spec'
import type { ArchiveEditorModel } from './useArchiveEditor'

/** 자동 입력 정보와 사람이 작성하는 회고·인수인계 절을 표시한다. */
export function ArchiveForm({ model }: { model: ArchiveEditorModel }) {
  const { inputAt, selectAt, groupAt, summaryAt, autoFilled, generateDraft } = model.specs

  return (
    <div className="flex flex-col gap-4">
      <section
        data-node-id={NODE.autoFilled}
        className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
      >
        <header className="flex items-baseline justify-between border-b border-gray-200 px-6 py-3">
          <h2 className="text-sm font-bold text-gray-700">{autoFilled.title}</h2>
          <span className="text-xs text-gray-400">{autoFilled.description}</span>
        </header>
        <dl className="px-6 py-4">
          {(autoFilled.items ?? []).map((item) => (
            <div key={item.field} className="flex items-baseline gap-4 py-1.5">
              <dt className="w-20 shrink-0 text-xs text-gray-400">{item.label}</dt>
              <dd className="text-xs text-gray-600">{scalar(model.autoFilledRow, item.field)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <FormSection
        nodeId={NODE.onSite}
        title={inputAt(NODE.onSite).label}
        description={inputAt(NODE.onSite).helperText}
        labelFor={inputAt(NODE.onSite).fieldKey}
        current
      >
        <div className="px-6 py-4">
          <ArchiveTextArea spec={inputAt(NODE.onSite)} valueOf={model.valueOf} setValue={model.setValue} />
        </div>
      </FormSection>

      <FormSection nodeId={NODE.retroGroup} title={groupAt(NODE.retroGroup).title} current={false}>
        <div data-node-id={NODE.retroGood} className="px-6 py-4">
          <label
            htmlFor={inputAt(NODE.retroGood).fieldKey}
            className="block pb-2 text-sm font-semibold text-gray-800"
          >
            {inputAt(NODE.retroGood).label}
          </label>
          <ArchiveTextArea spec={inputAt(NODE.retroGood)} valueOf={model.valueOf} setValue={model.setValue} />
        </div>
        <div data-node-id={NODE.retroIssues} className="border-t border-gray-100 px-6 py-4">
          <label
            htmlFor={inputAt(NODE.retroIssues).fieldKey}
            className="block pb-2 text-sm font-semibold text-gray-800"
          >
            {inputAt(NODE.retroIssues).label}
          </label>
          <ArchiveTextArea spec={inputAt(NODE.retroIssues)} valueOf={model.valueOf} setValue={model.setValue} />
        </div>
        <div
          data-node-id={NODE.retroImprovements}
          className="border-t border-gray-100 px-6 py-4"
        >
          <label
            htmlFor={inputAt(NODE.retroImprovements).fieldKey}
            className="block pb-2 text-sm font-semibold text-gray-800"
          >
            {inputAt(NODE.retroImprovements).label}
          </label>
          <ArchiveTextArea spec={inputAt(NODE.retroImprovements)} valueOf={model.valueOf} setValue={model.setValue} />
          <div data-node-id={NODE.improvementDepartment} className="pt-3">
            <label
              htmlFor={selectAt(NODE.improvementDepartment).fieldKey}
              className="block pb-1.5 text-xs text-gray-500"
            >
              {selectAt(NODE.improvementDepartment).label}
            </label>
            <ArchiveDropdown spec={selectAt(NODE.improvementDepartment)} field={model.field} />
          </div>
        </div>
      </FormSection>

      <FormSection
        nodeId={NODE.handoverGroup}
        title={groupAt(NODE.handoverGroup).title}
        description={groupAt(NODE.handoverGroup).description}
        current={false}
      >
        <div className="px-6 py-4">
          <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p data-node-id={NODE.aiDisclaimer} className="text-xs text-gray-500">
              {scalar(model.archiveRow, (summaryAt(NODE.aiDisclaimer).items ?? [])[0]?.field)}
            </p>
            <button
              type="button"
              data-node-id={NODE.generateDraft}
              onClick={() => model.send(generateDraft)}
              className="flex shrink-0 items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.generateDraft} className="size-3" />
              {model.submitAction.labelOf(
                generateDraft.action as SubmitAction,
                generateDraft.label,
              )}
            </button>
          </div>
          <div data-node-id={NODE.handover} className="pt-3">
            <ArchiveTextArea spec={inputAt(NODE.handover)} valueOf={model.valueOf} setValue={model.setValue} />
          </div>
        </div>
        <div data-node-id={NODE.nextOwner} className="border-t border-gray-100 px-6 py-4">
          <label
            htmlFor={inputAt(NODE.nextOwner).fieldKey}
            className="block pb-1.5 text-xs font-medium text-gray-700"
          >
            {inputAt(NODE.nextOwner).label}
          </label>
          <input
            id={inputAt(NODE.nextOwner).fieldKey}
            type={inputAt(NODE.nextOwner).inputType}
            value={model.valueOf(inputAt(NODE.nextOwner).fieldKey)}
            placeholder={inputAt(NODE.nextOwner).placeholder ?? undefined}
            onChange={(event) => model.setValue(inputAt(NODE.nextOwner).fieldKey, event.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 placeholder:text-gray-800 focus:outline-none"
          />
        </div>
      </FormSection>
    </div>
  )
}
