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
  // 값을 보여주되 사람이 고칠 수 없는 칸(FIN-REQ-01의 요청 부서). 비활성과 다르다 —
  // 저것은 아직 못 고치는 것이고 이것은 애초에 사람이 정하는 값이 아닌 것이다.
  readOnly?: boolean
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
  // 건수도 걸러서 오는 것이라 인자를 받을 수 있다 — 어느 행사의 문서 수인지.
  optionCounts?: { dataSourceKey: string; params?: QueryParams }
  // 선택지도 걸러서 온다 — 어느 학교의 단과대학인지, 어느 행사의 소속인지.
  // 조회 인자는 어디서든 같은 물음이라 목록·요약과 같은 모양을 쓴다.
  optionsSource: {
    key: string
    params?: QueryParams
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
  // 이동하면서 대상 화면에 넘기는 인자. 화면이 인자를 받으면 누군가는 그 값을 준다.
  params?: QueryParams
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
interface DisplayActionCopy {
  label?: string
  // 문구·강조도가 데이터에서 오는 경우 그 조각의 key. 목록 항목마다 다른 경우다 —
  // 회의 목록의 '회의록 보기'·'회의로 돌아가기'는 그 회의의 상태가 정한다.
  labelField?: string
  emphasisField?: string
}

export type DisplayAction =
  | ({ type: 'navigate'; targetScreenId: string; params?: QueryParams } & DisplayActionCopy)
  | ({ type: 'pending'; note: string } & DisplayActionCopy)

export interface SummaryItem {
  // 그려지지 않는 자리에서는 없다 — 서버가 '담당 학술체육부 · 김바다'처럼
  // 라벨까지 품은 문장을 완성해 보내는 자리가 있다.
  label?: string
  // 값 뒤에 붙는 단위. 세는 말이 대상마다 다르다(업무는 '건', 행사는 '개').
  unit?: string
  // 값의 출처. field면 dataSourceKey가 가리키는 응답의 조각이고,
  // value면 명세에 담긴 예시 값이다. 스키마가 둘 중 하나를 강제한다.
  field?: string
  value?: string
  // 값 아래 붙는 보조 문구. 값과 크기·색이 달라 한 문자열로 합칠 수 없다
  // ('142명' 아래의 '정원 200명').
  description?: string
  descriptionField?: string
  // 이 화면의 입력 값을 되비춘다. 서버가 보낸 field와 다르다 — 아직 아무 데도
  // 보내지 않은 값이다. select를 가리키면 고른 선택지의 label을 그린다.
  fieldKey?: string
  // 화면이 스스로 셈해 내는 값. 아직 제출하지 않은 요청의 합계를 아는 서버는 없다.
  compute?: SummaryCompute
}

// 식이 아니라 이름 붙은 셈 셋이다. 식을 적을 수 있게 만들면 명세가 코드가 된다.
export interface SummaryCompute {
  op: 'count' | 'sum' | 'product'
  // count·sum: 무엇을 세거나 더하는지(list 요소의 fieldKey).
  listFieldKey?: string
  // sum·product: 항목 하나 안에서 곱할 칸들.
  fieldKeys?: string[]
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
  // 한 건을 집어 올 때 넘기는 인자. 상세 화면의 요약 카드가 쓴다.
  params?: QueryParams
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
  // 목록이 묶음으로 온다는 선언. 이때 항목 하나가 곧 묶음이고 itemsField가 그
  // 묶음에 든 것들을 담는다. 묶음 수도 안쪽 항목 수도 데이터에 달렸다 — 칸반의
  // 열처럼 묶음이 명세에 고정인 경우와 다르다.
  group?: { itemsField: string; collapsible?: boolean }
  // 목록을 거르는 값. key는 출처가 선언한 인자 이름이고, 값은 화면 필드를
  // 가리키거나(fieldKey) 명세가 정한 고정값이다(value) — 칸반의 열이 후자다.
  // 받아온 것을 화면에서 거르지 않고 값이 바뀌면 다시 조회한다.
  params?: QueryParams
  // 표로 그려지는 목록의 열 머리. 카드로 그려지는 목록은 이것이 없다. 열 머리는
  // 그려지는 글이라 명세가 갖는다 — 화면은 design.json을 실행 중에 읽지 않는다.
  columns?: { label: string; fields: string[] }[]
  // 목록이 쪽으로 나뉜다는 선언. 한 쪽만큼만 받아 오므로 총 몇 건인지·몇 쪽인지는
  // 목록 자신이 말할 수 없어 그것을 아는 출처를 따로 가리킨다. source가 따로 있는
  // 것은 디자인이 표와 쪽 줄을 형제로 두기 때문이다 — 한 개념이 두 자리에 그려진다.
  paging?: {
    source: string
    pageParam: string
    dataSourceKey: string
    params?: QueryParams
    totalNoteField: string
    pageCountField: string
  }
  // 항목 하나를 눌렀을 때. 어느 항목인지는 데이터가, 어느 화면인지는 명세가 말한다.
  itemAction?: DisplayAction
  // 항목을 여럿 고를 수 있다는 선언. 고르는 것은 화면 안의 상태라 다시 조회하지
  // 않는다. 고른 다음 무엇을 하는지가 없으면 고르기도 없으므로 action이 필수다.
  selection?: { action: DisplayAction }
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
  // 항목의 머리에 그리는 이름이 어느 칸의 값인지(itemFields가 있을 때).
  itemTitleFieldKey?: string
  // 항목 하나가 담는 요소들. 화면의 요소와 같은 모양이다 — 되풀이되는 묶음의 칸은
  // 화면의 것이 아니라 항목의 것이기 때문이다(품목이 넷이면 수량도 넷이다).
  itemFields?: ScreenElement[]
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
  // 화면의 이름. titleFrom이 있으면 그려지는 것은 데이터이고 이 값은 이름으로만 남는다.
  title: string
  // 제목이 데이터에서 오는 경우 그 출처. 무엇의 화면인지가 곧 제목인 자리가 있다 —
  // 행사 업무 보드의 제목은 그 행사의 이름이다.
  titleFrom?: {
    dataSourceKey: string
    field: string
    params?: QueryParams
  }
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

// 넘기는 인자. 값이 어디서 오는지가 넷이다 — 화면 필드(fieldKey), 명세가 정한
// 고정값(value), 화면이 밖에서 받은 인자(screenParam), 눌린 항목의 조각(itemField).
// 마지막 하나는 목록 항목의 동작에서만 쓴다 — 조회하는 시점에는 항목이 없다.
export type QueryParams = Record<
  string,
  { fieldKey?: string; value?: string; screenParam?: string; itemField?: string }
>

export interface ScreenParam {
  key: string
  valueType?: 'string' | 'number'
  // 없어도 화면이 열리는가. 한 화면이 두 모드를 겸하는 자리가 있다 —
  // FIN-REQ-01은 요청 id가 있으면 고치고 없으면 새로 쓴다.
  optional?: boolean
  // 화면 하나만 열어 볼 때 쓰는 예시 값. 구현은 이 값으로 대신하지 않는다 —
  // 인자가 없으면 드러내야 한다. 쓰는 것은 검사뿐이다.
  example?: string
  description: string
}

export interface ScreenSpec {
  schemaVersion: number
  screenId: string
  stateScopeKey?: string
  // 이 화면이 밖에서 받는 인자. 상세 화면만 갖는다 — 무엇의 상세인지는 화면
  // 안에 없기 때문이다.
  params?: ScreenParam[]
  // 이 화면의 입력이 무엇을 읽어 채워지는지. 고치는 화면은 고칠 것을 먼저 읽어
  // 온다. 새로 쓰는 것도 읽는다 — 아직 아무것도 적히지 않은 요청이 온다.
  draftFrom?: {
    dataSourceKey: string
    params?: QueryParams
  }
  // 이 화면이 속한 작업 공간. 무엇을 그리는지는 shell.json이 알고, 화면은
  // 어디에 그리는지만 갖는다.
  workspace?: {
    key: string
    // 공간의 제목 대신 자기 이름을 쓰는가. 자기 아래에 다시 여러 화면을 거느리는
    // 입구가 그렇다(EVT-FIN-01).
    ownTitle?: boolean
    source: { tabs?: string; status?: string }
  }
  meta?: ScreenMeta
  source: {
    pageName: string
    nodeId: string
    name: string
    figmaType: string
  }
  elements: ScreenElement[]
}
