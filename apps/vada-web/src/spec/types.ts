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
  initialValue: string | null
  valueType: string
  required: boolean
  initiallyDisabled: boolean
  searchable: boolean
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

export type ElementSpec = InputSpec | SelectSpec | ButtonSpec

export interface ScreenElement {
  source: {
    nodeId: string
    name: string
    figmaType: string
  }
  spec: ElementSpec
}

export interface ScreenMeta {
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
