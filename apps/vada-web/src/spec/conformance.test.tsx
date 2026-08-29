import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ScreenRouter } from '../screens/ScreenRouter'
import { ALL_SCREENS, drawsTitle, exampleParamsOf } from './screens'
import type { FieldSpec, ListSpec, ScreenSpec } from './types'
import { readObjectSource } from '../data-sources/catalog'
import { drawsElement } from './drawn-when'
import { resolveParams } from './params'

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
    <ScreenRouter
      screenId={screenId}
      screenParams={exampleParamsOf(screenId)}
      scopes={{}}
      onChangeScope={() => {}}
      onNavigate={() => {}}
    />,
  )
}

// 라벨이 없는 필드가 있다 — 디자인에 라벨 노드가 없는 컨트롤이다. 그때 이 컨트롤을
// 부르는 말은 안내 문구다(EVT-04의 거르기 넷은 빈 네모라 '소속'조차 그려져 있지 않다).
// **켜고 끄는 칸의 별표는 라벨 옆에 없다.** 그림이 그것을 묶음의 제목에 그렸다
// (EXT-02A 30:7217 '개인정보 수집 동의*' / 30:7226 '동의합니다'). 필수인 것은
// 동의라는 사실이지 '동의합니다'라는 말이 아니므로 그 자리가 맞다.
//
// 그래서 이 칸만 이름에 별을 붙이지 않는다. 대신 필수라는 사실을 aria-required로
// 말해야 하고, 아래 검사가 그것을 강제한다 — 빠져나갈 구멍이 아니라 다른 문이다.
function marksRequiredInName(spec: FieldSpec) {
  return !(spec.type === 'input' && spec.inputType === 'checkbox')
}

function accessibleName(spec: FieldSpec) {
  const star = spec.required && marksRequiredInName(spec) ? '*' : ''
  return `${spec.label ?? spec.placeholder ?? ''}${star}`
}

function listsOf(spec: ScreenSpec): ListSpec[] {
  return spec.elements
    .map((element) => element.spec)
    .filter((element): element is ListSpec => element.type === 'list')
}

// 요소 유형과 표현 형태에 따라 컨트롤의 ARIA role이 정해진다.
// input은 inputType이 role까지 정한다 — <input type="search">는 textbox가 아니라
// searchbox다(MY-01의 업무 검색).
//
// 날짜·시간 칸에는 role이 아예 없다. 브라우저마다 다르게 그리는 컨트롤이라
// ARIA가 이름을 정해 두지 않았다(FIN-REQ-01의 '필요한 날짜'가 처음이다).
// 없는 역할을 지어내 붙이면 화면이 실제로 그런 척하게 되므로, 그 칸은 라벨로 찾는다.
// 파일 칸도 그렇다. <input type="file">은 브라우저가 '고르기' 조작으로 그리는
// 것이라 글을 적는 칸이 아니고, ARIA에도 정해진 이름이 없다(ORG-07B가 처음이다).
const ROLELESS_INPUT_TYPES = new Set(['date', 'time', 'datetime-local', 'file'])

function roleOf(spec: FieldSpec) {
  // inputType이 role까지 정한다 - search는 searchbox, checkbox는 checkbox다.
  if (spec.type === 'input') {
    if (spec.inputType === 'search') return 'searchbox'
    if (spec.inputType === 'checkbox') return 'checkbox'
    // 수를 받는 칸은 글을 적는 칸이 아니다 — <input type="number">는 위아래로
    // 올리고 내리는 조작이라 ARIA가 spinbutton이라 부른다(EVT-02B의 참가비 금액과
    // 정원 인원이 처음이다).
    if (spec.inputType === 'number') return 'spinbutton'
    return 'textbox'
  }
  return spec.presentation === 'choiceGroup' ? 'radiogroup' : 'combobox'
}

// 접근성 이름으로 컨트롤을 집는다. 역할이 있으면 역할까지 함께 본다 —
// 같은 이름의 다른 컨트롤이 있을 수 있기 때문이다.
function controlOf(spec: FieldSpec): HTMLElement {
  if (spec.type === 'input' && ROLELESS_INPUT_TYPES.has(spec.inputType)) {
    return screen.getByLabelText(accessibleName(spec))
  }
  return screen.getByRole(roleOf(spec), { name: accessibleName(spec) })
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
      expect(controlOf(field), `${field.fieldKey}의 라벨·필수 표시`).toBeInTheDocument()
      // 이름에 별을 담지 않는 칸은 그 사실을 다른 곳에서 말해야 한다. 말하지
      // 않으면 화면을 읽어 주는 기계에게 그 칸은 그냥 선택이다.
      if (field.required && !marksRequiredInName(field)) {
        expect(controlOf(field), `${field.fieldKey}의 필수 표시`).toHaveAttribute(
          'aria-required',
          'true',
        )
      }
    }
  })

  it('input의 placeholder와 inputType을 소비한다', () => {
    renderScreen(screenId)
    for (const field of fieldsOf(spec)) {
      if (field.type !== 'input') continue
      const control = controlOf(field)
      // 여러 줄을 받는 칸은 textarea라 type 속성이 아예 없다. 역할(textbox)은 같다.
      if (field.multiline !== true) {
        expect(control, `${field.fieldKey}의 inputType`).toHaveAttribute('type', field.inputType)
      }
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

  it('화면 카피(meta)와 묶음(group)을 렌더한다', () => {
    renderScreen(screenId)
    if (spec.meta) {
      // meta.title이 늘 그려지는 것은 아니다. 판정은 구현과 같은 함수가 한다 —
      // 두 곳에 적으면 언젠가 갈린다.
      if (drawsTitle(spec)) {
        // 같은 글이 안쪽 섹션의 머리로 또 나올 수 있다 — FIN-00은 화면 이름도
        // '전체 재정 현황'이고 그 안의 첫 칸 이름도 같다. 깊이로 가르려 해 봤지만
        // 겹쳐 뜨는 화면의 제목은 h1이 아니다(모달의 머리다). **있는지를 보지
        // 몇 개인지를 보지 않는다** — 아래 카피와 같은 규칙이다.
        expect(
          screen.getAllByRole('heading', { name: spec.meta.title }).length,
        ).toBeGreaterThan(0)
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
      // 데이터가 허락할 때만 그려지는 자리는 아래 검사가 **양쪽으로** 본다.
      // 여기서 그려지기를 요구하면 막힌 값에서 거짓 경보가 난다.
      if (element.drawnWhen !== undefined) continue
      // 아이콘의 대체 텍스트가 이름에 섞이므로 부분 일치로 본다. 그래서 짧은
      // 라벨이 긴 라벨을 함께 집는다 — EVT-TASK-01의 '업무' 갈피는 '업무 추가'
      // 버튼도 집는다. 있는지를 보지 몇 개인지를 보지 않는다(meta 카피와 같다).
      // 상황에 따라 글이 바뀌는 버튼은 어느 쪽이든 그려지면 된다. 무엇이 그려질지는
      // 그때의 값이 정하고, 명세가 갖는 것은 두 글과 그것을 가르는 조건이다.
      const labels = [element.spec.label, element.spec.labelWhenAnyItemIs?.label].filter(
        (label): label is string => typeof label === 'string',
      )
      expect(
        labels.some(
          (label) => screen.queryAllByRole('button', { name: new RegExp(label) }).length > 0,
        ),
        `${screenId}의 버튼 '${labels.join(' 또는 ')}'`,
      ).toBe(true)
    }
  })

  // **양쪽으로 본다.** 허락하면 그려지고 막으면 안 그려져야 한다 — 한쪽만 보면
  // '늘 안 그린다'도 통과한다. 예시 인자가 어느 쪽을 주든 검사가 성립한다.
  it('데이터가 허락할 때만 그리는 요소는 그 답을 따른다', () => {
    renderScreen(screenId)
    const screenParams = exampleParamsOf(screenId)
    for (const element of spec.elements) {
      if (element.drawnWhen === undefined) continue
      const label = (element.spec as { label?: string }).label
      if (typeof label !== 'string') continue
      const allowed = drawsElement(element, { screenParams })
      const drawn = screen.queryAllByRole('button', { name: new RegExp(label) }).length > 0
      expect(
        drawn,
        `${screenId}의 '${label}' — ${element.drawnWhen.dataSourceKey}.${element.drawnWhen.field}가 ${allowed ? '허락했다' : '막았다'}`,
      ).toBe(allowed)
    }
  })

  it('steps의 모든 단계와 데이터가 가리킨 현재 단계를 렌더한다', () => {
    renderScreen(screenId)
    const screenParams = exampleParamsOf(screenId)
    for (const element of spec.elements) {
      if (element.spec.type !== 'steps') continue
      const stepSpec = element.spec
      const holder = document.querySelector<HTMLElement>(
        `[data-node-id="${element.source?.nodeId ?? ""}"]`,
      )
      expect(holder, `${screenId}의 steps 등록 자리`).not.toBeNull()
      if (holder === null) continue

      for (const item of stepSpec.items) {
        expect(within(holder).getByText(item.label)).toBeInTheDocument()
      }
      // 지금 어느 단계인지를 서버가 알 수도 있고(구매 요청의 상태) 이 화면을 여는
      // 동안에만 있을 수도 있다(파일을 올리고 결과를 보는 두 단계). 출처가 없으면
      // 첫 단계에서 시작한다.
      const currentKey =
        stepSpec.dataSourceKey === undefined || stepSpec.currentField === undefined
          ? stepSpec.items[0].key
          : String(
              readObjectSource(
                stepSpec.dataSourceKey,
                resolveParams(stepSpec.params, { screenParams }),
              )[stepSpec.currentField],
            )
      const current = stepSpec.items.find((item) => item.key === currentKey)
      expect(current, `${screenId}의 현재 단계가 items에 있어야 함`).toBeDefined()
      expect(within(holder).getByText(current?.label ?? '')).toHaveAttribute(
        'aria-current',
        'step',
      )
    }
  })

  it('summary의 데이터 소제목과 상태 딱지를 렌더한다', () => {
    renderScreen(screenId)
    const screenParams = exampleParamsOf(screenId)
    for (const element of spec.elements) {
      if (element.spec.type !== 'summary') continue
      const summary = element.spec
      if (summary.eyebrowField === undefined && summary.status === undefined) continue
      if (summary.dataSourceKey === undefined) {
        throw new Error(`${screenId}의 데이터 요약에 dataSourceKey가 없습니다.`)
      }
      const holder = document.querySelector<HTMLElement>(
        `[data-node-id="${element.source?.nodeId ?? ""}"]`,
      )
      expect(holder, `${screenId}의 summary 등록 자리`).not.toBeNull()
      if (holder === null) continue
      const row = readObjectSource(
        summary.dataSourceKey,
        resolveParams(summary.params, { screenParams }),
      )
      if (summary.eyebrowField !== undefined) {
        expect(within(holder).getByText(String(row[summary.eyebrowField]))).toBeInTheDocument()
      }
      if (summary.status !== undefined) {
        expect(within(holder).getByText(String(row[summary.status[0].field]))).toBeInTheDocument()
      }
    }
  })
})
