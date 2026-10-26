import type { ReactNode } from 'react'
import type { CouncilTitles, TeamDepartment, TeamMember } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { dayTimeLabel } from '@/lib/korean-date-text'
import type { PersonActions } from './people-access'
import { viceChange, type Undoable } from './person-changes'
import { PersonPlacements } from './PersonPlacements'
import { councilRankLabel } from './team-view'

type Props = {
  member: TeamMember
  departments: TeamDepartment[]
  titles: CouncilTitles
  actions: PersonActions
  saving: boolean
  // 이 창에서 생긴 요청 오류. 동작 옆(창 안)에 보인다.
  error: string
  // 되돌리기 토스트. 창이 열려 있으면 뒤 화면을 누를 수 없어 창 안 맨 아래에 둔다.
  toast: ReactNode
  onSave: (item: Undoable) => void
  onConfirm: (kind: 'transfer' | 'remove') => void
  onClose: () => void
}

// 사람 상세(와이어프레임 ORG-03B의 사람 카드, DEC-91은 팝오버 대신 상세 창): 이름, 들어온 때, 학생회 직급 한 칸,
// 부서마다 줄, 권한에 맞는 동작. 회장 넘기기와 내보내기만 확인 창이고 나머지는 바로 저장하고 되돌리기를 준다.
// 휴대폰은 아래, 넓은 화면은 오른쪽 시트이고 뒤로 가기와 Esc로 닫힌다(DEC-78).
export function PersonSheet(props: Props) {
  const { member, titles, actions, saving, error, toast, onSave, onConfirm, onClose } = props
  return (
    <Sheet
      open
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <SheetContent side="adaptive" title={member.name} closeLabel="닫기">
        <div className="flex flex-col gap-5 overflow-y-auto px-6 pt-1 pb-6">
          <p className="text-xs text-gray-500">{dayTimeLabel(member.joinedAt)} 들어옴</p>
          <section aria-label="학생회 직급" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-gray-900">학생회 직급</h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-800">
                {councilRankLabel(member.councilRank, titles) ?? '없음'}
              </span>
              {actions.vice && (
                <Button
                  variant="outline"
                  size="sm"
                  touch
                  busy={saving}
                  onClick={() => onSave(viceChange(member, titles))}
                >
                  {member.councilRank === 'vice_president'
                    ? `${titles.vicePresident} 해제`
                    : `${titles.vicePresident} 지정`}
                </Button>
              )}
            </div>
          </section>
          <PersonPlacements {...props} />
          {(actions.transfer || actions.remove) && (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {actions.transfer && (
                <Button variant="outline" touch busy={saving} onClick={() => onConfirm('transfer')}>
                  {titles.president} 넘기기
                </Button>
              )}
              {actions.remove && (
                <Button
                  variant="outline"
                  touch
                  busy={saving}
                  className="text-red-700"
                  onClick={() => onConfirm('remove')}
                >
                  내보내기
                </Button>
              )}
            </div>
          )}
          {error && <StateMessage kind="error">{error}</StateMessage>}
          {toast}
        </div>
      </SheetContent>
    </Sheet>
  )
}
