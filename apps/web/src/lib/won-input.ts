// 원 금액 칸(예산, 수입, 지출, 예상 금액, 결재, 입금 확인, 환불)이 함께 쓴다. 쉼표와 공백은 지우고, 비었거나 숫자가 아니면 NaN이라 계약 검사가 막는다.
export function wonOf(value: string) {
  const digits = value.replace(/[,\s]/g, '')
  // 1e3, 0x10 같은 글은 Number가 받아도 숫자 입력이 아니다.
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN
}
