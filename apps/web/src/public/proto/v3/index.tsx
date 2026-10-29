import type { FormProps } from '../form-props'
import Apply from './apply'
import Closed from './closed'
import Done from './done'

// v3 '티켓 모양'(신청자 화면 시안). 이 폴더(v3/) 안만 고친다. 공용 파일은 읽기만 한다.
// 기본 내보내기 하나가 세 화면(props.screen: apply·done·closed)을 모두 그린다. 판 문서: notes/integration/events/form-apply-board.md
// 원리: 맨 위 행사 색 면 하나가 그 화면의 1순위를 싣는다(신청 = 행사 머리 띠 + 겹친 시트의 칸, 신청 직후 = 완료 띠, 당일 = 입장권).
export default function FormV3(props: FormProps) {
  switch (props.screen) {
    case 'apply':
      return <Apply {...props} />
    case 'done':
      return <Done {...props} />
    case 'closed':
      return <Closed {...props} />
  }
}
