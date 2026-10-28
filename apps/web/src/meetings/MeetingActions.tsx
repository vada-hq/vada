import type { MeetingDetail } from '@vada/contracts'
import PageActions from '@/components/PageActions'
import { Button } from '@/components/ui/button'

type Props = {
  meeting: MeetingDetail
  onEdit?: (() => void) | undefined
  onCancel?: (() => void) | undefined
  minutes?: { label: string; primary: boolean; onClick: () => void } | null
}
// 회의 상세와 회의록 화면이 같이 쓰는 머리 버튼. 보이기는 서버가 준 actions로만 정한다.
export function MeetingActions({ meeting, onEdit, onCancel, minutes }: Props) {
  const edit = onEdit && meeting.actions.includes('meeting.edit')
  const cancel = onCancel && meeting.actions.includes('meeting.cancel')
  if (!edit && !cancel && !minutes) return null
  return (
    <PageActions>
      {minutes && (
        <Button touch variant={minutes.primary ? 'default' : 'outline'} onClick={minutes.onClick}>
          {minutes.label}
        </Button>
      )}
      {edit && (
        <Button variant="outline" touch onClick={onEdit}>
          고치기
        </Button>
      )}
      {cancel && (
        <Button variant="outline" touch onClick={onCancel}>
          회의 취소
        </Button>
      )}
    </PageActions>
  )
}
