// 휴대폰 번호를 보이기만 하이픈으로 나눈다(010-1234-5678). 서버는 하이픈을 지우고 숫자만 본다(ApplySchema).
// 근거: 토스·당근 가입의 자동 하이픈, GOV.UK telephone numbers(어떤 꼴로 넣어도 받는다).
const PHONE_DIGITS = 11
const HEAD = 3
const MIDDLE_LONG = 4
const MIDDLE_SHORT = 3

export function phoneView(raw: string) {
  // 넘친 숫자는 자르지 않는다. 자르면 다른 번호가 칸 확인을 통과해 저장된다(넘친 채로 두어 칸 아래에 알린다).
  const digits = raw.replace(/\D/g, '')
  if (digits.length <= HEAD) return digits
  const middle = digits.length < PHONE_DIGITS ? MIDDLE_SHORT : MIDDLE_LONG
  const cut = HEAD + middle
  if (digits.length <= cut) return `${digits.slice(0, HEAD)}-${digits.slice(HEAD)}`
  return `${digits.slice(0, HEAD)}-${digits.slice(HEAD, cut)}-${digits.slice(cut)}`
}
