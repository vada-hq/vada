import type { ReactNode } from 'react'
import { ChoiceGroup } from '../components/ChoiceGroup'
import { Field } from '../components/Field'
import { FieldGroup } from '../components/FieldGroup'
import { NoteBox } from '../components/NoteBox'
import { SearchSelect } from '../components/SearchSelect'
import { readObjectSource } from '../data-sources/catalog'
import { resolveParams } from './params'
import { SummaryCard } from '../components/SummaryCard'
import { TextInput } from '../components/TextInput'
import { nodeIdOf } from './screens'
import type { useFieldDraft } from './useFieldDraft'
import type {
  FieldSpec,
  GroupSpec,
  NoteSpec,
  ScreenSpec,
  SummarySpec,
} from './types'
import { readScopeDisplayValue } from '../state/scopes'
import type { ScopeDraft, ScopeStore } from '../state/scopes'

// 명세의 요소 하나를 화면의 부품 하나로 옮기는 표. 여기가 한 곳이다.
//
// 왜 필요한가. 요소 유형은 스키마가 정하고(input·select·group·note·summary…),
// 각 유형을 어떤 컴포넌트로 그릴지도 규칙이 하나뿐이다. 그런데 화면마다 그
// 규칙을 손으로 다시 썼다 — ORG-01과 INV-01이 각자 renderField를 들고 있었고,
// **이미 어긋나 있었다**: ORG-01은 helperText를 넘기고 INV-01은 넘기지 않아
// 그 화면에서는 스펙에 적힌 보조 설명이 그려지지 않을 수 있었다.
//
// useFieldDraft가 '동작'에 대해 한 일을 이 파일이 '형태'에 대해 한다.
//
// 화면이 정하는 것은 이 부품들을 어디에 놓느냐뿐이다. 무엇을 그릴지는 정하지
// 않는다 — 그래서 화면을 하나 더 만들 때 이 표를 다시 쓸 일이 없다.

export interface ElementContext {
  screen: ScreenSpec
  draft: ScopeDraft
  /** note가 *다른* 스코프의 값을 읽는다. 그 화면의 초안만으로는 부족하다. */
  scopes: ScopeStore
  field: ReturnType<typeof useFieldDraft>
  /** 요약이 출처를 읽을 때 그 조회 인자가 주소에서 올 수 있다. */
  screenParams?: Record<string, string>
}

/**
 * 묶음 상자의 형태. 스펙이 아니라 design의 사실이라 화면이 고른다
 * (element-types.md — 시각은 스키마에 넣지 않는다). ORG-01 14:179는 채움,
 * INV-01 14:35는 테두리다.
 */
export interface BodyOptions {
  groupVariant?: 'filled' | 'outlined'
}

/** 입력·선택 한 칸. 표현 형태(presentation·searchable)는 스펙이 말한다. */
export function renderField(context: ElementContext, spec: FieldSpec): ReactNode {
  const { screen, draft, field } = context
  const error = field.errors[spec.fieldKey]
  const enabled = spec.type === 'select' ? field.isSelectEnabled(spec) : true

  return (
    <Field
      key={spec.fieldKey}
      htmlFor={spec.fieldKey}
      nodeId={nodeIdOf(screen, spec)}
      label={spec.label}
      required={spec.required}
      disabled={!enabled}
      error={error}
      helperText={spec.helperText}
    >
      {spec.type === 'input' ? (
        <TextInput
          id={spec.fieldKey}
          value={draft.values[spec.fieldKey] ?? ''}
          placeholder={spec.placeholder}
          type={spec.inputType}
          hasError={Boolean(error)}
          onChange={(value) => field.setFieldValue(spec.fieldKey, value === '' ? null : value)}
          inputRef={field.registerRef(spec.fieldKey)}
        />
      ) : spec.presentation === 'choiceGroup' ? (
        <ChoiceGroup
          id={spec.fieldKey}
          disabled={!enabled}
          labelledBy={`${spec.fieldKey}-label`}
          hasError={Boolean(error)}
          sourceKey={spec.optionsSource.key}
          sourceParams={field.resolveSourceParams(spec)}
          value={field.selectValue(spec.fieldKey)}
          onSelect={(option) => field.setFieldValue(spec.fieldKey, option.value, option.label)}
          triggerRef={field.registerRef(spec.fieldKey)}
        />
      ) : (
        <SearchSelect
          id={spec.fieldKey}
          placeholder={enabled ? spec.placeholder : (spec.disabledPlaceholder ?? spec.placeholder)}
          searchable={spec.searchable}
          disabled={!enabled}
          hasError={Boolean(error)}
          sourceKey={spec.optionsSource.key}
          sourceParams={field.resolveSourceParams(spec)}
          value={field.selectValue(spec.fieldKey)}
          onSelect={(option) => field.setFieldValue(spec.fieldKey, option.value, option.label)}
          triggerRef={field.registerRef(spec.fieldKey)}
        />
      )}
    </Field>
  )
}

/**
 * 다른 스코프의 값을 이어 붙인 안내. 값이 없는 참조는 빼고, 남는 것이 없으면
 * 안내 자체를 그리지 않는다 — 빈 상자를 그리면 없는 정보가 있는 것처럼 보인다.
 */
export function renderNote(context: ElementContext, spec: NoteSpec, key: string): ReactNode {
  const parts = spec.fieldRefs
    .map((ref) => readScopeDisplayValue(context.scopes, ref.scope, ref.fieldKey))
    .filter((part): part is string => part !== null)

  if (parts.length === 0) {
    return null
  }
  return (
    <NoteBox key={key} nodeId={key} text={`${spec.prefix ?? ''}${parts.join(spec.separator ?? ' ')}`} />
  )
}

/**
 * 요약 카드. 값이 **명세에 적혀 있거나 데이터에서 온다.**
 *
 * 한동안 명세의 값만 그렸다. 그런데 INV-01의 학생회 요약이 초대 코드가 찾아낸
 * 것으로 바뀌면서 — 그 전에는 어떤 코드를 넣어도 같은 학생회가 나왔다 — 데이터
 * 쪽이 필요해졌다. 라벨 없는 묶음(행사 머리)은 여전히 화면이 직접 그린다.
 */
export function renderSummary(
  context: ElementContext,
  spec: SummarySpec,
  key: string,
): ReactNode {
  const screenId = context.screen.screenId
  if (!spec.items) {
    throw new Error(`${screenId}의 요약 카드에는 items가 필요합니다.`)
  }

  const row =
    spec.dataSourceKey === undefined
      ? null
      : readObjectSource(
          spec.dataSourceKey,
          resolveParams(spec.params, {
            screenParams: context.screenParams,
            fields: context.draft.values,
          }),
        )

  const title = spec.titleField === undefined ? spec.title : String(row?.[spec.titleField] ?? '')
  if (!title) {
    throw new Error(`${screenId}의 요약 카드에는 title이나 titleField가 필요합니다.`)
  }

  const items = spec.items.map((item) => {
    const value = item.field === undefined ? item.value : String(row?.[item.field] ?? '')
    if (value === undefined) {
      throw new Error(
        `${screenId}의 요약 항목 '${item.label}'은 값도 조각도 가리키지 않습니다.`,
      )
    }
    // 이 표는 라벨이 그려지는 요약만 그린다.
    return { label: item.label!, value }
  })
  return <SummaryCard key={key} nodeId={key} eyebrow={spec.eyebrow} title={title} items={items} />
}

/** 묶음. 멤버 필드는 여기 안에서만 나오고 바깥 나열에서는 빠진다. */
export function renderGroup(
  context: ElementContext,
  spec: GroupSpec,
  key: string,
  options: BodyOptions = {},
): ReactNode {
  const fieldByKey = fieldsByKey(context.screen)
  return (
    <FieldGroup
      key={key}
      nodeId={key}
      title={spec.title}
      description={spec.description}
      variant={options.groupVariant}
    >
      {spec.memberFieldKeys.map((fieldKey) => {
        const member = fieldByKey.get(fieldKey)
        return member ? renderField(context, member) : null
      })}
    </FieldGroup>
  )
}

function fieldsByKey(screen: ScreenSpec): Map<string, FieldSpec> {
  return new Map(
    screen.elements
      .map((element) => element.spec)
      .filter((spec): spec is FieldSpec => spec.type === 'input' || spec.type === 'select')
      .map((spec) => [spec.fieldKey, spec]),
  )
}

/**
 * 화면 본문. 명세의 elements 순서를 그대로 따른다 — 순서는 design이 정한 것이고
 * 구현이 다시 정할 근거가 없다.
 *
 * 버튼은 빠진다. 버튼이 놓이는 자리는 본문이 아니라 화면의 발이고, 그 배치는
 * 화면마다 다르다.
 */
export function renderBody(context: ElementContext, options: BodyOptions = {}): ReactNode[] {
  const screen = context.screen
  const groupedFieldKeys = new Set(
    screen.elements
      .map((element) => element.spec)
      .filter((spec): spec is GroupSpec => spec.type === 'group')
      .flatMap((spec) => spec.memberFieldKeys),
  )

  return screen.elements.map((element, index) => {
    const spec = element.spec
    const key = element.source.nodeId ?? String(index)

    switch (spec.type) {
      case 'button':
        return null
      case 'note':
        return renderNote(context, spec, key)
      case 'summary':
        return renderSummary(context, spec, key)
      case 'group':
        return renderGroup(context, spec, key, options)
      case 'input':
      case 'select':
        return groupedFieldKeys.has(spec.fieldKey) ? null : renderField(context, spec)
      default:
        // list·itemList는 아직 이 표에 없다(ORG-02와 대시보드가 각자 그린다).
        // 조용히 빠뜨리지 않고 어느 화면의 무엇인지 알린다.
        throw new Error(
          `${screen.screenId}: 부품 표가 아직 다루지 않는 요소 유형입니다: ${spec.type}`,
        )
    }
  })
}
