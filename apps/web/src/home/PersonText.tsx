import type { HomeOpsPerson } from '@vada/contracts'
import PersonFace from '@/components/PersonFace'
import { contactText } from './ops-view'

// 누구 칸의 사람: 얼굴 + 글. ask면 '…에게 묻기'(파란 글)이고, 묻기는 아직 없어(시연 뒤) 같은 모양의 글로 두고 누르는 곳이 아니다.
// ask가 아니면 회장단 업무의 담당자처럼 사람만 보인다(회색 글).
export default function PersonText({
  person,
  ask = false,
}: {
  person: HomeOpsPerson
  ask?: boolean
}) {
  if (!ask)
    return (
      <span className="flex min-h-9 items-center gap-2 text-row-sub text-fg-secondary">
        <PersonFace name={person.name} tint={person.tint} />
        <span className="min-w-0 wrap-anywhere">{contactText(person)}</span>
      </span>
    )
  return (
    <span className="-mx-1.5 inline-flex min-h-9 max-w-full items-center gap-2 px-1.5 pr-2.5 text-row-sub font-medium text-primary-strong">
      <PersonFace name={person.name} tint={person.tint} />
      <span className="min-w-0 wrap-anywhere">{`${contactText(person)}에게 묻기`}</span>
    </span>
  )
}
