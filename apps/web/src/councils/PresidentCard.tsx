import { useId } from 'react'
import { Badge } from '@/components/ui/badge'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { orgGroupClass } from './org-group'

type Props = {
  // 로그인에 이어진 운영진 이름. 없으면 '내 이름' 칸을 보인다.
  linkedName: string | null
  memberName: string
  error: string | undefined
  onChange: (event: { target: { value: string } }) => void
}

// 조직 구조의 회장단 묶음: 고칠 수 없고, 만든 사람이 회장이다(DEC-17). 이름은 처음 한 번 Google 이름을 확인하게 한다(기능 020 정한 것 8).
// 부서 묶음과 같은 모양이라 같은 층의 조직 단위로 읽힌다(와이어프레임 ORG-02).
export default function PresidentCard({ linkedName, memberName, error, onChange }: Props) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className={orgGroupClass}>
      <h3 id={titleId} className="text-sm font-semibold text-gray-900">
        회장단
      </h3>
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
    </section>
  )
}
