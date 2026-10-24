// 본문을 글과 링크 조각으로 나눈다. http·https 주소만 링크로 본다.
export type BodyPart = { kind: 'text'; text: string } | { kind: 'link'; text: string }

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g
// 주소 끝에 붙은 문장부호는 주소가 아니다(예: "여기요: https://…).").
const TRAILING = /[.,!?;:)\]}」』>]+$/

export function bodyParts(body: string): BodyPart[] {
  const parts: BodyPart[] = []
  let last = 0
  for (const match of body.matchAll(URL_PATTERN)) {
    const start = match.index
    const url = match[0].replace(TRAILING, '')
    if (start > last) parts.push({ kind: 'text', text: body.slice(last, start) })
    parts.push({ kind: 'link', text: url })
    last = start + url.length
  }
  if (last < body.length) parts.push({ kind: 'text', text: body.slice(last) })
  return parts
}
