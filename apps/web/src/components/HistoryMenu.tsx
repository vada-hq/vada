import { useRef, useState } from 'react'
import { Ellipsis } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'

type Props<T> = {
  history: T[]
  // 판 하나를 한 줄 글로 옮긴다. 기능마다 판의 모양이 달라 호출하는 쪽이 정한다.
  line: (version: T) => string
}

// 상세 머리의 '⋯' 메뉴와 그 안의 [이력 보기]. 이력은 저장하되 상세에 펼쳐 두지 않고 필요할 때 창으로 연다(DEC-80).
// 창은 읽기만 한다. 고치거나 지우는 길이 없다.
export function HistoryMenu<T extends { versionNo: number }>({ history, line }: Props<T>) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <Button ref={trigger} variant="ghost" size="icon" aria-label="더 보기">
            <Ellipsis />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={() => setOpen(true)}>이력 보기</MenuItem>
        </MenuContent>
      </Menu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-describedby={undefined}
          onCloseAutoFocus={event => {
            // 메뉴 항목으로 연 창이라 Radix가 돌려줄 연 버튼이 없다.
            event.preventDefault()
            trigger.current?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>이력</DialogTitle>
          </DialogHeader>
          <ol className="flex flex-col gap-2 text-sm text-gray-700">
            {history.map(version => (
              <li key={version.versionNo} className="wrap-anywhere">
                {line(version)}
              </li>
            ))}
          </ol>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
