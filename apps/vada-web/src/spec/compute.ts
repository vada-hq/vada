import type { SummaryCompute } from './types'
import type { ScopeDraft } from '../state/scopes'

// 화면이 스스로 셈하는 값, 그리고 되풀이되는 항목을 초안에 담는 방법.
//
// 지금까지 금액은 전부 서버가 보낸 **글**이었다. 자릿점까지 찍혀서 왔고 그것이
// 옳았다 — 무엇을 더하고 빼는지가 곧 조직의 재정 규칙이기 때문이다. 그런데 아직
// 제출하지 않은 요청의 합계를 아는 서버는 없다. 사람이 수량을 고치는 순간 다시
// 그려져야 하고, 그 셈을 아는 곳은 화면뿐이다.
//
// 셈은 셋뿐이고 식은 없다. 명세에 식을 적을 수 있게 만들면 명세를 읽는 사람이
// 다시 프로그램을 읽게 된다.

// 항목의 값은 초안의 평평한 문자열 맵에 담긴다. 줄 하나가 한 항목이고, 줄의
// 이름은 'items' 아래에 모여 있다(ORG-02가 부서 이름을 줄바꿈으로 이어 담는 것과
// 같은 방식이다 — 저쪽은 이름 하나뿐이라 값이 곧 이름이었고, 여기는 이름이 줄을
// 가리키는 열쇠다).
const ROW_SEPARATOR = '\n'

export function rowIdsOf(draft: ScopeDraft, listFieldKey: string): string[] {
  const raw = draft.values[listFieldKey]
  if (typeof raw !== 'string' || raw === '') {
    return []
  }
  return raw.split(ROW_SEPARATOR)
}

export function joinRowIds(rowIds: string[]): string {
  return rowIds.join(ROW_SEPARATOR)
}

export function itemKey(listFieldKey: string, rowId: string, fieldKey: string): string {
  return `${listFieldKey}.${rowId}.${fieldKey}`
}

// 셈에 쓰는 수. 사람이 아직 아무것도 안 적었거나 수로 읽히지 않으면 0이다 —
// 반쯤 적힌 요청에도 합계는 그려져야 하고, 그때 합계가 사라지면 사람은 무엇이
// 잘못됐는지 알 수 없다.
function numberAt(draft: ScopeDraft, key: string): number {
  const raw = draft.values[key]
  if (typeof raw !== 'string') {
    return 0
  }
  const parsed = Number(raw.replace(/,/gu, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function productOf(
  draft: ScopeDraft,
  listFieldKey: string,
  rowId: string,
  fieldKeys: string[],
): number {
  return fieldKeys.reduce(
    (carried, fieldKey) => carried * numberAt(draft, itemKey(listFieldKey, rowId, fieldKey)),
    1,
  )
}

interface ComputeContext {
  draft: ScopeDraft
  // product는 지금 있는 그 항목 안에서 곱한다. 항목 밖에서는 곱할 것이 없다.
  inList?: { listFieldKey: string; rowId: string }
}

export function computeNumber(compute: SummaryCompute, context: ComputeContext): number {
  const { draft, inList } = context

  if (compute.op === 'product') {
    if (inList === undefined) {
      throw new Error('product는 항목 안에서만 셈할 수 있습니다.')
    }
    return productOf(draft, inList.listFieldKey, inList.rowId, compute.fieldKeys ?? [])
  }

  const listFieldKey = compute.listFieldKey
  if (listFieldKey === undefined) {
    throw new Error(`${compute.op}에 listFieldKey가 없습니다.`)
  }
  const rowIds = rowIdsOf(draft, listFieldKey)

  if (compute.op === 'count') {
    return rowIds.length
  }
  return rowIds.reduce(
    (carried, rowId) => carried + productOf(draft, listFieldKey, rowId, compute.fieldKeys ?? []),
    0,
  )
}

// 셈한 수를 사람이 읽는 글로. 서버가 보낸 글에는 이미 자릿점이 찍혀 있지만 이것은
// 방금 나온 수다 — **화면이 셈을 하면 표기도 화면의 몫이다.**
//
// 세는 것과 더하는 것에 다른 표기를 두지 않았다. 넷은 자릿점이 붙어도 넷이다.
export function formatComputed(value: number): string {
  return value.toLocaleString('ko-KR')
}
