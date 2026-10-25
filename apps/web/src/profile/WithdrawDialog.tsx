import { ConfirmDialog } from '@/components/ConfirmDialog'

// DEC-64가 정한 두 가지(이름이 바뀐다, 되돌릴 수 없다)만 적는다.
const DESCRIPTION = "학생회 기록의 내 이름은 '떠난 운영진'으로 바뀌어요. 되돌릴 수 없어요."

type Props = {
  busy: boolean
  // 로그인한 지 오래라 서버가 다시 로그인하게 했다. 확인 버튼이 [다시 로그인]이 된다.
  reauth: boolean
  error: string | null
  onWithdraw: () => void
  onLogin: () => void
  onClose: () => void
  // 연 버튼이 사라진 뒤(내 이름 창에서 열었다) 포커스를 돌려줄 곳.
  onCloseAutoFocus?: (event: Event) => void
}

// 탈퇴 확인 창(DEC-64): 학생회 기록의 이름이 바뀐다는 것과 되돌릴 수 없다는 것을 보이고 [탈퇴]·[닫기]다.
// 와이어프레임에 탈퇴 화면이 없어 공용 확인 창의 모양을 따른다. 오류는 버튼 바로 위에 보인다.
export default function WithdrawDialog({
  busy,
  reauth,
  error,
  onWithdraw,
  onLogin,
  onClose,
  onCloseAutoFocus,
}: Props) {
  return (
    <ConfirmDialog
      title="탈퇴"
      description={DESCRIPTION}
      confirmLabel={reauth ? '다시 로그인' : '탈퇴'}
      destructive={!reauth}
      busy={busy}
      error={error}
      onConfirm={reauth ? onLogin : onWithdraw}
      onClose={onClose}
      {...(onCloseAutoFocus ? { onCloseAutoFocus } : {})}
    />
  )
}
