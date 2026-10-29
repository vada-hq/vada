import type { LucideIcon } from 'lucide-react'

// 줄 앞 이유 아이콘 원(토스 혜택 줄의 둥근 그림 자리). 중립 회색이다: 이유는 그림과 사실 글이 말하고,
// 줄의 사람 얼굴이 범주 색을 쓰므로 원까지 색을 쓰면 '같은 색 = 같은 사람'이 흐려진다.
// 좁은 칸(@2xl 아래)에서는 뺀다: 정보가 아닌 원이 폭을 먹어 사람 글이 한 줄 더 꺾인다.
export default function IconDot({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span
      aria-hidden
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-fg-secondary @max-2xl:hidden @2xl:size-12"
    >
      <Icon className="size-5.5 @2xl:size-6" strokeWidth={2} />
    </span>
  )
}
