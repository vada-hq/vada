import {
  PURCHASE_BODY_MAX,
  PURCHASE_TITLE_MAX,
  type ChatMessage,
  type TeamMember,
} from '@vada/contracts'

// 메시지로 구매 요청을 열 때 채우는 값. 모두 사람이 고친다.
export type RequestSeed = {
  title: string
  body: string
  // 재정부만 고른다. 재정부가 아니면 null이고 서버가 나로 본다.
  requestedBy: string | null
  sourceMessageId: string
}

// 글자 수는 계약과 같은 단위(코드 포인트)로 센다. 이모지를 반으로 자르지 않는다.
function clipText(value: string, max: number) {
  return Array.from(value).slice(0, max).join('').trim()
}

type Context = {
  meId: string
  // 지금 운영진. 아직 못 읽었으면 null이다.
  members: TeamMember[] | null
  canAssign: boolean
}

// 남의 메시지면 보낸 사람이 요청한 사람이다. 떠났거나 시스템이면(지금 운영진에 없으면) 나다.
function requesterOf(message: ChatMessage, { meId, members, canAssign }: Context) {
  if (!canAssign) return null
  const sender = message.senderId
  const stillHere = sender !== null && members?.some(member => member.id === sender)
  return stillHere ? sender : meId
}

export function requestSeedOf(message: ChatMessage, context: Context): RequestSeed {
  const firstLine = message.body.split('\n').find(line => line.trim() !== '') ?? ''
  return {
    title: clipText(firstLine, PURCHASE_TITLE_MAX),
    body: clipText(message.body, PURCHASE_BODY_MAX),
    requestedBy: requesterOf(message, context),
    sourceMessageId: message.id,
  }
}
