import { LogOut } from 'lucide-react'
import type { CouncilView } from '@vada/contracts'
import PushSettingsButton from '../push/PushSettings'
import { councilRankLabel, placementsText } from '../team/team-view'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/ui/button'

type Props = {
  view: CouncilView | null
  user: { name: string }
  logoutBusy: boolean
  onLogout: () => void
}

// 옆 메뉴 아래 사용자 줄: 이름과 직급·부서, 휴대폰 알림, 로그아웃.
export default function SidebarFooter({ view, user, logoutBusy, onLogout }: Props) {
  const position =
    view &&
    (councilRankLabel(view.me.councilRank, view.council.titles) ||
      placementsText(
        { departments: view.me.departments },
        view.me.departments,
        view.council.titles,
      ))
  return (
    <footer className="flex shrink-0 items-center gap-2 border-t border-gray-100 px-4 py-3">
      <Avatar />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-700">{user.name}</p>
        {position && <p className="truncate text-xs text-gray-400">{position}</p>}
      </div>
      <PushSettingsButton />
      <Button
        variant="ghost"
        size="icon"
        aria-label="로그아웃"
        disabled={logoutBusy}
        onClick={onLogout}
      >
        <LogOut />
      </Button>
    </footer>
  )
}
