// ─────────────────────────────────────────────────────────────────────────────
// 공용 파일: 만드는 쪽(v1~v3)은 읽기만 한다. 고치려면 진행 에이전트에게 말한다.
// ─────────────────────────────────────────────────────────────────────────────
import type { FormActivationCondition } from '@vada/contracts'
import type { EventFieldFocus } from '@/events/EventFields'
import type { FormValues } from '../registration-form'
import type { BuilderSample, BuilderScreen } from './builder-data'

// 채우기 버튼이 가는 칸: 신청 마감·계좌는 편집기의 그 칸, 행사 시작 일시는 행사 정보 고치기(onEditEvent).
export type EditorFocus = 'closesAt' | 'account'

// 각 안(vN/index.tsx의 기본 내보내기)이 받는 것. 한 안이 세 화면을 다 그린다. 모양은 안마다 다르고 받는 것은 같다.
// 행동은 모두 미리보기 껍데기가 처리한다(콘솔에 '[builder] …'만 찍고 서버에 보내지 않는다. 화면도 바꾸지 않는다).
// 안은 행사 화면 탭 안 내용 영역만 그린다. 앱 셸(옆 메뉴·머리글·행사 머리·탭)은 껍데기가 회색 자리 상자로 둘레에 둔다.
export type BuilderProps = {
  screen: BuilderScreen
  data: BuilderSample
  // 도구 줄 [참여 설문 만들기](빈 상태의 버튼도 같음)와 [QR로 출석 확인]
  onCreate: () => void
  onScan: () => void
  // 카드 행동. formId는 data.forms[n].form.id
  onPreview: (formId: string) => void
  onEdit: (formId: string, focus?: EditorFocus) => void
  onActivate: (formId: string) => void
  onPause: (formId: string) => void
  onResume: (formId: string) => void
  // [링크 복사]. 실제 복사는 안이 해도 된다(지금 구현 CopyButton)
  onCopy: (formId: string, link: string) => void
  // [QR 저장](지금 구현에 없음, 내용 ①)
  onSaveQr: (formId: string) => void
  // 활성화 조건의 [채우기]. 행사 시작 일시면 onEditEvent('startsAt')를 불러도 된다
  onFill: (formId: string, condition: FormActivationCondition) => void
  // 행사 기본정보 고치기(행사 정보 고치기 창으로)
  onEditEvent: (focus: EventFieldFocus) => void
  // 편집기: 맨 위 되돌아가기, [만들기]/[저장](칸 확인을 통과한 값과 고른 계좌 id)
  onBack: () => void
  onSubmit: (values: FormValues, accountId: string | null) => void
}
