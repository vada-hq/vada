import { Field } from '../../components/Field'
import { TextInput } from '../../components/TextInput'
import type { SubmitAction } from '../../spec/types'
import { CheckField, ChoiceField, DateTimeInput, Section, TextField } from './EventBasicsFields'
import { NODE, SECTION_TITLE, SUB_BLOCK } from './spec'
import type { EventBasicsDraftModel } from './useEventBasicsDraft'

/** 기본정보의 다섯 폼 섹션과 저장 동작을 그린다. */
export function EventBasicsForm({ model }: { model: EventBasicsDraftModel }) {
  const startAt = model.specs.inputAt(NODE.startAt)
  const endAt = model.specs.inputAt(NODE.endAt)
  const place = model.specs.inputAt(NODE.place)
  return (
    <>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
        <Section
          model={model}
          nodeId={NODE.infoGroup}
          titleClass="text-xs font-semibold text-gray-500"
        >
          <TextField model={model} nodeId={NODE.title} />
          <TextField model={model} nodeId={NODE.intro} />
          <TextField model={model} nodeId={NODE.purpose} />
        </Section>

        <Section model={model} nodeId={NODE.whenGroup} titleClass={SECTION_TITLE}>
          <Field
            htmlFor={startAt.fieldKey}
            nodeId={NODE.startAt}
            label={startAt.label}
            required={startAt.required}
          >
            <DateTimeInput model={model} spec={startAt} />
          </Field>
          <div data-node-id={NODE.endAt} className="flex flex-col gap-1.5">
            <span className="flex items-center gap-3">
              <label htmlFor={endAt.fieldKey} className="text-xs font-medium text-gray-700">
                {endAt.label}
              </label>
              <CheckField model={model} nodeId={NODE.endUnset} />
            </span>
            <DateTimeInput model={model} spec={endAt} />
          </div>
        </Section>

        <Section model={model} nodeId={NODE.placeGroup} titleClass={SECTION_TITLE}>
          <div data-node-id={NODE.place} className="flex flex-col gap-1.5">
            <span className="flex items-center gap-3">
              <label htmlFor={place.fieldKey} className="text-xs font-medium text-gray-700">
                {place.label}
              </label>
              <CheckField model={model} nodeId={NODE.placeUnset} />
            </span>
            <TextInput
              id={place.fieldKey}
              value={model.valueOf(place.fieldKey)}
              placeholder={place.placeholder}
              type={place.inputType}
              onChange={(next) => model.setValue(place.fieldKey, next)}
            />
            <TextField model={model} nodeId={NODE.address} />
            <TextField model={model} nodeId={NODE.placeDetail} />
          </div>
        </Section>

        <Section model={model} nodeId={NODE.joinGroup} titleClass={SECTION_TITLE}>
          <TextField model={model} nodeId={NODE.audience} />
          <ChoiceField model={model} nodeId={NODE.feeType}>
            <div className={SUB_BLOCK}>
              <p
                data-node-id={NODE.feeNote}
                className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700"
              >
                {model.specs.feeNote.title}
              </p>
              <TextField model={model} nodeId={NODE.paidAmount} />
              <TextField model={model} nodeId={NODE.unpaidAmount} />
              <TextField model={model} nodeId={NODE.payGuide} />
            </div>
          </ChoiceField>
          <ChoiceField model={model} nodeId={NODE.capacityType}>
            <div className={SUB_BLOCK}>
              <TextField model={model} nodeId={NODE.capacity} />
            </div>
          </ChoiceField>
        </Section>

        <Section model={model} nodeId={NODE.hostGroup} titleClass={SECTION_TITLE}>
          <TextField model={model} nodeId={NODE.hostDepartment} />
          <TextField model={model} nodeId={NODE.hostPerson} />
          <TextField model={model} nodeId={NODE.contact} />
          <TextField model={model} nodeId={NODE.notice} />
        </Section>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-gray-100 px-6 py-4">
        <p className="text-xs text-gray-400">{model.specs.footerNote}</p>
        <span className="flex shrink-0 gap-2">
          <button
            type="button"
            data-node-id={NODE.cancel}
            onClick={() => model.goBack(model.specs.cancel)}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {model.specs.cancel.label}
          </button>
          <button
            type="button"
            data-node-id={NODE.save}
            onClick={model.pressSave}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            {model.submitAction.labelOf(
              model.specs.save.action as SubmitAction,
              model.specs.save.label,
            )}
          </button>
        </span>
      </div>
      {model.submitAction.errorMessage === null ? null : (
        <p role="alert" className="px-6 pb-4 text-xs text-red-500">
          {model.submitAction.errorMessage}
        </p>
      )}
    </>
  )
}
