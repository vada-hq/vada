// specs/figma의 화면 동작 명세(JSON) 형태. packages/contracts/schemas와 대응한다.

export interface EnabledWhenCondition {
  fieldKey: string
  operator: 'hasValue'
}

export interface InputSpec {
  type: 'input'
  fieldKey: string
  label: string
  placeholder: string | null
  helperText?: string
  initialValue: string | null
  inputType: string
  valueType: string
  required: boolean
  validation: unknown[]
}

export interface SelectSpec {
  type: 'select'
  fieldKey: string
  label: string
  placeholder: string | null
  disabledPlaceholder?: string
  helperText?: string
  initialValue: string | null
  valueType: string
  required: boolean
  initiallyDisabled: boolean
  searchable: boolean
  // 선택 UI 형태. 생략하면 dropdown.
  presentation?: 'dropdown' | 'choiceGroup'
  optionsSource: {
    key: string
    params?: Record<string, string>
  }
  enabledWhen?: EnabledWhenCondition[]
  resetOnChangeOf?: string[]
}

export interface ButtonAction {
  type: 'navigate'
  targetScreenId: string
  executeWhen?: {
    type: 'allRequiredFieldsHaveValue'
    scope: 'screen'
  }
  onExecutionBlocked?: {
    type: 'showMissingRequiredFields'
    focus: 'firstMissingField'
  }
}

export interface ButtonSpec {
  type: 'button'
  label: string
  description?: string
  badge?: string
  initiallyDisabled: boolean
  action: ButtonAction
}

// 다른 상태 스코프의 필드 값을 읽어 표시하는 파생 표시 요소.
// 구현은 fieldRefs의 표시 라벨을 separator로 이어 prefix 뒤에 렌더하고,
// 값이 없는 참조는 생략한다.
export interface NoteSpec {
  type: 'note'
  prefix?: string
  separator?: string
  fieldRefs: Array<{
    scope: string
    fieldKey: string
  }>
}

// 여러 입력 필드를 하나의 의미 단위로 묶고 그 제목·설명을 담는 요소.
// 구현은 memberFieldKeys의 필드를 묶음 안에 렌더하고 바깥 나열에서는 건너뛴다.
export interface GroupSpec {
  type: 'group'
  title: string
  description?: string | null
  memberFieldKeys: string[]
}

export type ElementSpec = InputSpec | SelectSpec | ButtonSpec | NoteSpec | GroupSpec

export type FieldSpec = InputSpec | SelectSpec

export interface ScreenElement {
  source: {
    nodeId: string
    name: string
    figmaType: string
  }
  spec: ElementSpec
}

export interface ScreenMeta {
  eyebrow?: string | null
  title: string
  description?: string | null
  footerNote?: string | null
}

export interface FlowsCatalog {
  schemaVersion: number
  flows: Array<{
    key: string
    screens: Array<{
      screenId: string
      label: string
    }>
  }>
}

export interface FlowStep {
  label: string
  step: number
  total: number
}

export interface ScreenSpec {
  schemaVersion: number
  screenId: string
  stateScopeKey?: string
  meta?: ScreenMeta
  source: {
    pageName: string
    nodeId: string
    name: string
    figmaType: string
  }
  elements: ScreenElement[]
}
