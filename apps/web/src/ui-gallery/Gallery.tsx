import { useEffect, useState, type ReactNode } from 'react'
import { CalendarDays, Check, Copy, Ellipsis, Plus, Settings } from 'lucide-react'
import { AuthCard } from '@/components/AuthCard'
import { Avatar } from '@/components/Avatar'
import { BrandMark } from '@/components/BrandMark'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu'
import { NativeSelect } from '@/components/ui/native-select'
import { NavItem } from '@/components/ui/nav-item'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { TabButton } from '@/components/ui/tab-button'
import { Textarea } from '@/components/ui/textarea'
import KakaoBlock from '@/auth/KakaoBlock'
import PushPanel from '@/push/PushPanel'
import { SAVE_FAILED } from '@/lib/messages'

const LONG_NAME_REPEAT = 2
const UNBROKEN_REPEAT = 12
const BUSY_EXAMPLE_MS = 1500

const longName =
  '2026 소프트웨어융합대학 체육대회 준비와 참가자 명단 확인 그리고 물품 구매 요청 정리를 위한 아주 긴 행사 이름'.repeat(
    LONG_NAME_REPEAT,
  )
const unbroken = `https://www.coupang.com/vp/products/${'1234567890'.repeat(UNBROKEN_REPEAT)}`
// 카톡 안 로그인 예시용 사용자 에이전트. KakaoBlock에 가짜 주소·가짜 복사와 함께 끼워 넣어, 버튼을 눌러도 이 화면이 넘어가거나 클립보드를 건드리지 않는다.
const kakaoUserAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.0'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b py-6">
      <h2 className="text-base">{title}</h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  )
}

// 새 부품이나 변형을 더하면 여기에도 더한다(AGENTS.md "화면" 절). 와이어프레임 스크린샷과 나란히 비교하는 화면이다.
export default function Gallery() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  // 확인 대화상자의 세 모양: 위험한 동작(빨간 확인 버튼과 오류 문구), 일반 동작(파란 확인 버튼), 보내는 중(두 버튼이 꺼지고 닫히지 않음).
  const [confirmKind, setConfirmKind] = useState<'destructive' | 'normal' | 'busy' | null>(null)
  // 보내는 중 예시는 닫히지 않으므로 실제 응답이 오듯 잠시 뒤 저절로 닫는다.
  useEffect(() => {
    if (confirmKind !== 'busy') return
    const timer = setTimeout(() => setConfirmKind(null), BUSY_EXAMPLE_MS)
    return () => clearTimeout(timer)
  }, [confirmKind])
  const closeConfirm = () => setConfirmKind(null)
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-xl font-bold">VADA 부품</h1>
      <Section title="버튼">
        <Button>주 버튼</Button>
        <Button variant="outline">테두리</Button>
        <Button variant="secondary">보조</Button>
        <Button variant="ghost">텍스트</Button>
        <Button variant="destructive">위험</Button>
        <Button variant="link">링크 →</Button>
        <Button size="sm">
          <Plus />새 행사
        </Button>
        <Button size="sm" variant="outline">
          <Copy />
          코드 복사
        </Button>
        <Button disabled>비활성</Button>
        <Button variant="ghost" size="icon" aria-label="달력">
          <CalendarDays />
        </Button>
      </Section>
      <Section title="입력">
        <div className="flex w-72 flex-col gap-1.5">
          <Label htmlFor="g-input">행사 이름</Label>
          <Input id="g-input" placeholder="새 행사 이름" />
        </div>
        <div className="flex w-72 flex-col gap-1.5">
          <Label htmlFor="g-code">초대 코드</Label>
          <Input
            id="g-code"
            readOnly
            value="ABCD2345"
            className="font-mono text-xl font-bold tracking-widest sm:text-xl"
          />
        </div>
        <div className="flex w-72 flex-col gap-1.5">
          <Label htmlFor="g-invalid">송장번호</Label>
          <Input id="g-invalid" aria-invalid defaultValue="잘못된 값" />
        </div>
        <div className="flex w-72 flex-col gap-1.5">
          <Label htmlFor="g-select">상태 필터</Label>
          <NativeSelect id="g-select">
            <option>전체 상태</option>
            <option>승인</option>
          </NativeSelect>
        </div>
        <div className="flex w-72 flex-col gap-1.5">
          <Label htmlFor="g-textarea">메시지</Label>
          <Textarea id="g-textarea" placeholder="행사 준비 이야기를 나눠 주세요" />
        </div>
        <div className="flex w-72 flex-col gap-1.5">
          <Label htmlFor="g-disabled">비활성</Label>
          <Input id="g-disabled" disabled value="입력할 수 없음" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-blue-600" defaultChecked />
          체크박스
        </label>
      </Section>
      <Section title="칩">
        <Badge tone="info">접수</Badge>
        <Badge tone="success">승인</Badge>
        <Badge tone="warning">보완 요청</Badge>
        <Badge tone="danger">반려</Badge>
        <Badge>검토 대기</Badge>
      </Section>
      <Section title="카드·배너">
        <Card className="w-72 p-4">
          <p className="text-sm font-semibold">카드 제목</p>
          <p className="text-xs text-gray-500">카드 설명</p>
        </Card>
        <div className="flex w-full flex-col gap-2">
          <Alert tone="info">학생회 초대 링크로 들어왔어요. 로그인하면 참여할 수 있어요.</Alert>
          <Alert tone="success">참여했어요.</Alert>
          <Alert tone="warning">카카오톡 안에서는 Google 로그인이 막혀 있어요.</Alert>
          <Alert tone="danger">처리하지 못했어요.</Alert>
        </div>
      </Section>
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
        <ConfirmDialog
          open={confirmKind === 'destructive'}
          destructive
          title="박새내님을 내보낼까요?"
          error={SAVE_FAILED}
          description="학생회 소속과 부서 소속이 함께 끝나요. 초대 링크로 다시 들어올 수 있지만, 부서와 직급은 다시 정해야 해요."
          confirmLabel="내보내기"
          onCancel={closeConfirm}
          onConfirm={closeConfirm}
        />
        <ConfirmDialog
          open={confirmKind === 'normal'}
          title="이재정님에게 회장 직급을 넘길까요?"
          description="넘기면 나는 직급이 없어지고, 회장만 하던 일은 넘겨받은 사람이 해요."
          confirmLabel="넘기기"
          onCancel={closeConfirm}
          onConfirm={closeConfirm}
        />
        <ConfirmDialog
          open={confirmKind === 'busy'}
          destructive
          busy
          title="박새내님을 내보낼까요?"
          description="학생회 소속과 부서 소속이 함께 끝나요. 초대 링크로 다시 들어올 수 있지만, 부서와 직급은 다시 정해야 해요."
          confirmLabel="내보내기"
          onCancel={closeConfirm}
          onConfirm={closeConfirm}
        />
      </Section>
      <Section title="상태 문구">
        <StateMessage kind="loading">불러오는 중…</StateMessage>
        <StateMessage kind="notice">저장했어요.</StateMessage>
        <StateMessage kind="empty">아직 대화가 없어요.</StateMessage>
        <StateMessage kind="error">연결을 확인해 주세요.</StateMessage>
      </Section>
      <Section title="휴대폰 알림">
        {(['needs-home-screen', 'ask', 'on', 'denied'] as const).map(state => (
          <Card key={state} className="w-96 p-4">
            <PushPanel
              state={state}
              device="ios"
              enableFailed={false}
              test={state === 'on' ? { kind: 'result', result: 'sent' } : { kind: 'idle' }}
              onEnable={() => {}}
              onTest={() => {}}
              onRetry={() => {}}
            />
          </Card>
        ))}
      </Section>
      <Section title="인증 카드">
        <AuthCard>
          <div className="flex flex-wrap items-center gap-2">
            <BrandMark />
            <p className="text-base font-semibold">VADA</p>
            <p className="ml-auto text-xs text-gray-400">학생회를 위한 공간</p>
          </div>
          <div className="flex flex-col gap-3">
            <Alert tone="info">학생회 초대 링크로 들어왔어요. 로그인하면 참여할 수 있어요.</Alert>
            <p className="text-sm text-gray-500">Google 계정으로 로그인해 주세요.</p>
            <Button>Google로 로그인</Button>
          </div>
        </AuthCard>
      </Section>
      <Section title="카톡 안 로그인">
        <AuthCard>
          <div className="flex flex-wrap items-center gap-2">
            <BrandMark />
            <p className="text-base font-semibold">VADA</p>
            <p className="ml-auto text-xs text-gray-400">학생회를 위한 공간</p>
          </div>
          <KakaoBlock
            userAgent={kakaoUserAgent}
            location={{ href: 'https://vada.example/join/ABCD2345' }}
            clipboard={{ writeText: async () => {} }}
          />
        </AuthCard>
      </Section>
      <Section title="긴 글">
        <div className="flex w-60 flex-col rounded-lg border bg-white p-2">
          <NavItem active>{longName}</NavItem>
        </div>
        <div className="flex w-60 flex-wrap items-baseline gap-x-2 rounded-lg border bg-white p-2">
          <strong className="min-w-0 text-sm font-semibold wrap-anywhere">{unbroken}</strong>
          <time className="text-xs text-gray-400">오후 3:00</time>
        </div>
        <p className="w-full text-sm wrap-anywhere">{unbroken}</p>
      </Section>
      <Section title="숨김">
        <div hidden className="flex" data-check="hidden">
          이 문장이 보이면 hidden 속성이 깨진 것이다.
        </div>
        <p className="text-xs text-gray-500">위에 아무 문장도 보이지 않아야 한다.</p>
      </Section>
    </main>
  )
}
