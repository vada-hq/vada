import type { CouncilTitles } from '@vada/contracts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { Confirming } from './people-access'

type Props = {
  confirming: Confirming | null
  titles: CouncilTitles
  saving: boolean
  error: string
  onCloseAutoFocus: (event: Event) => void
  onClose: () => void
  onConfirm: () => void
}

// 내보내기와 회장 넘기기 확인 대화상자. 열려 있는 것은 많아야 하나다(confirming이 정한다).
export function PeopleConfirmDialogs({ confirming, titles, saving, error, ...on }: Props) {
  const shared = { busy: saving, error: confirming ? error : '', ...on }
  const name = confirming?.member.name ?? ''
  return (
    <>
      <ConfirmDialog
        {...shared}
        open={confirming?.kind === 'remove'}
        destructive
        title={`${name}님을 내보낼까요?`}
        description="학생회 소속과 부서 소속이 함께 끝나요. 초대 링크로 다시 들어올 수 있지만, 부서와 직급은 다시 정해야 해요."
        confirmLabel="내보내기"
      />
      <ConfirmDialog
        {...shared}
        open={confirming?.kind === 'transfer'}
        title={`${name}님에게 ${titles.president} 직급을 넘길까요?`}
        description={`넘기면 나는 직급이 없어지고, ${titles.president}만 하던 일은 넘겨받은 사람이 해요.`}
        confirmLabel="넘기기"
      />
    </>
  )
}
