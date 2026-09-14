import type { ReactNode } from 'react'
import { Field } from '../../components/Field'
import { FigmaAsset } from '../../components/FigmaAsset'
import { SearchSelect } from '../../components/SearchSelect'
import { TextInput } from '../../components/TextInput'
import type { ExternalSurveyFormModel } from './useExternalSurveyForm'
import { CHEVRON, NODE, SCREEN } from './spec'

export function ExternalSurveyFields({ model }: { model: ExternalSurveyFormModel }) {
  const { inputAt, selectAt, field, valueOf, setValue, consent, consentCheck } = model

  function textField(nodeId: string): ReactNode {
    const spec = inputAt(nodeId)
    return (
      <Field
        htmlFor={spec.fieldKey}
        nodeId={nodeId}
        label={spec.label}
        required={spec.required}
        error={field.errors[spec.fieldKey]}
      >
        {spec.multiline === true ? (
          <textarea
            id={spec.fieldKey}
            ref={field.registerRef(spec.fieldKey)}
            rows={3}
            value={valueOf(spec.fieldKey)}
            placeholder={spec.placeholder ?? undefined}
            onChange={(event) => setValue(spec.fieldKey, event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
          />
        ) : (
          <TextInput
            id={spec.fieldKey}
            value={valueOf(spec.fieldKey)}
            placeholder={spec.placeholder}
            type={spec.inputType}
            hasError={Boolean(field.errors[spec.fieldKey])}
            inputRef={field.registerRef(spec.fieldKey)}
            onChange={(next) => setValue(spec.fieldKey, next)}
          />
        )}
      </Field>
    )
  }

  function selectField(nodeId: string, chevron: string): ReactNode {
    const spec = selectAt(nodeId)
    return (
      <Field
        htmlFor={spec.fieldKey}
        nodeId={nodeId}
        label={spec.label}
        required={spec.required}
        error={field.errors[spec.fieldKey]}
      >
        <SearchSelect
          id={spec.fieldKey}
          placeholder={spec.placeholder}
          searchable={spec.searchable}
          disabled={!field.isSelectEnabled(spec)}
          hasError={Boolean(field.errors[spec.fieldKey])}
          sourceKey={spec.optionsSource.key}
          sourceParams={field.resolveSourceParams(spec)}
          value={field.selectValue(spec.fieldKey)}
          onSelect={(option) => field.setFieldValue(spec.fieldKey, option.value, option.label)}
          triggerRef={field.registerRef(spec.fieldKey)}
          chevron={<FigmaAsset screenId={SCREEN} nodeId={chevron} className="size-3.5" />}
        />
      </Field>
    )
  }

  return (
      <div className="flex flex-col gap-4 pt-4">
        {textField(NODE.name)}
        {textField(NODE.studentNumber)}
        {selectField(NODE.college, CHEVRON.college)}
        {selectField(NODE.department, CHEVRON.department)}
        {selectField(NODE.currentGrade, CHEVRON.currentGrade)}
        {textField(NODE.motivation)}

        {/* 묶음의 이름은 title이지 별표까지가 아니다. 그래서 aria-labelledby로
            제목을 가리키지 않는다 — 가리키면 그려진 별표가 이름에 딸려 들어가
            묶음의 이름이 '개인정보 수집 동의*'가 된다. */}
        <section
          data-node-id={NODE.consent}
          aria-label={consent.title}
          className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4"
        >
          {/* **별표가 컨트롤과 갈라져 있다.** 그림은 이 제목에 별표를 붙였고 체크
              칸의 라벨('동의합니다')에는 붙이지 않았다. 별표가 말하는 것은 아래
              칸이 필수라는 사실이므로 그 사실을 가진 곳(멤버의 required)에서 온다 —
              화면이 '여기에는 별이 있다'를 스스로 정하지 않는다. */}
          <h3 className="text-xs font-semibold text-gray-700">
            <span>{consent.title}</span>
            {consentCheck.required && <span className="text-red-500">*</span>}
          </h3>
          <p className="text-xs text-gray-500">{consent.description}</p>

          {/* 켜고 끄는 칸(input.inputType checkbox). 꺼짐을 null로 담는 것은 이
              저장소의 규칙이다(EVT-02B·EVT-05) — 'y'/null이라야 필수 판정이 이
              칸을 빈 것으로 본다. 그림은 체크 상자를 브라우저 기본 색으로 두었고,
              그 색은 글이 없어 대조가 보지 않는다. */}
          <label
            data-node-id={NODE.consentCheck}
            htmlFor={consentCheck.fieldKey}
            className="flex items-center gap-2 text-xs font-medium text-gray-700"
          >
            <input
              id={consentCheck.fieldKey}
              ref={field.registerRef(consentCheck.fieldKey)}
              type={consentCheck.inputType}
              // 체크 상자의 value는 기본이 'on'이라 대조기가 그 글을 칸의 내용으로
              // 읽는다. 켜짐은 checked가 말한다.
              value=""
              checked={valueOf(consentCheck.fieldKey) === 'y'}
              aria-required={consentCheck.required}
              aria-invalid={Boolean(field.errors[consentCheck.fieldKey]) || undefined}
              onChange={(event) =>
                field.setFieldValue(consentCheck.fieldKey, event.target.checked ? 'y' : null)
              }
              className="size-3.5 shrink-0 accent-blue-600"
            />
            <span>{consentCheck.label}</span>
          </label>
          {field.errors[consentCheck.fieldKey] ? (
            <p className="text-xs text-red-500">{field.errors[consentCheck.fieldKey]}</p>
          ) : null}
        </section>
      </div>
  )
}
