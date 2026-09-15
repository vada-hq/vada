import { FigmaAsset } from '../../components/FigmaAsset'
import { elementByNodeId } from '../../spec/screens'
import { evt05 } from '../../spec/screen-specs/evt05'
import type { GroupSpec } from '../../spec/types'
import { ASSET, NODE, SCREEN, inputAt, summaryAt } from './survey-spec'
import { SurveyCheckField, SurveyChoiceField, SurveyDateTimeInput, type SurveyFieldProps } from './SurveyFields'

// 현재 명세에는 모집 설정 저장 단추가 없다. 이 컴포넌트는 초안 입력만 맡는다.
export function SurveyRecruitment({ values, onChangeValue }: SurveyFieldProps) {
  const recruit = elementByNodeId(evt05, NODE.recruitGroup).spec as GroupSpec
  const applyStart = inputAt(NODE.applyStart)
  const applyEnd = inputAt(NODE.applyEnd)
  const completionNote = inputAt(NODE.completionNote)
  const duesNote = summaryAt(NODE.duesNote)
  return (
    <section
      data-node-id={NODE.recruitGroup}
      aria-labelledby="recruit-title"
      className="flex flex-col gap-3.5 rounded-md border border-gray-200 bg-white px-3.5 py-3.5"
    >
      <h3 id="recruit-title" className="text-xs font-semibold text-gray-700">
        {recruit.title}
      </h3>

      <div data-node-id={NODE.applyStart} className="flex flex-col gap-1.5">
        <label
          htmlFor={applyStart.fieldKey}
          className="text-xs font-medium text-gray-700"
        >
          <span>{applyStart.label}</span>
          {applyStart.required && <span className="text-red-500">*</span>}
        </label>
        <div className="flex items-center gap-2">
          <SurveyDateTimeInput spec={applyStart} invalid={false} values={values} onChangeValue={onChangeValue} />
          {/* 조각 사이의 글자는 design의 것이다. */}
          <span className="shrink-0 text-xs text-gray-400">~</span>
          <div data-node-id={NODE.applyEnd} className="relative w-full">
            {/* 라벨이 이 자리에 그려지지 않는 칸이다(labelHidden). 그래도
                읽어 주는 이름은 있어야 한다. */}
            <label htmlFor={applyEnd.fieldKey} className="sr-only">
              {applyEnd.label}
            </label>
            <SurveyDateTimeInput spec={applyEnd} invalid={(values[applyEnd.fieldKey] ?? '') === ''} values={values} onChangeValue={onChangeValue} />
            <FigmaAsset
              screenId={SCREEN}
              nodeId={ASSET.applyEndAlert}
              className="absolute top-1/2 right-2.5 size-2.5 -translate-y-1/2"
            />
          </div>
        </div>
        {/* 명세의 helperText. 늘 그려지는 보조 설명이고, 색은 design이 정했다. */}
        <p className="flex items-center gap-1.5 text-xs text-red-500">
          <FigmaAsset
            screenId={SCREEN}
            nodeId={ASSET.applyEndNote}
            className="size-2.5 shrink-0"
          />
          {applyEnd.helperText}
        </p>
      </div>

      <div data-node-id={NODE.applyMethod} className="flex flex-col gap-1.5">
        <SurveyChoiceField nodeId={NODE.applyMethod} labelClass="text-xs font-medium text-gray-700" values={values} onChangeValue={onChangeValue} />
      </div>

      <SurveyCheckField nodeId={NODE.waitlist} values={values} onChangeValue={onChangeValue} />

      <div className="flex flex-col gap-2">
        <SurveyCheckField nodeId={NODE.duesCheck} values={values} onChangeValue={onChangeValue} />
        <p
          data-node-id={NODE.duesNote}
          className="flex items-start gap-2 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700"
        >
          <FigmaAsset
            screenId={SCREEN}
            nodeId={ASSET.duesNote}
            className="mt-0.5 size-3 shrink-0"
          />
          <span>{duesNote.title}</span>
        </p>
      </div>

      <div data-node-id={NODE.completionNote} className="flex flex-col gap-1.5">
        <label
          htmlFor={completionNote.fieldKey}
          className="text-xs font-medium text-gray-700"
        >
          {completionNote.label}
        </label>
        <textarea
          id={completionNote.fieldKey}
          rows={3}
          value={values[completionNote.fieldKey] ?? ''}
          placeholder={completionNote.placeholder ?? undefined}
          onChange={(event) => onChangeValue(completionNote.fieldKey, event.target.value === '' ? null : event.target.value)}
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400"
        />
      </div>
    </section>
  )
}
