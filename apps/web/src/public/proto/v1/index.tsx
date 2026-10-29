import type { FormProps } from '../form-props'
import ApplySheet from './apply'
import ClosedSheet from './closed'
import { Desk, Head, Paper } from './paper'
import ReceiptSheet from './receipt'

// v1 = 종이 한 장 모양(신청자 화면 시안). 옅은 바탕 위 흰 종이 한 장에 세 화면을 그린다.
// 신청: 윗변 강조색 띠 + 머리 + 테두리 칸 서류. 신청 직후: 같은 종이가 영수증(완료 패널, 점선 줄, 도장 칸 QR).
// 받지 않을 때: 머리는 남기고 칸 자리에 도장 상자. 보고: notes/integration/events/form-apply-v1.md
export default function FormV1(props: FormProps) {
  if (props.screen === 'done')
    return (
      <Desk>
        <Paper>
          <ReceiptSheet {...props} />
        </Paper>
      </Desk>
    )
  return (
    <Desk>
      <Paper band>
        <Head data={props.data} />
        {props.screen === 'closed' ? <ClosedSheet {...props} /> : <ApplySheet {...props} />}
      </Paper>
    </Desk>
  )
}
