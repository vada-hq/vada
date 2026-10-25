import { useState } from 'react'
import { LogOut } from 'lucide-react'
import type { CouncilView } from '@vada/contracts'
import MyNameDialog from '../profile/MyNameDialog'
import { useRenameMe } from '../profile/useRenameMe'
import PushSettingsButton from '../push/PushSettings'
import { councilRankLabel, placementsText } from '../team/team-view'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/ui/button'

type Props = {
  view: CouncilView | null
  user: { name: string }
  logoutBusy: boolean
  onLogout: () => void
  // 내 이름을 바꿨다. 학생회와 운영진 목록을 다시 읽는다.
  onRenamed: () => void
}

// 옆 메뉴 아래 사용자 줄: 운영진 이름과 직급·부서, 휴대폰 알림, 로그아웃. 이름을 누르면 '내 이름' 창에서 고친다.
// 학생회를 읽기 전에는 로그인 계정 이름을 보인다.
export default function SidebarFooter({ view, user, logoutBusy, onLogout, onRenamed }: Props) {
  const [renaming, setRenaming] = useState(false)
  const rename = useRenameMe(() => {
    setRenaming(false)
    onRenamed()
  })
  const name = view?.me.name ?? user.name
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
      <Button
        variant="ghost"
        aria-label={`내 이름: ${name}`}
        className="-ml-1 min-w-0 flex-1 justify-start gap-2 px-1 py-1 text-left"
        onClick={() => {
          rename.reset()
          setRenaming(true)
        }}
      >
        <Avatar />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-xs font-medium text-gray-700">{name}</span>
          {position && <span className="truncate text-xs text-gray-400">{position}</span>}
        </span>
      </Button>
      <PushSettingsButton />
      <Button
        variant="ghost"
        size="icon"
        aria-label="로그아웃"
        busy={logoutBusy}
        onClick={onLogout}
      >
        <LogOut />
      </Button>
      {renaming && view && (
        <MyNameDialog
          name={view.me.name}
          busy={rename.busy}
          error={rename.error}
          onSave={name => {
            void rename.save(name)
          }}
          onClose={() => setRenaming(false)}
        />
      )}
    </footer>
  )
}
