import { useState, type ReactNode } from 'react'
import type { TeamMember } from '@vada/contracts'
import { Input } from '@/components/ui/input'
import { OrgGroupCard } from './OrgGroupCard'

type Props = {
  people: TeamMember[]
  // 회장단에게는 이름 찾기가 있다(DEC-91). 다른 운영진은 동작 없이 본다.
  searchable: boolean
  person: (member: TeamMember, groupKey: string) => ReactNode
}

// 미배정 구성원 묶음(DEC-91, 기능 023 조각 5): 있을 때만 그린다. 회장단은 이름으로 줄인다.
export function UnassignedGroup({ people, searchable, person }: Props) {
  const [query, setQuery] = useState('')
  if (people.length === 0) return null
  const word = query.trim()
  const shown = word ? people.filter(member => member.name.includes(word)) : people
  return (
    <OrgGroupCard
      title="미배정 구성원"
      groupKey="unassigned"
      meta={`${people.length}명`}
      people={shown}
      person={person}
      tools={
        searchable && (
          <div className="border-b px-4 py-2">
            <Input
              aria-label="이름으로 찾기"
              // oxlint-disable-next-line react/forbid-component-props -- 제출과 칸 확인이 없는 검색칸의 짧은 안내만 예외다(AGENTS.md '화면 문구와 폼').
              placeholder="이름으로 찾기"
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
          </div>
        )
      }
    />
  )
}
