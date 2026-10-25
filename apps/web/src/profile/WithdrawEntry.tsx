import { Button } from '@/components/ui/button'
import { useWithdrawal } from './useWithdrawal'
import WithdrawDialog from './WithdrawDialog'

// 학생회가 없을 때의 가운데 카드에 두는 [탈퇴]와 그 확인 창. 학생회가 있으면 옆 메뉴의 내 이름 창에서 연다.
export default function WithdrawEntry({ userId }: { userId: string }) {
  const withdrawal = useWithdrawal(userId)
  return (
    <>
      {/* 옆의 [로그아웃]과 같은 높이로 두고, 테두리 없는 버튼이라 덜 눈에 띈다. */}
      <Button variant="ghost" onClick={withdrawal.start}>
        탈퇴
      </Button>
      {withdrawal.open && <WithdrawDialog {...withdrawal.dialog} />}
    </>
  )
}
