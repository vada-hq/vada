import type { Ref } from 'react'
import { Check, ChevronsUpDown, LogIn, Plus, Settings } from 'lucide-react'
import type { MyCouncil } from '@vada/contracts'
import { BrandMark } from '@/components/BrandMark'
import { Button } from '@/components/ui/button'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu'
import { cn } from '@/lib/utils'
import { scopeText } from '@/lib/council-text'
import type { CouncilEntry, Page } from './pages'

type Props = {
  onAddCouncil?: ((entry: CouncilEntry) => void) | undefined
  council: MyCouncil
  councils: MyCouncil[]
  onSelect: (councilId: string) => void
  onPage: (page: Page) => void
  // 머리 칸 단추. 학생회를 바꾼 뒤 포커스를 돌려놓을 때 쓴다.
  menuRef?: Ref<HTMLButtonElement> | undefined
  // 휴대폰 서랍 안이면 오른쪽 위의 닫기 단추 자리를 비운다.
  inSheet?: boolean
}

// 옆 메뉴 머리(와이어프레임 사이드바 v6.2): 파란 네모 'V'와 'Vada' / 회색 학생회 이름 두 줄, 아래 경계선.
// 와이어프레임은 누를 수 없지만 여러 학생회를 고르고 설정을 여는 자리라(DEC-87, DEC-38) 칸 전체가 학생회 메뉴 단추이고
// 오른쪽에 위아래 화살표를 둔다(DEC-96). 학생회 이름은 와이어프레임 gray-400이 흰 바탕에서 4.5:1에 못 미쳐 gray-500이다.
export default function CouncilMenu({
  council,
  councils,
  onSelect,
  onPage,
  menuRef,
  inSheet = false,
  onAddCouncil,
}: Props) {
  return (
    <div className="shrink-0 border-b border-gray-100">
      <Menu>
        <MenuTrigger asChild>
          <Button
            ref={menuRef}
            variant="ghost"
            className={cn(
              'h-auto w-full justify-start gap-2 rounded-none px-5 py-4 text-left hover:bg-gray-50',
              inSheet && 'pr-12',
            )}
            // 읽는 이름은 보이는 글(Vada, 학생회 이름)로 시작한다(WCAG 2.5.3).
            aria-label={`Vada ${council.name} 학생회 메뉴`}
          >
            <BrandMark />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold text-gray-900">Vada</span>
              <span className="truncate text-xs font-normal text-gray-500">{council.name}</span>
            </span>
            <ChevronsUpDown aria-hidden className="text-gray-500" />
          </Button>
        </MenuTrigger>
        <MenuContent align="start" className="w-72">
          <MenuLabel>학생회 고르기</MenuLabel>
          {councils.map(item => (
            <MenuItem
              key={item.id}
              aria-label={`${item.name} ${scopeText(item)}`.trim()}
              className="min-h-11 break-keep"
              onSelect={() => onSelect(item.id)}
            >
              {item.id === council.id ? (
                <Check aria-hidden />
              ) : (
                <span aria-hidden className="size-4 shrink-0" />
              )}
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="wrap-anywhere">{item.name}</span>
                {scopeText(item) && (
                  <span className="text-xs wrap-anywhere text-gray-500">{scopeText(item)}</span>
                )}
              </span>
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem className="min-h-11" onSelect={() => onAddCouncil?.('join')}>
            <LogIn aria-hidden />
            초대 코드로 들어가기
          </MenuItem>
          <MenuItem className="min-h-11" onSelect={() => onAddCouncil?.('create')}>
            <Plus aria-hidden />
            학생회 만들기
          </MenuItem>
          <MenuSeparator />
          <MenuItem className="min-h-11" onSelect={() => onPage('settings')}>
            <Settings aria-hidden />
            설정
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  )
}
