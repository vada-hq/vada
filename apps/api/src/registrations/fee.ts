import type { PaymentBasis } from '@vada/contracts'

type FormFee = { fee: number; memberFee: number | null }
type EntryFee = { duesMember: boolean | null; paidAmount: number | null }

// 참가비를 정한 근거. 납부자 참가비가 없으면 모두 같은 참가비다.
export function basisOf(form: FormFee, entry: EntryFee): PaymentBasis {
  if (form.memberFee === null) return 'flat'
  return entry.duesMember ? 'member' : 'nonmember'
}
// 낼 돈. 입금을 확인했으면 확인 금액이고, 아니면 지금 설정과 납부 구분으로 계산한다.
export function owedOf(form: FormFee, entry: EntryFee) {
  if (entry.paidAmount !== null) return entry.paidAmount
  return basisOf(form, entry) === 'member' ? form.memberFee! : form.fee
}
