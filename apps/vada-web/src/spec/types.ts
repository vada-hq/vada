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
  // 디자인에 라벨이 없는 선택(ORG-02의 조직 구성 방식)은 key 자체가 없다.
  label?: string
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
  // 선택지마다 곁들이는 건수의 출처. 선택지는 명세가, 건수는 데이터가 정한다.
  optionCounts?: { dataSourceKey: string }
  optionsSource: {
    key: string
    params?: Record<string, string>
  }
  enabledWhen?: EnabledWhenCondition[]
  resetOnChangeOf?: string[]
}

interface ExecutionGate {
  executeWhen?: {
    type: 'allRequiredFieldsHaveValue'
    scope: 'screen'
  }
  onExecutionBlocked?: {
    type: 'showMissingRequiredFields'
    focus: 'firstMissingField'
  }
}

export interface NavigateAction extends ExecutionGate {
  type: 'navigate'
  targetScreenId: string
}

// 데이터 전송. 경로·payload 스코프·상태 문구는 mutations.json이 갖고
// 버튼은 key만 참조한다. 스코프 수명 이벤트는 onSuccess에서만 발생한다.
export interface SubmitAction extends ExecutionGate {
  type: 'submit'
  mutationKey: string
  onSuccess: {
    navigate?: string
    scopeEvent?: 'complete' | 'cancel'
  }
}

// 누르면 무엇이 일어나는지 아직 정해지지 않았다. 대상 화면 id를 지어내는
// 대신 무엇이 미정인지를 남긴다.
export interface PendingAction extends ExecutionGate {
  type: 'pending'
  note: string
}

export type ButtonAction = NavigateAction | SubmitAction | PendingAction

export type ButtonEmphasis = 'primary' | 'secondary' | 'quiet'

export interface ButtonSpec {
  type: 'button'
  label: string
  description?: string
  badge?: string
  // 화면 안에서의 상대적 강조도. 시각 형태가 아니라 역할이며, 구현이 형태로
  // 옮긴다. 디자인의 채움·테두리에서 유도한다(추출기).
  emphasis?: ButtonEmphasis
  initiallyDisabled: boolean
  action: ButtonAction
}

// 이 화면이 다루는 대상의 요약 카드. note가 값들을 한 줄로 잇는 것과 달리
// 제목과 라벨-값 쌍의 구조를 가진다. 값의 출처가 정해지기 전에는 디자인에
// 그려진 예시 문자열을 그대로 담는다.
// 표시 요소가 눌렸을 때의 동작. 값을 보내지 않으므로 submit이 없다.
export type DisplayAction =
  | { type: 'navigate'; label?: string; targetScreenId: string }
  | { type: 'pending'; label?: string; note: string }

export interface SummaryItem {
  label: string
  // 값 뒤에 붙는 단위. 세는 말이 대상마다 다르다(업무는 '건', 행사는 '개').
  unit?: string
  // 값의 출처. field면 dataSourceKey가 가리키는 응답의 조각이고,
  // value면 명세에 담긴 예시 값이다. 스키마가 둘 중 하나를 강제한다.
  field?: string
  value?: string
}

export interface SummarySpec {
  type: 'summary'
  eyebrow?: string
  title?: string
  // 제목이 서버에서 오는 경우(홈 브리핑의 '박해랑님, 확인이 필요해요').
  titleField?: string
  description?: string
  // 설명이 서버에서 오는 경우(OPS-00의 '박해랑님이 확인할 …').
  descriptionField?: string
  dataSourceKey?: string
  items?: SummaryItem[]
  // 묶음 전체를 눌렀을 때. itemList.itemAction과 같은 규칙이다.
  action?: DisplayAction
}

// 데이터의 개수만큼 반복하는 읽기 전용 목록. list(사람이 편집하는 목록)와
// 다르고, summary(항목이 명세에 고정)와도 다르다 — 경계는 항목 수가 명세에
// 있느냐 데이터에 있느냐다. 항목의 조각은 dataSource의 fields가 갖는다.
export interface ItemListSpec {
  type: 'itemList'
  title?: string
  dataSourceKey: string
  // 목록을 거르는 값. key는 출처가 선언한 인자 이름이고, 값은 화면 필드를
  // 가리키거나(fieldKey) 명세가 정한 고정값이다(value) — 칸반의 열이 후자다.
  // 받아온 것을 화면에서 거르지 않고 값이 바뀌면 다시 조회한다.
  params?: Record<string, { fieldKey?: string; value?: string }>
  // 항목 하나를 눌렀을 때. 어느 항목인지는 데이터가, 어느 화면인지는 명세가 말한다.
  itemAction?: DisplayAction
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
  description?: string
  memberFieldKeys: string[]
}

// 사용자가 항목을 추가·이름 수정·삭제하는 목록. 값이 하나가 아니라 배열이다.
export interface ListSpec {
  type: 'list'
  fieldKey: string
  label?: string
  itemNoun: string
  addLabel: string
  itemNote?: string
  minItems: number
  maxItems: number
  itemActions: Array<'rename' | 'remove'>
  rootItem?: {
    initialName: string
    actions: Array<'rename'>
  }
  initialItems?: {
    fieldKey: string
    byValue: Record<string, string[]>
  }
  resetOnChangeOf?: string[]
}

export type ElementSpec =
  | InputSpec
  | SelectSpec
  | ButtonSpec
  | NoteSpec
  | GroupSpec
  | ListSpec
  | SummarySpec
  | ItemListSpec

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
