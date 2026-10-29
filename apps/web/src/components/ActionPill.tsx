import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

// 줄 끝의 확인 행동 알약('확인하기'): 파란 면을 채운 알약 + 꺾쇠. 원래 화면으로 가는 링크이고 줄 덮개 위(z-10)에 있다.
// ①의 파란 글 '…에게 묻기'와 생김새를 달리해 같은 홈에서 두 구역이 같은 모양으로 이어지지 않게 한다(c35 확정 시안).
export default function ActionPill({
  children,
  onClick,
}: {
  children: string
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      data-who
      className="group/act relative z-10 h-auto rounded-full border-0 bg-transparent p-0 font-medium hover:bg-transparent max-sm:-my-1 max-sm:min-h-11"
      onClick={onClick}
    >
      <span className="inline-flex h-9 items-center gap-0.5 rounded-full bg-primary-surface px-3.5 text-row-sub font-semibold whitespace-nowrap text-primary-strong group-hover/act:bg-primary-surface/60">
        {children}
        <ChevronRight aria-hidden className="-mr-1 size-4" />
      </span>
    </Button>
  )
}
