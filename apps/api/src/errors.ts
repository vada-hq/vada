// 업무 규칙이 사용하는 공통 오류. HTTP 응답으로 바꾸는 일은 routes.ts가 맡는다.

export class NotFound extends Error {}
export class Blocked extends Error {}
/**
 * 같은 사실이 이미 있다.
 *
 * **돌려주는 것은 없다.** 이미 있는 것을 함께 주면 그것이 남의 것을 여는 열쇠가
 * 된다 — 공유 QR과 남의 학번으로 그 사람의 영수증을 받아 갔다(2026-08-31 교차검토).
 */
export class AlreadyExists extends Error {}

/**
 * 아직 그럴 수 없다. **지금 상태가 이 일을 받을 수 없다.**
 *
 * `Blocked`(422)와 다르다. 422는 **보낸 값**이 받을 수 없는 것이라는 뜻이고, 그래서
 * 화면은 그것을 '내가 적은 것이 틀렸다'로 읽어 칸을 짚는다. 그런데 조건을 못 채운
 * 켜기·마치기는 **보낸 값이 아예 없다** — 몸통 없는 요청이고, 계약도 그 자리에 422를
 * 두지 않았다. 틀린 번호를 내면 화면이 없는 칸을 짚는다.
 *
 * `AlreadyExists`와도 다르다. 그것은 '이미 그 상태다'이고 이것은 '아직 아니다'인데,
 * 밖에서 보면 둘 다 **지금 상태와 어긋난 요청**이라 같은 409다. 계약이 `conflict`로
 * 적어 둔 자리가 그 자리다.
 */
export class NotReady extends Error {}
