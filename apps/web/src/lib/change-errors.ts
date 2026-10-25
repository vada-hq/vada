// 학생회를 바꾸는 화면의 오류 표가 같이 쓰는 문구(messages.ts·registration-messages.ts의 표가 이것으로 만들어진다).
// 그만둔다고 알린 학생회는 파기할 때까지 읽기만 된다(서버 COUNCIL_CLOSING, DEC-55). 어느 화면에서 바꾸든 같은 말을 한다.
const COUNCIL_CLOSING = '학생회를 그만두는 중이라 읽기만 할 수 있어요.'

export const changeErrors = (table: Record<string, string>): Record<string, string> => ({
  COUNCIL_CLOSING,
  ...table,
})
