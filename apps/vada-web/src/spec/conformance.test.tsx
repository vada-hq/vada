import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ScreenRouter } from '../screens/ScreenRouter'
import { ALL_SCREENS } from './screens'
import type { FieldSpec, ListSpec, ScreenSpec } from './types'

// 스펙 필드 소비 커버리지: 기대값을 스펙 JSON에서 읽어 화면과 대조한다.
// 하드코딩한 단언이 아니라서, 스펙을 고치면 이 검사가 자동으로 따라간다.
// 스키마에 필드를 추가하면 여기에 단언을 한 줄 늘리는 것이 완료 조건이다.
//
// 화면 목록을 손으로 들고 있지 않는다. 예전에는 세 화면만 적혀 있었고, 그래서
// INV-01이 스펙의 helperText를 그리지 않아도 아무도 몰랐다 — 붙이는 것을 잊을
// 자리가 있으면 언젠가 잊는다.
const SCREENS: Array<{ screenId: string; spec: ScreenSpec }> = ALL_SCREENS.map((spec) => ({
  screenId: spec.screenId,
  spec,
}))

function renderScreen(screenId: string) {
  render(
    <ScreenRouter screenId={screenId} scopes={{}} onChangeScope={() => {}} onNavigate={() => {}} />,
  )
}

function accessibleName(spec: FieldSpec) {
  return `${spec.label}${spec.required ? '*' : ''}`
}

function listsOf(spec: ScreenSpec): ListSpec[] {
  return spec.elements
    .map((element) => element.spec)
    .filter((element): element is ListSpec => element.type === 'list')
}

// 요소 유형과 표현 형태에 따라 컨트롤의 ARIA role이 정해진다.
// input은 inputType이 role까지 정한다 — <input type="search">는 textbox가 아니라
// searchbox다(MY-01의 업무 검색).
function roleOf(spec: FieldSpec) {
  if (spec.type === 'input') return spec.inputType === 'search' ? 'searchbox' : 'textbox'
  return spec.presentation === 'choiceGroup' ? 'radiogroup' : 'combobox'
}

function fieldsOf(spec: ScreenSpec): FieldSpec[] {
  return spec.elements
    .map((element) => element.spec)
    .filter((element): element is FieldSpec => element.type === 'input' || element.type === 'select')
}

describe.each(SCREENS)('$screenId 스펙 준수', ({ screenId, spec }) => {
  it('목록(list)의 초기 항목·루트·추가 조작을 렌더한다', () => {
    renderScreen(screenId)
    for (const list of listsOf(spec)) {
      if (list.rootItem) {
        expect(screen.getByText(list.rootItem.initialName)).toBeInTheDocument()
      }
      expect(screen.getByRole('button', { name: new RegExp(list.addLabel) })).toBeInTheDocument()
      // 초기 항목은 다른 필드의 초기값이 정하므로 그 값 기준으로 확인한다.
      const trigger = spec.elements
        .map((element) => element.spec)
        .find(
          (element) =>
            (element.type === 'input' || element.type === 'select') &&
            element.fieldKey === list.initialItems?.fieldKey,
        )
      const initialValue = trigger && 'initialValue' in trigger ? trigger.initialValue : null
      for (const item of list.initialItems?.byValue[initialValue ?? ''] ?? []) {
        expect(screen.getByText(item), `초기 항목 ${item}`).toBeInTheDocument()
      }
    }
  })

  it('모든 필드의 label과 required를 렌더한다', () => {
    renderScreen(screenId)
    for (const field of fieldsOf(spec)) {
      // 라벨이 없는 필드(ORG-02의 조직 구성 방식)는 접근성 이름을 만들 근거가 없다.
      if (field.label === undefined) {
        continue
      }
      expect(
        screen.getByRole(roleOf(field), { name: accessibleName(field) }),
        `${field.fieldKey}의 라벨·필수 표시`,
      ).toBeInTheDocument()
    }
  })

  it('input의 placeholder와 inputType을 소비한다', () => {
    renderScreen(screenId)
    for (const field of fieldsOf(spec)) {
      if (field.type !== 'input') continue
      const control = screen.getByRole(roleOf(field), { name: accessibleName(field) })
      expect(control, `${field.fieldKey}의 inputType`).toHaveAttribute('type', field.inputType)
      if (field.placeholder !== null) {
        expect(control, `${field.fieldKey}의 placeholder`).toHaveAttribute(
          'placeholder',
          field.placeholder,
        )
      }
    }
  })

  it('활성 select의 placeholder를 소비한다', () => {
    renderScreen(screenId)
    for (const field of fieldsOf(spec)) {
      // 비활성(enabledWhen 미충족) 필드는 disabledPlaceholder를 쓰므로 제외한다.
      if (field.type !== 'select' || field.presentation === 'choiceGroup') continue
      if (field.initiallyDisabled || field.placeholder === null) continue
      const control = screen.getByRole('combobox', { name: accessibleName(field) })
      // 검색되는 선택은 입력칸이라 placeholder가 속성이고, 안 되는 선택은 버튼이라
      // 안내 문구가 글이다. 같은 스펙 값이 형태에 따라 다른 자리에 놓인다.
      if (field.searchable) {
        expect(control, `${field.fieldKey}의 placeholder`).toHaveAttribute(
          'placeholder',
          field.placeholder,
        )
      } else {
        expect(control, `${field.fieldKey}의 안내 문구`).toHaveTextContent(field.placeholder)
      }
    }
  })

  it('helperText를 렌더한다', () => {
    renderScreen(screenId)
    for (const field of fieldsOf(spec)) {
      if (!field.helperText) continue
      expect(screen.getByText(field.helperText), `${field.fieldKey}의 helperText`).toBeInTheDocument()
    }
  })

  // meta.title이 늘 화면에 그려지는 것은 아니다. INV-01의 design(14:1)에는 화면
  // 제목이 아예 없다 — 거기서 meta.title은 그려지는 카피가 아니라 화면의 이름이다.
  // 하나뿐인 사실이므로 규칙으로 만들지 않고 여기 적어 둔다(docs/BACKLOG.md).
  const TITLE_NOT_DRAWN = new Set(['INV-01'])

  it('화면 카피(meta)와 묶음(group)을 렌더한다', () => {
    renderScreen(screenId)
    if (spec.meta) {
      if (!TITLE_NOT_DRAWN.has(screenId)) {
        expect(screen.getByRole('heading', { name: spec.meta.title })).toBeInTheDocument()
      }
      // 같은 카피가 여러 자리에 놓일 수 있다 — MY-01은 눈썹과 제목이 같은 글이고
      // 옆 메뉴에도 같은 이름이 있다. 있는지를 보지 몇 개인지를 보지 않는다.
      for (const copy of [spec.meta.eyebrow, spec.meta.description, spec.meta.footerNote]) {
        if (copy) expect(screen.getAllByText(copy).length).toBeGreaterThan(0)
      }
    }
    for (const element of spec.elements) {
      if (element.spec.type !== 'group') continue
      const group = screen.getByRole('region', { name: element.spec.title })
      if (element.spec.description) {
        expect(within(group).getByText(element.spec.description)).toBeInTheDocument()
      }
    }
  })

  it('모든 버튼의 label을 렌더한다', () => {
    renderScreen(screenId)
    for (const element of spec.elements) {
      if (element.spec.type !== 'button') continue
      expect(
        screen.getByRole('button', { name: new RegExp(element.spec.label) }),
      ).toBeInTheDocument()
    }
  })
})
