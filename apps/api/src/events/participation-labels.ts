interface FeeFacts {
  fee: string | null
  feeType: string | null
  paidAmount: number | null
  unpaidAmount: number | null
}

interface CapacityFacts {
  capacity: string | null
  capacityType: string
  capacityCount: number | null
}

function written(value: string | null): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

function feeAmount(value: number): string {
  return value === 0 ? '무료' : `${value}원`
}

/** 편집용 참가비 필드에서 조회 화면이 공통으로 쓸 한 줄을 만든다. */
export function eventFeeLabel(row: FeeFacts, missing: string): string {
  if (row.feeType === 'free') return '무료'
  if (
    row.feeType === 'duesConditional' &&
    row.paidAmount !== null &&
    row.unpaidAmount !== null
  ) {
    return `납부자 ${feeAmount(row.paidAmount)} / 미납자 ${feeAmount(row.unpaidAmount)}`
  }
  return written(row.fee) ?? missing
}

/** 편집용 정원 필드에서 조회 화면이 공통으로 쓸 한 줄을 만든다. */
export function eventCapacityLabel(row: CapacityFacts, missing: string): string {
  if (row.capacityType === 'unlimited') return '정원 제한 없음'
  if (row.capacityType === 'limited' && row.capacityCount !== null) {
    return `정원 ${row.capacityCount}명`
  }
  return written(row.capacity) ?? missing
}
