// ─────────────────────────────────────────────────────────────────────────────
// 공용 파일: 만드는 쪽(v1~v3)은 읽기만 한다. 고치려면 진행 에이전트에게 말한다.
// ─────────────────────────────────────────────────────────────────────────────
import type { FieldErrors } from '@/lib/use-form-check'
import type { ApplyValues } from '../useApply'
import type { FormSample } from './form-data'

export const FORM_SCREENS = ['apply', 'done', 'closed'] as const
// apply = 신청 화면(①머리 → ②칸 → [신청하기] → ③고지), done = 신청 직후·내 신청(④), closed = 받지 않을 때(① + ⑤카드)
export type FormScreen = (typeof FORM_SCREENS)[number]

// 각 안(vN/index.tsx의 기본 내보내기)이 받는 것. 한 안이 세 화면을 다 그린다. 모양은 안마다 다르고 받는 것은 같다.
// 행동은 모두 미리보기 껍데기가 처리한다(콘솔에 '[form] …'만 찍고 서버에 보내지 않는다).
// 안은 페이지 전체(바탕, 바깥 여백, 가운데 폭)를 그린다. 앱 셸은 없다(로그인 없는 공개 화면).
export type FormProps = {
  screen: FormScreen
  data: FormSample
  // apply 화면의 처음 입력값(견본의 input). 안은 이 값으로 처음 그리고, 고치는 대로 제 상태로 들고 있어도 된다.
  values: ApplyValues
  // 처음부터 칸 아래에 보일 문제(누른 뒤 모습). 칸 이름 → 글: name, studentId, phone, answers.<질문 차례>. 없으면 {}.
  // 글은 지금 구현의 칸 확인(applyErrors)이 낸 것이다. 칸을 고치면 안이 지워도 된다.
  errors: FieldErrors
  // '신청하는 중'(주소에 state=busy). [신청하기]를 busy로 그린다.
  busy: boolean
  // 버튼 아래 거절 문구(주소에 state=problem이면 '정원이 다 찼어요. 화면을 새로 불러왔어요.'). 없으면 ''.
  problem: string
  // [신청하기]. 미리보기는 화면을 바꾸지 않는다(done을 보려면 screen=done).
  onApply: (values: ApplyValues) => void
  // [신청 취소](확인 창에서 누른 뒤)
  onCancel: () => void
  // [계좌번호 복사]·[주소 복사]. 실제 복사는 안이 해도 되고(지금 구현 CopyButton) 이것만 불러도 된다.
  onCopy: (what: 'account' | 'link', value: string) => void
  // ⑤ 카드 버튼: [돌아가기] 또는 [새 설문으로 이동](data.closed.action)
  onClosedAction: () => void
}
