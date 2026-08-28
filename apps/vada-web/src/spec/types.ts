// specs/figma의 화면 동작 명세(JSON) 형태. packages/contracts/schemas와 대응한다.

export interface EnabledWhenCondition {
  fieldKey: string
  operator: 'hasValue'
}

export interface InputSpec {
  type: 'input'
  fieldKey: string
  label: string
  // 라벨이 이 자리에 그려지지 않는가. 표의 칸이 그렇다: 열 머리가 한 번 그려지고
  // 칸마다 다시 그려지지 않는다. 읽어 주는 이름은 여전히 필요하다.
  labelHidden?: boolean
  placeholder: string | null
  helperText?: string
  initialValue: string | null
  inputType: string
  // 여러 줄을 받는 칸인가. inputType은 HTML input의 type과 같은 말이라 textarea가
  // 들어갈 자리가 없고, text로만 적으면 '긴 글'이라는 사실이 명세에서 사라진다.
  multiline?: boolean
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
  // 라벨이 있으나 이 자리에 그려지지 않는 경우. 표의 칸이 그렇다.
  labelHidden?: boolean
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
  // 판정은 둘이고 둘 다 이름 붙은 것이다. 화면이 아는 것(필수 칸이 다 찼는가)과
  // 화면이 모르는 것(서버가 막았는가)이 갈린다 - 무엇이 '다 됐다'인지는 조직의
  // 규칙이라 화면이 셀 수 없다.
  executeWhen?:
    | { type: 'allRequiredFieldsHaveValue'; scope: 'screen' }
    | {
        type: 'sourceAllows'
        dataSourceKey: string
        params?: QueryParams
        // 이 조각에 글이 있으면 막히고 그 글이 이유다. 비어 있으면 열린다.
        blockedNoteField: string
      }
  onExecutionBlocked?: {
    type: 'showMissingRequiredFields' | 'showBlockedNote'
    focus?: 'firstMissingField'
  }
}

export interface NavigateAction extends ExecutionGate {
  type: 'navigate'
  targetScreenId: string
  // 이동하면서 대상 화면에 넘기는 인자. 화면이 인자를 받으면 누군가는 그 값을 준다.
  params?: QueryParams
  /**
   * 떠나면서 이 화면의 초안을 어떻게 끝내는가.
   *
   * 모달의 '취소'는 제출이 아니라 이동이다. 이 자리가 없던 동안 스코프가
   * `clearOn: ['complete','cancel']`이라 말해도 **cancel을 낼 방법이 없었고**,
   * 떠났다가 다시 열면 치던 값이 그대로 있었다.
   */
  scopeEvent?: 'complete' | 'cancel'
}

// 데이터 전송. 경로·payload 스코프·상태 문구는 mutations.json이 갖고
// 버튼은 key만 참조한다. 스코프 수명 이벤트는 onSuccess에서만 발생한다.
export interface SubmitAction extends ExecutionGate {
  type: 'submit'
  mutationKey: string
  // note는 '보내고 나면 어디로 가는지 아직 안 정했다'를 적는 자리다.
  // 비어 있는 onSuccess는 '보내고 머문다'는 뜻이므로 둘이 구별된다.
  onSuccess: {
    navigate?: string
    // 이동하면서 넘기는 인자. 명세가 무엇을 넘길지 말하고 화면은 그 값이 어디
    // 있는지만 알려 준다 - 화면이 직접 적으면 명세만 읽는 사람은 모른다.
    params?: QueryParams
    note?: string
    scopeEvent?: 'complete' | 'cancel'
  }
}

// 누르면 무엇이 일어나는지 아직 정해지지 않았다. 대상 화면 id를 지어내는
// 대신 무엇이 미정인지를 남긴다.
export interface PendingAction extends ExecutionGate {
  type: 'pending'
  note: string
}

// 화면에 보이는 값을 가져간다. 보내는 것도 어디로 가는 것도 아니다 - 초대 링크와
// 초대 코드처럼 **사람이 붙여 넣어 남에게 보내라고 그려 둔 값**이 그 자리다.
// 어떻게 집어 가는지는 명세가 말하지 않는다(클립보드는 플랫폼의 답이다).
export interface CopyAction extends ExecutionGate {
  type: 'copy'
  copySourceKey: string
  copyField: string
}

// 서버가 가진 파일을 받아 간다. copy와 같은 처지지만 대상이 다르다 - 저것은
// 화면에 그려진 값이고 이것은 서버의 파일이다. pending으로 적으면 '아직 안
// 정했다'는 거짓말이 된다.
export interface DownloadAction {
  type: 'download'
  downloadSourceKey: string
  downloadField: string
}

export type ButtonAction =
  | NavigateAction
  | SubmitAction
  | PendingAction
  | CopyAction
  | DownloadAction

export type ButtonEmphasis = 'primary' | 'secondary' | 'quiet'

export interface ButtonSpec {
  type: 'button'
  label: string
  // 글 없는 조작. 그려지는 것은 그림뿐이고 label은 부르는 이름으로만 남는다.
  labelHidden?: boolean
  // 되풀이되는 묶음의 항목 중 하나라도 이 값을 고르면 글이 바뀐다. 조건은 이름
  // 붙은 하나뿐이다: 식을 적을 수 있게 만들면 명세가 프로그램이 된다.
  labelWhenAnyItemIs?: {
    listFieldKey: string
    fieldKey: string
    value: string
    label: string
  }
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

// 줄마다 가는 곳이 다른 이동. **데이터는 열쇠만 주고 갈 곳은 명세가 든다** —
// 데이터가 화면 id를 직접 주면 검증기가 그 화면이 있는지 확인할 수 없다.
export interface BranchingTarget {
  value: string
  targetScreenId: string
}

export type DisplayAction =
  | ({ type: 'navigate'; targetScreenId: string; params?: QueryParams } & DisplayActionCopy)
  | ({
      type: 'navigate'
      targetField: string
      targets: BranchingTarget[]
      params?: QueryParams
    } & DisplayActionCopy)
  | ({ type: 'pending'; note: string } & DisplayActionCopy)

/**
 * 이 동작이 데려갈 화면. 갈림길이면 눌린 줄이 정한다.
 *
 * 명세가 든 갈래에 없는 열쇠면 null이다 — 조용히 아무 데나 데려가지 않는다.
 */
export function targetScreenOf(
  action: DisplayAction,
  row: Record<string, unknown>,
): string | null {
  if (action.type !== 'navigate') {
    return null
  }
  if ('targetScreenId' in action) {
    return action.targetScreenId
  }
  const key = String(row[action.targetField] ?? '')
  return action.targets.find((branch) => branch.value === key)?.targetScreenId ?? null
}

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
  // 소제목이 서버에서 오는 경우. 한 건의 번호처럼 요청마다 달라지는 자리다.
  eyebrowField?: string
  title?: string
  // 제목이 서버에서 오는 경우(홈 브리핑의 '박해랑님, 확인이 필요해요').
  titleField?: string
  // 제목 곁의 상태 딱지. 글과 톤 이름 모두 데이터가 준다.
  // 딱지는 여럿일 수 있다 - 개수가 데이터에 달렸다(OPS-MEET-07의 띠는 둘을 단다).
  status?: Array<{
    field: string
    toneField: string
  }>
  // 딱지 목록이 통째로 담긴 조각. status와 갈리는 것은 개수를 누가 정하느냐다 -
  // status는 명세가 알고(서로 다른 사실 둘), 이것은 데이터가 안다(사람마다 다르다).
  statusField?: string
  // 이 요약 **자체의** 색 이름이 담긴 조각. status의 toneField는 곁에 붙는 딱지의
  // 색이고 이것은 띠나 카드 통째의 색이다 - 그려지는 자리가 다르다.
  toneField?: string
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
  // itemFields에 고칠 수 있는 것이 있을 때 그 값들이 담기는 이름.
  // 값은 '묶음이름.항목id.칸이름' 꼴로 담긴다.
  fieldKey?: string
  title?: string
  // 섹션 제목이 바깥 항목의 조각에서 오는 경우(itemsField와 함께만 쓴다).
  // 조직도의 '부원 2명'처럼 라벨과 수가 글자 하나로 그려진 자리다 - 명세가
  // 둘로 나눠 갖고 화면이 다시 이으면 잇는 방법을 명세가 정하게 된다.
  titleField?: string
  // 목록이 조회로 오면 dataSourceKey, 바깥 항목의 조각에서 오면 itemsField다.
  // 되풀이되는 묶음 안에 목록이 또 있는 자리 - 그 목록은 바깥 항목의 일부이지
  // 따로 있는 것이 아니다(group.itemsField와 같은 말이고 가리키는 자리만 다르다).
  dataSourceKey?: string
  itemsField?: string
  // 목록이 묶음으로 온다는 선언. 이때 항목 하나가 곧 묶음이고 itemsField가 그
  // 묶음에 든 것들을 담는다. 묶음 수도 안쪽 항목 수도 데이터에 달렸다 — 칸반의
  // 열처럼 묶음이 명세에 고정인 경우와 다르다.
  // 묶음의 머리가 어느 조각을 그리는지. columns와 같은 모양이고 가리키는 것만
  // 반대다: columns는 묶음 안의 항목을, headerFields는 묶음 자신을 말한다.
  group?: {
    itemsField: string
    headerFields?: { label?: string; fields?: string[]; toneField?: string }[]
    collapsible?: boolean
  }
  // 목록을 거르는 값. key는 출처가 선언한 인자 이름이고, 값은 화면 필드를
  // 가리키거나(fieldKey) 명세가 정한 고정값이다(value) — 칸반의 열이 후자다.
  // 받아온 것을 화면에서 거르지 않고 값이 바뀌면 다시 조회한다.
  params?: QueryParams
  // 항목이 하나도 없을 때 그 자리에 **대신** 그리는 동작. 비었다는 것을 말하는
  // 것은 출처의 messages.empty이고, 이것은 비었으니 채우라고 권하는 자리다 -
  // 조직도에서 부서장이 없는 부서에만 '＋ 부서장 지정'이 그려진다.
  // 이 목록의 항목을 다른 자리로 옮길 수 있다. 같은 poolSourceKey를 가리키는
  // 목록끼리가 한 무리이고, 자리를 잃은 사람은 그 pool로 간다. **어떻게 옮기는지는
  // 명세가 말하지 않는다** - 끌어다 놓든 골라서 보내든 design의 몫이다.
  itemMove?: { poolSourceKey: string; releaseLabel: string }
  // 항목을 아주 지운다. 옮기기와 다르다 - 자리를 바꾸는 것이 아니라 없애는 것이다.
  itemRemove?: { label: string }
  // 줄 전체의 색 이름이 든 조각. columns[].toneField가 칸 하나를 말하는 것과
  // 달리 이것은 그 줄 자체를 말한다 - 손봐야 하는 줄만 다르게 그린다.
  rowToneField?: string
  emptyAction?: DisplayAction
  // 항목 하나가 어떤 조각으로 나뉘어 그려지는지, 그려지는 순서대로. 조각을 통째로
  // 카드에 쏟는 목록은 이것이 없다. 이름은 '열'이지만 표에만 쓰는 것이 아니다 —
  // 머리글 없이 두 줄로 그려지는 목록도 어느 것이 주 문구인지를 말해야 하고,
  // 그 말이 없으면 화면이 출처의 조각 이름을 뒤져 고르게 된다.
  //
  // 어떻게 그리는지는 여전히 명세의 것이 아니다. 표인지 시간 줄인지는 design이
  // 말하고 대조기가 지킨다. toneField는 색이 아니라 색 이름이 든 조각을 가리킨다.
  columns?: { label?: string; fields?: string[]; fieldKey?: string; toneField?: string }[]
  // 서버가 준 항목 하나가 담는 요소들. columns가 항목을 조각으로 나눠 한 줄로
  // 늘어놓는 것이라면, 이것은 항목 하나가 통째로 묶음을 이루는 경우다.
  // 안쪽 요소가 dataSourceKey 없이 field를 가리키면 그 항목의 조각이다.
  itemFields?: ScreenElement[]
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

// 칸 목록이 데이터에서 오는 편집 묶음.
//
// 무엇을 묻는지가 조직의 규칙인 자리가 있다 — 보완 요청에서 다시 받아야 할 것은
// 그 품목의 구매 유형이 정한다. 칸 목록을 명세가 들고 있으면 유형이 하나 늘 때마다
// 명세가 틀린다. 출처의 조각 이름은 계약으로 고정한다(key·label·placeholder).
export interface FieldSetSpec {
  type: 'fieldSet'
  fieldKey: string
  label?: string
  // 글로 받을지 파일로 받을지는 디자인이 이미 정해 두었다.
  kind: 'text' | 'file'
  dataSourceKey: string
  params?: QueryParams
  required?: boolean
}

// 정해진 절차 중 한 건이 지금 어디에 있는지를 보여주는 단계 줄.
// 순서는 명세가, 현재 단계는 데이터가 정한다.
export interface StepsSpec {
  type: 'steps'
  // 지금 어느 단계인지를 서버가 알 때만 있다. 파일을 올리고 결과를 보는 두 단계는
  // 이 화면을 여는 동안에만 있는 것이라 서버가 모른다(ORG-07B).
  dataSourceKey?: string
  params?: QueryParams
  currentField?: string
  items: Array<{
    key: string
    label: string
  }>
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
  | StepsSpec
  | FieldSetSpec

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
  {
    fieldKey?: string
    value?: string
    screenParam?: string
    itemField?: string
    // 이 요소가 읽는 출처의 조각. itemField와 갈리는 것은 '어느 줄이냐'가
    // 있느냐다 - 저것은 눌린 항목이고 이것은 이미 집어 온 한 건이다.
    sourceField?: string
  }
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
  // 이 인자 없이 열렸을 때 사람에게 보여 줄 글. description을 대신 그리면 안 된다
  // — 그것은 명세를 읽는 사람에게 하는 말이다. 이 자리가 없던 동안 화면마다
  // 다른 문장을 지어냈고, 아무도 그것이 명세에 없는 카피인 줄 몰랐다.
  missingNote?: string
  // 무엇을 가리키는 값인지. 화면에 그려지지 않는다.
  description: string
}

export interface ScreenSpec {
  // 이 화면을 보는 사람이 조직의 어디에 있는가(기본값 member). 표현이 아니라
  // 사실이고, 그 사실이 셸을 정한다 - joining·external에게는 사이드바가 없다.
  viewer?: 'member' | 'joining' | 'external'
  schemaVersion: number
  screenId: string
  // 이 화면이 다른 화면 위에 뜬다는 선언. 모달이 그 자리다 - 뒤에는 열기 전에
  // 보던 것이 그대로 남아 있고, 닫으면 screenId로 돌아간다.
  overlay?: { screenId: string; source: string }
  stateScopeKey?: string
  // 셸의 어느 최상위 메뉴 아래에 있는지. 메뉴가 가리키는 화면 자신은 갖지
  // 않는다 - 자기 id로 찾으면 되기 때문이다. workspace.activeTabScreenId와
  // 같은 축이고, 저것은 갈피, 이것은 셸의 메뉴다.
  activeNavigationScreenId?: string
  // 이 화면이 밖에서 받는 인자. 상세 화면만 갖는다 — 무엇의 상세인지는 화면
  // 안에 없기 때문이다.
  params?: ScreenParam[]
  // 이 화면의 입력이 무엇을 읽어 채워지는지. 고치는 화면은 고칠 것을 먼저 읽어
  // 온다. 새로 쓰는 것도 읽는다 — 아직 아무것도 적히지 않은 요청이 온다.
  draftFrom?: {
    dataSourceKey: string
    params?: QueryParams
  }
  // 제목 위의 현재 위치 경로. 셸의 메뉴는 어디로 갈 수 있는지이고 이것은 지금
  // 어디에 있는지다. 조각의 글이 메뉴 이름과 겹치는 것은 감수한다 — 디자인이
  // 그 글을 이미 그려 두었고, 등록 노드이므로 대조기가 지킨다.
  breadcrumb?: {
    source: string
    dataSourceKey?: string
    params?: QueryParams
    items: Array<{ value?: string; field?: string }>
  }
  // 이 화면이 속한 작업 공간. 무엇을 그리는지는 shell.json이 알고, 화면은
  // 어디에 그리는지만 갖는다.
  workspace?: {
    key: string
    // 갈피 자체가 아니라 어느 갈피 아래에 있는지. 갈피 아래로 한 겹 더 들어가는
    // 화면은 자기를 가리키는 갈피가 없다(MY-REQ-01은 재정 갈피에서 열린다).
    activeTabScreenId?: string
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
