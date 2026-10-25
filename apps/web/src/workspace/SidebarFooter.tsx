import { useRef, useState } from 'react'
import { LogOut } from 'lucide-react'
import type { CouncilView } from '@vada/contracts'
import MyNameDialog from '../profile/MyNameDialog'
import { useRenameMe } from '../profile/useRenameMe'
import { useWithdrawal } from '../profile/useWithdrawal'
import WithdrawDialog from '../profile/WithdrawDialog'
import PushSettingsButton from '../push/PushSettings'
import { sidebarRoleLine } from '../team/team-view'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/ui/button'

// 와이어프레임 발 두 줄: 회색 원 안 사람 아이콘 + 이름 / '{부서} · {직급}'(작은 회색 글).
function Who({ name, position }: { name: string; position: string | null }) {
  return (
    <>
      <Avatar />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-medium text-gray-700">{name}</span>
        {position && (
          <span className="truncate text-xs font-normal text-gray-500" title={position}>
            {position}
          </span>
        )}
      </span>
    </>
  )
}

type Props = {
  view: CouncilView | null
  user: { id: string; name: string; email: string }
  logoutBusy: boolean
  onLogout: () => void
  // 내 이름을 바꿨다. 학생회와 운영진 목록을 다시 읽는다.
  onRenamed: () => void
}

// 옆 메뉴 아래 사용자 줄(와이어프레임 사이드바 v6.2, px-4 py-3, 위 경계선): 운영진 이름과 '{부서} · {직급}', 휴대폰 알림, 로그아웃. 이름을 누르면 '내 이름' 창에서 고치고, 그 창에서 탈퇴한다.
// 학생회를 읽기 전에는 로그인 계정 이름을 보인다.
export default function SidebarFooter({ view, user, logoutBusy, onLogout, onRenamed }: Props) {
  const [renaming, setRenaming] = useState(false)
  const rename = useRenameMe(() => {
    setRenaming(false)
    onRenamed()
  })
  const withdrawal = useWithdrawal(user.id)
  const userLine = useRef<HTMLButtonElement>(null)
  const name = view?.me.name ?? user.name
  const position = view && sidebarRoleLine(view.me, view.council.titles)
  return (
    <footer className="flex shrink-0 items-center gap-2 border-t border-gray-100 px-4 py-3">
      {view ? (
        <Button
          ref={userLine}
          variant="ghost"
          // 버튼 안의 직급·부서 줄도 이름에 넣는다(aria-label이 안의 글을 덮는다).
          aria-label={[`내 이름: ${name}`, position].filter(Boolean).join(', ')}
          // 올렸을 때 바탕은 gray-50이다. gray-100 위의 작은 gray-500 글은 4.5:1에 못 미친다(WCAG 1.4.3).
          className="-ml-1 min-w-0 flex-1 justify-start gap-2 px-1 py-1 text-left hover:bg-gray-50"
          onClick={() => {
            rename.reset()
            setRenaming(true)
          }}
        >
          <Who name={name} position={position} />
        </Button>
      ) : (
        // 학생회를 읽기 전에는 고칠 운영진 이름을 몰라 누르는 버튼이 아니다.
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Who name={name} position={null} />
        </div>
      )}
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
          email={user.email}
          busy={rename.busy}
          error={rename.error}
          onSave={name => {
            void rename.save(name)
          }}
          onClose={() => setRenaming(false)}
          // 내 이름 창을 닫고 확인 창만 띄운다.
          onWithdraw={() => {
            setRenaming(false)
            withdrawal.start()
          }}
        />
      )}
      {withdrawal.open && (
        <WithdrawDialog
          {...withdrawal.dialog}
          // 연 버튼(내 이름 창의 탈퇴)은 이미 없으므로 사용자 줄로 돌아간다.
          onCloseAutoFocus={event => {
            if (!userLine.current) return
            event.preventDefault()
            userLine.current.focus()
          }}
        />
      )}
    </footer>
  )
}
