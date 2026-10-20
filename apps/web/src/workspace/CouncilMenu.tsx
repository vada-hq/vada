import type { Ref } from 'react'
import { Check, ChevronsUpDown, Settings } from 'lucide-react'
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
import type { Page } from './pages'

type Props = {
  council: MyCouncil
  councils: MyCouncil[]
  onSelect: (councilId: string) => void
  onPage: (page: Page) => void
  // 학생회 이름 버튼. 학생회를 바꾼 뒤 포커스를 돌려놓을 때 쓴다.
  menuRef?: Ref<HTMLButtonElement> | undefined
}

// 옆 메뉴 위 블록: 학생회 이름 메뉴(학생회 고르기, 설정). 오른쪽 여백은 시트 닫기 버튼 자리다.
export default function CouncilMenu({ council, councils, onSelect, onPage, menuRef }: Props) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 py-3 pr-10 pl-4">
      <BrandMark />
      <Menu>
        <MenuTrigger asChild>
          <Button
            ref={menuRef}
            variant="ghost"
            className="min-w-0 flex-1 justify-between px-2 text-gray-900"
            aria-label={`학생회 메뉴: ${council.name}`}
          >
            <span className="truncate text-sm font-semibold">{council.name}</span>
            <ChevronsUpDown aria-hidden />
          </Button>
        </MenuTrigger>
        <MenuContent align="start">
          <MenuLabel>학생회 고르기</MenuLabel>
          {councils.map(item => (
            <MenuItem key={item.id} onSelect={() => onSelect(item.id)}>
              {item.id === council.id ? (
                <Check aria-hidden />
              ) : (
                <span aria-hidden className="size-4 shrink-0" />
              )}
              {item.name}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem onSelect={() => onPage('settings')}>
            <Settings aria-hidden />
            설정
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  )
}
