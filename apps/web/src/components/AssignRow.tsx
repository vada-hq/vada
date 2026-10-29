import { ChevronRight, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import IconDot from './IconDot'
import { ROW_BODY, ROW_BOX } from './TwoColumnRow'

export type AssignLink = { label: string; onClick: () => void }

// 모음 줄(회장단 홈 ① '회장단이 배정할 일'): 아이콘 원 / 제목 | 글 단추 여럿. 가는 곳이 여럿이라 줄 전체를 누르게 하지 않고
// 누구 칸에 파란 글 단추를 갈래마다 하나씩 둔다. 두 칸 줄과 같은 세로선에 서도록 꺾쇠 칸 폭을 비워 둔다.
export default function AssignRow({
  icon,
  title,
  links,
}: {
  icon: LucideIcon
  title: string
  links: AssignLink[]
}) {
  return (
    <li className={ROW_BOX}>
      <IconDot icon={icon} />
      <div className={ROW_BODY}>
        <p className="text-row-title font-semibold tracking-tight text-fg">{title}</p>
        <div className="mt-1.5 flex min-w-0 flex-wrap gap-x-4 gap-y-1 @2xl:mt-0">
          {links.map(link => (
            <Button
              key={link.label}
              variant="link"
              className="relative z-10 -mx-1.5 h-auto min-h-9 gap-0.5 rounded-full border-0 px-1.5 text-row-sub font-medium text-primary-strong hover:bg-primary-surface hover:no-underline max-sm:-my-2 max-sm:min-h-11 [&_svg]:size-4"
              onClick={link.onClick}
            >
              {link.label}
              <ChevronRight aria-hidden className="@max-2xl:hidden" />
            </Button>
          ))}
        </div>
      </div>
      <span aria-hidden className="size-5 shrink-0 @max-2xl:hidden" />
    </li>
  )
}
