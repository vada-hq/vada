import { Check, ChevronsUpDown, LogOut, Users } from 'lucide-react'
import type { CouncilView, MyCouncil } from '@vada/contracts'
import PushSettingsButton from '../push/PushSettings'
import { councilRankLabel, placementsText } from '../team/team-view'
import { Avatar } from '@/components/Avatar'
import { BrandMark } from '@/components/BrandMark'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from '@/components/ui/menu'
import { NavItem } from '@/components/ui/nav-item'

export type Page = 'people'
type Props = {
  council: MyCouncil
  councils: MyCouncil[]
  view: CouncilView | null
  page: Page
  onSelect: (councilId: string) => void
  onPage: (page: Page) => void
  user: { name: string }
  logoutBusy: boolean
  onLogout: () => void
}

// 옆 메뉴(와이어프레임 210px): 위 학생회 이름 메뉴, 가운데 메뉴(바탕에서는 운영진만), 아래 사용자 줄(이름, 휴대폰 알림, 로그아웃).
// 데스크톱 aside와 휴대폰 옆 메뉴(시트)가 같이 쓴다. 위 블록의 오른쪽 여백은 시트 닫기 버튼 자리다.
export default function WorkspaceSidebar({ council, councils, view, page, onSelect, onPage, user, logoutBusy, onLogout }: Props) {
  const position = view && (councilRankLabel(view.me.councilRank, view.council.titles)
    || placementsText({ departments: view.me.departments }, view.me.departments, view.council.titles))
  return <div className="flex h-full min-h-0 flex-col">
    <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 py-3 pr-10 pl-4">
      <BrandMark />
      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost" className="min-w-0 flex-1 justify-between px-2 text-gray-900" aria-label={`학생회 메뉴: ${council.name}`}>
            <span className="truncate text-sm font-semibold">{council.name}</span><ChevronsUpDown aria-hidden />
          </Button>
        </MenuTrigger>
        <MenuContent align="start">
          <MenuLabel>학생회 고르기</MenuLabel>
          {councils.map(item => <MenuItem key={item.id} onSelect={() => onSelect(item.id)}>
            {item.id === council.id ? <Check aria-hidden /> : <span aria-hidden className="size-4 shrink-0" />}{item.name}
          </MenuItem>)}
        </MenuContent>
      </Menu>
    </div>
    <nav aria-label="학생회 메뉴" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
      <p className="px-3 pb-1 text-xs font-medium text-gray-400">운영진</p>
      <NavItem active={page === 'people'} className="flex items-center gap-2" onClick={() => onPage('people')}>
        <Users aria-hidden className="size-4" />사람
      </NavItem>
    </nav>
    <footer className="flex shrink-0 items-center gap-2 border-t border-gray-100 px-4 py-3">
      <Avatar />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-700">{user.name}</p>
        {position && <p className="truncate text-xs text-gray-400">{position}</p>}
      </div>
      <PushSettingsButton />
      <Button variant="ghost" size="icon" aria-label="로그아웃" disabled={logoutBusy} onClick={onLogout}><LogOut /></Button>
    </footer>
  </div>
}
