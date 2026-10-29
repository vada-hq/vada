import { CircleDashed, Clock, Users, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { C2Signal } from '../c2-data'
import { PILL, PILL_HIT, PILL_ICON, TEXT_PILL } from './tokens'

// 신호 갈래마다 그림 하나(e16의 '아이콘 + 단어'). 그림은 갈래를 알려 주는 표시이고 뜻은 단어가 말한다.
const ICON: Record<C2Signal['kind'], LucideIcon> = {
  registration: Users,
  undecided: CircleDashed,
  late: Clock,
  budget: Wallet,
}

// 신청 현황 글('18/40')만으로는 무엇의 수인지 모호해 앞에 '신청'을 붙인다(레퍼런스 977 배치의 '신청 18/40').
const labelOf = (signal: C2Signal) =>
  signal.kind === 'registration' ? `신청 ${signal.text}` : signal.text

// 생김새 세 가지. 위험(지남·예산 초과)만 위험 색, 다 참은 굵은 진한 글로 강조(위험 색 아님), 나머지는 회색 면.
function toneOf(signal: C2Signal) {
  if (signal.danger) return 'bg-danger-surface font-semibold text-danger'
  if (signal.kind === 'registration' && signal.full) return 'bg-muted font-semibold text-fg'
  return 'bg-muted font-medium text-fg-secondary'
}

// 신호 알약 하나 = 누르는 자리 하나(테두리 버튼 없음). 줄 덮개(행사 보기) 위에 올려 따로 눌린다.
export function SignalPill({ signal, onClick }: { signal: C2Signal; onClick: () => void }) {
  const Icon = ICON[signal.kind]
  return (
    <Button
      variant="ghost"
      touch={false}
      data-c2-danger={signal.danger || undefined}
      className={cn(
        'group/pill relative z-10 h-auto rounded-full border-0 bg-transparent p-0 hover:bg-transparent',
        PILL_HIT,
        PILL_ICON,
      )}
      onClick={onClick}
    >
      <span
        className={cn(
          'inline-flex items-center whitespace-nowrap group-hover/pill:underline',
          PILL,
          TEXT_PILL,
          toneOf(signal),
        )}
      >
        <Icon aria-hidden strokeWidth={2.25} />
        {labelOf(signal)}
      </span>
    </Button>
  )
}
