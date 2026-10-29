import type { FormProps } from '../form-props'
import ApplyScreen from './apply'
import ClosedScreen from './closed'
import DoneScreen from './done'

// v2 '큰 글자 앱 화면 모양'(토스 TDS·송금 완료, Typeform 큰 선택지). 이 폴더(v2/) 안만 고친다.
// 면·카드 없이 흰 화면 전체, 회색 채운 칸, 큰 누름 줄, 아래에 붙는 꽉 찬 버튼, 완료는 Result 꼴.
// 판 문서: notes/integration/events/form-apply-board.md, 보고: notes/integration/events/form-apply-v2.md
export default function FormV2(props: FormProps) {
  if (props.screen === 'done') return <DoneScreen {...props} />
  if (props.screen === 'closed') return <ClosedScreen {...props} />
  return <ApplyScreen {...props} />
}
