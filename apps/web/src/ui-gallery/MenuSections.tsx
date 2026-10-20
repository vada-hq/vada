import { CalendarDays, Check, Ellipsis, Settings } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { BrandMark } from '@/components/BrandMark'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu'
import { NavItem } from '@/components/ui/nav-item'
import { TabButton } from '@/components/ui/tab-button'
import { Section } from './GallerySection'
import { longName } from './sample-text'

export function MenuTabsSection() {
  return (
    <Section title="메뉴·탭">
      <div className="flex w-60 flex-col gap-0.5 rounded-lg border bg-white p-2">
        <NavItem active>체육대회</NavItem>
        <NavItem>축제</NavItem>
        <NavItem disabled>비활성 행사</NavItem>
      </div>
      <div role="tablist" aria-label="예시 탭" className="flex gap-0.5 border-b bg-white px-6">
        <TabButton aria-selected>대화</TabButton>
        <TabButton aria-selected={false}>구매요청</TabButton>
      </div>
    </Section>
  )
}

export function ActionMenuSection() {
  return (
    <Section title="동작 메뉴">
      <Menu>
        <MenuTrigger asChild>
          <Button variant="outline">학생회 메뉴 열기</Button>
        </MenuTrigger>
        <MenuContent align="start">
          <MenuLabel>학생회 고르기</MenuLabel>
          <MenuItem>
            <Check aria-hidden />
            컴퓨터학부 학생회
          </MenuItem>
          <MenuItem>
            <span aria-hidden className="size-4 shrink-0" />
            {longName}
          </MenuItem>
          <MenuSeparator />
          <MenuItem>
            <Settings aria-hidden />
            설정
          </MenuItem>
        </MenuContent>
      </Menu>
      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="운영진 동작 예시">
            <Ellipsis />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem>부서 배정</MenuItem>
          <MenuItem>부회장 직급 주기</MenuItem>
          <MenuItem destructive>내보내기</MenuItem>
        </MenuContent>
      </Menu>
    </Section>
  )
}

export function EmptyAvatarSection() {
  return (
    <Section title="빈 화면·아바타·로고">
      <Card className="w-96">
        <EmptyState
          icon={CalendarDays}
          title="행사를 선택해 주세요"
          description="왼쪽에서 행사를 선택하거나 새 행사를 만들어 대화를 시작하세요."
        />
      </Card>
      <div className="flex items-center gap-2">
        <Avatar />
        <span className="text-xs font-medium text-gray-700">박해랑</span>
      </div>
      <div className="flex items-center gap-2">
        <BrandMark />
        <span className="text-base font-semibold">VADA</span>
      </div>
    </Section>
  )
}
