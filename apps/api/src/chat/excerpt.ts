import { DELETED_MESSAGE, PUSH_BODY_MAX, PUSH_PHOTO_BODY } from '@vada/contracts'

// 잠금 화면 알림과 방 줄 미리보기에 보이는 글자는 앞 100자다(DEC-59, DEC-90). 글자 수는 코드 포인트로 세어
// 이모지가 반쪽으로 잘리지 않는다. 사진만 보낸 메시지(본문이 빈 것)는 '사진'이다.
export const excerptOf = (body: string) =>
  body ? Array.from(body).slice(0, PUSH_BODY_MAX).join('') : PUSH_PHOTO_BODY

// 방 줄 미리보기는 첫 줄만 쓴다. 본문은 앞뒤 공백을 깎아 저장하므로 글이 있으면 첫 줄도 비지 않는다.
// 지운 메시지(본문 null, DEC-54)는 '삭제된 메시지'다. 빈 본문으로 넘기면 사진만 보낸 것처럼 '사진'이 된다.
export const previewOf = (body: string | null) =>
  body === null ? DELETED_MESSAGE : excerptOf(body.split(/\r?\n/, 1)[0]!)
