import { SAVE_FAILED } from '@/lib/messages'
import { useEffect, useState } from 'react'
import { CancelReasonDialog } from '@/components/CancelReasonDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NavItem } from '@/components/ui/nav-item'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Section } from './GallerySection'
const BUSY_EXAMPLE_MS = 1500

export function DialogSheetSection() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  return (
    <Section title="대화상자·옆 메뉴">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">대화상자 열기</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 행사</DialogTitle>
            <DialogDescription>행사를 만들면 대화방이 함께 생겨요.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="g-dialog-name">행사 이름</Label>
            <Input id="g-dialog-name" placeholder="새 행사 이름" />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">취소</Button>
            </DialogClose>
            <Button>행사 만들기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button variant="outline" onClick={() => setSheetOpen(true)}>
        옆 메뉴 열기
      </Button>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent title="예시 메뉴">
          <div className="flex flex-col gap-0.5 px-2 pt-14">
            <NavItem active>체육대회</NavItem>
            <NavItem>축제</NavItem>
          </div>
        </SheetContent>
      </Sheet>
      <Button variant="outline" onClick={() => setPanelOpen(true)}>
        오른쪽 패널 열기
      </Button>
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" title="예시 패널" closeLabel="패널 닫기" className="w-96">
          <div className="p-6 pt-14 text-sm text-gray-700">대화 링크의 상품 정보 패널</div>
        </SheetContent>
      </Sheet>
    </Section>
  )
}

export function ConfirmSection() {
  // 확인 대화상자의 모양: 사유 꼭·사유 선택(칸 아래에 이유가 보인다)과 위험한 동작(빨간 확인 버튼과 오류 문구), 일반 동작(파란 확인 버튼), 보내는 중(두 버튼이 꺼지고 닫히지 않음).
  const [confirmKind, setConfirmKind] = useState<
    'destructive' | 'normal' | 'busy' | 'required' | 'optional' | null
  >(null)
  // 보내는 중 예시는 닫히지 않으므로 실제 응답이 오듯 잠시 뒤 저절로 닫는다.
  useEffect(() => {
    if (confirmKind !== 'busy') return
    const timer = setTimeout(() => setConfirmKind(null), BUSY_EXAMPLE_MS)
    return () => clearTimeout(timer)
  }, [confirmKind])
  const closeConfirm = () => setConfirmKind(null)
  return (
    <Section title="확인 대화상자">
      <Button variant="outline" onClick={() => setConfirmKind('destructive')}>
        확인 대화상자 열기
      </Button>
      <Button variant="outline" onClick={() => setConfirmKind('normal')}>
        일반 확인 대화상자 열기
      </Button>
      <Button variant="outline" onClick={() => setConfirmKind('busy')}>
        보내는 중 확인 대화상자 열기
      </Button>
      <Button variant="outline" onClick={() => setConfirmKind('required')}>
        사유 꼭 확인 대화상자 열기
      </Button>
      <Button variant="outline" onClick={() => setConfirmKind('optional')}>
        사유 선택 확인 대화상자 열기
      </Button>
      {(confirmKind === 'required' || confirmKind === 'optional') && (
        <CancelReasonDialog
          title={confirmKind === 'required' ? '이 지출을 취소할까요?' : '이 행사를 완료할까요?'}
          reasonLabel={confirmKind === 'required' ? '취소 사유' : '사유'}
          confirmLabel={confirmKind === 'required' ? '지출 취소' : '완료'}
          optional={confirmKind === 'optional'}
          destructive={confirmKind === 'required'}
          busy={false}
          error={null}
          parse={() => ({ success: true })}
          onClose={closeConfirm}
          onConfirm={closeConfirm}
        />
      )}
      <ConfirmDialog
        open={confirmKind === 'destructive'}
        destructive
        title="박새내님을 내보낼까요?"
        error={SAVE_FAILED}
        description="학생회 소속과 부서 소속이 함께 끝나요. 초대 링크로 다시 들어올 수 있지만, 부서와 직급은 다시 정해야 해요."
        confirmLabel="내보내기"
        onClose={closeConfirm}
        onConfirm={closeConfirm}
      />
      <ConfirmDialog
        open={confirmKind === 'normal'}
        title="이재정님에게 회장 직급을 넘길까요?"
        description="넘기면 나는 직급이 없어지고, 회장만 하던 일은 넘겨받은 사람이 해요."
        confirmLabel="넘기기"
        onClose={closeConfirm}
        onConfirm={closeConfirm}
      />
      <ConfirmDialog
        open={confirmKind === 'busy'}
        destructive
        busy
        title="박새내님을 내보낼까요?"
        description="학생회 소속과 부서 소속이 함께 끝나요. 초대 링크로 다시 들어올 수 있지만, 부서와 직급은 다시 정해야 해요."
        confirmLabel="내보내기"
        onClose={closeConfirm}
        onConfirm={closeConfirm}
      />
    </Section>
  )
}
