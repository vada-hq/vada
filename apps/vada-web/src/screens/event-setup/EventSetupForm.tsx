import { ChoiceGroup } from '../../components/ChoiceGroup'
import { Field } from '../../components/Field'
import { FigmaAsset } from '../../components/FigmaAsset'
import { PrimaryButton } from '../../components/PrimaryButton'
import { SearchSelect } from '../../components/SearchSelect'
import { findDataSource } from '../../data-sources/definitions'
import { SOFT_BOX } from '../../design/tones'
import { resolveParams } from '../../spec/params'
import { evt01 } from '../../spec/screens'
import type { SubmitAction } from '../../spec/types'
import { DepartmentPreview } from './DepartmentPreview'
import { SetupCard } from './SetupCard'
import { ASSET, NODE, SCREEN, scalar } from './spec'
import type { ReadyEventSetupDraftModel } from './useEventSetupDraft'

/** 조직 설정 필드, 미리보기와 저장 버튼을 그린다. */
export function EventSetupForm({ model }: { model: ReadyEventSetupDraftModel }) {
  return (
    <SetupCard>
      <div data-node-id={NODE.head}>
        <p className="text-xs text-gray-400">{scalar(model.eventRow, model.head.eyebrowField!)}</p>
        <h1 className="pt-1 text-lg font-semibold text-gray-900">{model.head.title}</h1>
        <p className="pt-1 text-sm text-gray-500">{model.head.description}</p>
      </div>
      <div className="flex flex-col gap-5 pt-6">
        <ChoiceGroup
          id={model.setupMode.fieldKey}
          nodeId={NODE.setupMode}
          disabled={model.setupMode.initiallyDisabled}
          hasError={model.blockedKeys.includes(model.setupMode.fieldKey)}
          sourceKey={model.setupMode.optionsSource.key}
          sourceParams={{}}
          value={model.optionOf(model.setupMode)}
          onSelect={(option) => model.setValue(model.setupMode, option.value, option.label)}
        />
        <div className="w-56">
          <Field
            htmlFor={model.leader.fieldKey}
            nodeId={NODE.leader}
            label={model.leader.label}
            required={model.leader.required}
            error={model.errorOf(model.leader)}
          >
            <SearchSelect
              id={model.leader.fieldKey}
              placeholder={model.leader.placeholder}
              searchable={model.leader.searchable}
              disabled={model.leader.initiallyDisabled}
              hasError={model.blockedKeys.includes(model.leader.fieldKey)}
              sourceKey={model.leader.optionsSource.key}
              sourceParams={resolveParams(model.leader.optionsSource.params, {
                screenParams: model.screenParams,
              })}
              value={model.optionOf(model.leader)}
              onSelect={(option) => model.setValue(model.leader, option.value, option.label)}
              chevron={<FigmaAsset screenId={SCREEN} nodeId={ASSET.leaderChevron} className="size-3.5" />}
            />
          </Field>
        </div>
        <div data-node-id={NODE.preview}>
          <p className="text-xs font-medium text-gray-700">{model.preview.title}</p>
          {model.previewRows.length > 0 ? null : (
            <p data-design-state="empty" className="pt-3 text-sm text-gray-500">
              {findDataSource(model.preview.dataSourceKey).messages.empty}
            </p>
          )}
          <div className="flex flex-wrap gap-4 pt-3">
            {model.previewRows.map((row, index) => (
              <DepartmentPreview
                key={scalar(row, 'id')}
                row={row}
                first={index === 0}
                nameSpec={model.nameSpec}
                leaderList={model.leaderList}
                memberList={model.memberList}
                onNote={model.setNote}
              />
            ))}
          </div>
        </div>
        {evt01.meta?.footerNote === undefined || evt01.meta.footerNote === null ? null : (
          <p className={`rounded border p-2.5 text-xs text-blue-600 ${SOFT_BOX.blue}`}>
            {evt01.meta.footerNote}
          </p>
        )}
      </div>
      {model.note === null ? null : (
        <p role="status" className="pt-4 text-xs font-medium text-gray-500">{model.note}</p>
      )}
      {model.submitAction.errorMessage === null ? null : (
        <p role="alert" className="pt-4 text-xs text-red-500">{model.submitAction.errorMessage}</p>
      )}
      <div className="flex items-center justify-between gap-4 pt-8">
        <button
          type="button"
          data-node-id={NODE.back}
          onClick={model.pressBack}
          className="flex items-center gap-1.5 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.backArrow} className="size-4" />
          {model.back.label}
        </button>
        <PrimaryButton
          label={model.submitAction.labelOf(model.save.action as SubmitAction, model.save.label)}
          nodeId={NODE.save}
          onClick={model.pressSave}
          fullWidth={false}
          trailingArrow={false}
        />
      </div>
    </SetupCard>
  )
}
