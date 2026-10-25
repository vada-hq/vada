import { useId } from 'react'
import { Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cardClass } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Props = {
  // 로그인에 이어진 운영진 이름. 없으면 '내 이름' 칸을 보인다.
  linkedName: string | null
  memberName: string
  error: string | undefined
  onChange: (event: { target: { value: string } }) => void
}

// 조직도 맨 위의 회장단 카드(와이어프레임 ORG-02, 별 표시): 고칠 수 없고, 만든 사람이 회장이다(DEC-17).
// 이름은 처음 한 번 Google 이름을 확인하게 한다(기능 020 정한 것 8). 넓은 화면은 가운데, 휴대폰은 폭 전체다.
export default function PresidentCard({ linkedName, memberName, error, onChange }: Props) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className={cn(cardClass, 'flex flex-col sm:mx-auto sm:w-68')}
    >
      <h3
        id={titleId}
        className="flex items-center gap-1.5 border-b px-3 py-2.5 text-sm font-semibold text-gray-900"
      >
        <Star aria-hidden className="size-4 text-amber-500" />
        회장단
      </h3>
      <div className="p-3">
        {linkedName === null ? (
          <Field label="내 이름" required error={error}>
            <Input value={memberName} onChange={onChange} autoComplete="name" />
          </Field>
        ) : (
          <p className="flex items-center gap-2 text-sm text-gray-800">
            <span className="min-w-0 wrap-anywhere">{linkedName}</span>
            <Badge>회장</Badge>
          </p>
        )}
      </div>
    </section>
  )
}
