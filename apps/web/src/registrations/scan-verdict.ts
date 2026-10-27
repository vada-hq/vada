import type { ScanOutcome } from './check-in'

// 문 앞의 운영진이 먼저 묻는 것은 '이 사람이 들어가도 되는가'다. 찍은 결과를 판정 하나로 줄이고,
// 판정이 카드의 색과 버튼을 정한다. 서버는 미납이어도 출석을 남긴다(DEC-93). 판정은 화면의 안내일 뿐이다.
export type Verdict =
  // 무료이거나 입금을 확인했다.
  | { kind: 'enter' }
  // 미납이고 이 운영진이 입금을 확인할 수 있다.
  | { kind: 'collect'; fee: number }
  // 미납인데 입금 확인 권한이 없거나, 참가비를 모른다(이전 서버 응답). 금액을 추정해 받지 않는다.
  | { kind: 'unpaid'; fee: number | undefined }
  // [입장 안 함]으로 이번 찍기가 남긴 출석을 취소했다.
  | { kind: 'turned-away' }
  | { kind: 'already' }
  | { kind: 'missing' }
  | { kind: 'failed' }

type Checked = Extract<ScanOutcome, { kind: 'checked' }>

function checkedVerdict({ applicant, appliedFee }: Checked): Verdict {
  if (!applicant.attended) return { kind: 'turned-away' }
  if (appliedFee === 0 || applicant.deposit.status === 'confirmed') return { kind: 'enter' }
  if (appliedFee !== undefined && applicant.actions.includes('deposit.confirm'))
    return { kind: 'collect', fee: appliedFee }
  return { kind: 'unpaid', fee: appliedFee }
}

export function verdictOf(outcome: ScanOutcome): Verdict {
  return outcome.kind === 'checked' ? checkedVerdict(outcome) : { kind: outcome.kind }
}

// 이미 출석한 사람의 남은 참가비. 출석은 막지 않고 남기므로(DEC-93) 앞서 받지 못한 참가비를 다시 찍었을 때 받는다.
// 입장 판정(입장 불가)은 그대로 두고 받기만 더한다. 참가비를 모르면(이전 서버 응답) 추정해 받지 않는다.
export type LatePayment = { kind: 'collect'; fee: number } | { kind: 'unpaid' } | null

export function latePaymentOf(outcome: ScanOutcome): LatePayment {
  if (outcome.kind !== 'already') return null
  const { appliedFee, applicant } = outcome
  if (!appliedFee || applicant.deposit.status !== 'none') return null
  return applicant.actions.includes('deposit.confirm')
    ? { kind: 'collect', fee: appliedFee }
    : { kind: 'unpaid' }
}
