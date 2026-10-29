import { FolderInput, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { C1rRow } from '../c1r-data'
import { AVATAR_TONES } from './tokens'

// 사람 머리글자 원. 사진이 없어 성 한 글자를 쓴다(메시지·Flighty의 얼굴 원 대신).
// 배정 줄(사람 없음)은 무엇을 배정하는지 아이콘으로: 미배정 구성원 = 사람 더하기, 부서 미정 = 폴더로 넣기. 중립 면.
// 색은 성(첫 글자)으로 고른다. 견본의 김·이·박·정·최가 서로 다른 색이 된다.
function toneOf(name: string) {
  return AVATAR_TONES[(name.codePointAt(0) ?? 0) % AVATAR_TONES.length]
}

export function Avatar({
  row,
  size,
  className,
}: {
  row: C1rRow
  size: string
  className?: string | undefined
}) {
  const Icon = row.kind === 'unassigned' ? UserPlus : FolderInput
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold select-none',
        size,
        row.person ? toneOf(row.person.name) : 'bg-muted text-fg-tertiary',
        className,
      )}
    >
      {row.person ? row.person.name.slice(0, 1) : <Icon className="size-[45%]" strokeWidth={2} />}
    </span>
  )
}
