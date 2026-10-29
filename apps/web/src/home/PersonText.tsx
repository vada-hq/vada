import type { HomeOpsPerson } from '@vada/contracts'
import PersonFace from '@/components/PersonFace'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { contactText } from './ops-view'

const ASK_TEXT =
  '-mx-1.5 inline-flex min-h-9 max-w-full items-center gap-2 px-1.5 pr-2.5 text-row-sub font-medium text-primary-strong'

// 누구 칸의 사람: 얼굴 + 글. ask면 '…에게 묻기'(파란 글)이고, onAsk가 있으면 누르면 그 사람과의 1:1이 열린다.
// 줄 덮개(줄 = 일 보기) 위로 올려(relative z-10) 묻기만 누른다. onAsk가 없으면(1:1 권한 없음, 나) 같은 모양의 글이다.
// ask가 아니면 회장단 업무의 담당자처럼 사람만 보인다(회색 글).
export default function PersonText({
  person,
  ask = false,
  onAsk,
}: {
  person: HomeOpsPerson
  ask?: boolean
  onAsk?: (() => void) | undefined
}) {
  if (!ask)
    return (
      <span className="flex min-h-9 items-center gap-2 text-row-sub text-fg-secondary">
        <PersonFace name={person.name} tint={person.tint} />
        <span className="min-w-0 wrap-anywhere">{contactText(person)}</span>
      </span>
    )
  const body = (
    <>
      <PersonFace name={person.name} tint={person.tint} />
      <span className="min-w-0 text-left wrap-anywhere whitespace-normal">{`${contactText(person)}에게 묻기`}</span>
    </>
  )
  if (!onAsk) return <span className={ASK_TEXT}>{body}</span>
  return (
    <Button
      variant="ghost"
      data-who
      className={cn(
        ASK_TEXT,
        'relative z-10 h-auto justify-start rounded-full border-0 py-0 hover:bg-primary-surface hover:text-primary-strong',
      )}
      onClick={onAsk}
    >
      {body}
    </Button>
  )
}
