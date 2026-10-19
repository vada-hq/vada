import type { CouncilView } from '@vada/contracts'
import { Avatar } from '@/components/Avatar'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { councilRankLabel, joinedDay, placementsText } from './team-view'
import type { Team } from './useTeam'

// 운영진 > 사람: 이름, 직급(학생회가 정한 표시 이름), 부서와 부서 직급, 들어온 날. 들어온 순서대로다(DEC-47).
export default function People({ view, team }: { view: CouncilView; team: Team }) {
  const { data, loadFailed, reload } = team
  if (!data) return loadFailed
    ? <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">운영진을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={reload}>다시 시도</Button></Card>
    : <StateMessage kind="loading">운영진 불러오는 중…</StateMessage>
  const titles = view.council.titles
  return <div className="mx-auto flex max-w-3xl flex-col gap-4">
    <h2 className="text-base font-semibold text-gray-900">운영진 {data.members.length}명</h2>
    <Card className="overflow-hidden">
      <ul aria-label="운영진" className="divide-y">
        {data.members.map(member => {
          const rank = councilRankLabel(member.councilRank, titles)
          const placements = placementsText(member, data.departments, titles)
          return <li key={member.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm wrap-anywhere text-gray-900">{member.name}
                {rank && <Badge tone="info">{rank}</Badge>}</p>
              <p className="text-xs wrap-anywhere text-gray-500">{placements || '부서 없음'} · {joinedDay(member.joinedAt)} 들어옴</p>
            </div>
          </li>
        })}
      </ul>
    </Card>
  </div>
}
