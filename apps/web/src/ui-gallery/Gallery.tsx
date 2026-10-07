import { useState, type ReactNode } from 'react'
import { CalendarDays, Copy, Plus } from 'lucide-react'
import { AuthCard } from '@/components/AuthCard'
import { Avatar } from '@/components/Avatar'
import { BrandMark } from '@/components/BrandMark'
import { EmptyState } from '@/components/EmptyState'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { NavItem } from '@/components/ui/nav-item'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { TabButton } from '@/components/ui/tab-button'
import { Textarea } from '@/components/ui/textarea'

const longName = '2026 소프트웨어융합대학 체육대회 준비와 참가자 명단 확인 그리고 물품 구매 요청 정리를 위한 아주 긴 행사 이름'.repeat(2)
const unbroken = `https://www.coupang.com/vp/products/${'1234567890'.repeat(12)}`

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="flex flex-col gap-3 border-b py-6">
    <h2 className="text-base">{title}</h2>
    <div className="flex flex-wrap items-start gap-3">{children}</div>
  </section>
}

// 새 부품이나 변형을 더하면 여기에도 더한다(AGENTS.md "화면" 절). 와이어프레임 스크린샷과 나란히 비교하는 화면이다.
export default function Gallery() {
  const [sheetOpen, setSheetOpen] = useState(false)
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <h1 className="text-xl font-bold">VADA 부품</h1>
    <Section title="버튼">
      <Button>주 버튼</Button><Button variant="outline">테두리</Button><Button variant="secondary">보조</Button>
      <Button variant="ghost">텍스트</Button><Button variant="destructive">위험</Button><Button variant="link">링크 →</Button>
      <Button size="sm"><Plus />새 행사</Button><Button size="sm" variant="outline"><Copy />코드 복사</Button><Button disabled>비활성</Button>
      <Button variant="ghost" size="icon" aria-label="달력"><CalendarDays /></Button>
    </Section>
    <Section title="입력">
      <div className="flex w-72 flex-col gap-1.5"><Label htmlFor="g-input">행사 이름</Label><Input id="g-input" placeholder="새 행사 이름" /></div>
      <div className="flex w-72 flex-col gap-1.5"><Label htmlFor="g-code">초대 코드</Label><Input id="g-code" readOnly value="ABCD2345" className="font-mono text-xl font-bold tracking-widest" /></div>
      <div className="flex w-72 flex-col gap-1.5"><Label htmlFor="g-invalid">송장번호</Label><Input id="g-invalid" aria-invalid defaultValue="잘못된 값" /></div>
      <div className="flex w-72 flex-col gap-1.5"><Label htmlFor="g-select">상태 필터</Label><NativeSelect id="g-select"><option>전체 상태</option><option>승인</option></NativeSelect></div>
      <div className="flex w-72 flex-col gap-1.5"><Label htmlFor="g-textarea">메시지</Label><Textarea id="g-textarea" placeholder="행사 준비 이야기를 나눠 주세요" /></div>
      <div className="flex w-72 flex-col gap-1.5"><Label htmlFor="g-disabled">비활성</Label><Input id="g-disabled" disabled value="입력할 수 없음" /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-blue-600" defaultChecked />체크박스</label>
    </Section>
    <Section title="칩">
      <Badge tone="info">접수</Badge><Badge tone="success">승인</Badge><Badge tone="warning">보완 요청</Badge>
      <Badge tone="danger">반려</Badge><Badge>검토 대기</Badge>
    </Section>
    <Section title="카드·배너">
      <Card className="w-72 p-4"><p className="text-sm font-semibold">카드 제목</p><p className="text-xs text-gray-500">카드 설명</p></Card>
      <div className="flex w-full flex-col gap-2">
        <Alert tone="info">학생회 초대 링크로 들어왔어요. 로그인하면 참여할 수 있어요.</Alert>
        <Alert tone="success">참여했어요.</Alert>
        <Alert tone="warning">카카오톡 안에서는 Google 로그인이 막혀 있어요.</Alert>
        <Alert tone="danger">처리하지 못했어요.</Alert>
      </div>
    </Section>
    <Section title="메뉴·탭">
      <div className="flex w-60 flex-col gap-0.5 rounded-lg border bg-white p-2"><NavItem active>체육대회</NavItem><NavItem>축제</NavItem><NavItem disabled>비활성 행사</NavItem></div>
      <div role="tablist" aria-label="예시 탭" className="flex gap-0.5 border-b bg-white px-6">
        <TabButton aria-selected>대화</TabButton><TabButton aria-selected={false}>구매요청</TabButton>
      </div>
    </Section>
    <Section title="빈 화면·아바타·로고">
      <Card className="w-96"><EmptyState icon={CalendarDays} title="행사를 선택해 주세요" description="왼쪽에서 행사를 선택하거나 새 행사를 만들어 대화를 시작하세요." /></Card>
      <div className="flex items-center gap-2"><Avatar /><span className="text-xs font-medium text-gray-700">박해랑</span></div>
      <div className="flex items-center gap-2"><BrandMark /><span className="text-base font-semibold">VADA M1</span></div>
    </Section>
    <Section title="대화상자·옆 메뉴">
      <Dialog>
        <DialogTrigger asChild><Button variant="outline">대화상자 열기</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>새 행사</DialogTitle><DialogDescription>행사를 만들면 대화방이 함께 생겨요.</DialogDescription></DialogHeader>
          <div className="flex flex-col gap-1.5"><Label htmlFor="g-dialog-name">행사 이름</Label><Input id="g-dialog-name" placeholder="새 행사 이름" /></div>
          <DialogFooter><DialogClose asChild><Button variant="outline">취소</Button></DialogClose><Button>행사 만들기</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Button variant="outline" onClick={() => setSheetOpen(true)}>옆 메뉴 열기</Button>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent title="예시 메뉴"><div className="flex flex-col gap-0.5 px-2 pt-14"><NavItem active>체육대회</NavItem><NavItem>축제</NavItem></div></SheetContent>
      </Sheet>
    </Section>
    <Section title="상태 문구">
      <StateMessage kind="loading">불러오는 중…</StateMessage><StateMessage kind="notice">저장했어요.</StateMessage>
      <StateMessage kind="empty">아직 대화가 없어요.</StateMessage><StateMessage kind="error">연결을 확인해 주세요.</StateMessage>
    </Section>
    <Section title="인증 카드">
      <AuthCard>
        <div className="flex flex-wrap items-center gap-2"><BrandMark /><p className="text-base font-semibold">VADA M1</p><p className="ml-auto text-xs text-gray-400">학생회를 위한 공간</p></div>
        <div className="flex flex-col gap-3">
          <Alert tone="info">학생회 초대 링크로 들어왔어요. 로그인하면 참여할 수 있어요.</Alert>
          <p className="text-sm text-gray-500">Google 계정으로 로그인해 주세요.</p>
          <Button>Google로 로그인</Button>
        </div>
      </AuthCard>
    </Section>
    <Section title="긴 글">
      <div className="flex w-60 flex-col rounded-lg border bg-white p-2"><NavItem active>{longName}</NavItem></div>
      <div className="flex w-60 flex-wrap items-baseline gap-x-2 rounded-lg border bg-white p-2"><strong className="min-w-0 text-sm font-semibold wrap-anywhere">{unbroken}</strong><time className="text-xs text-gray-400">오후 3:00</time></div>
      <p className="w-full text-sm wrap-anywhere">{unbroken}</p>
    </Section>
    <Section title="숨김">
      <div hidden className="flex" data-check="hidden">이 문장이 보이면 hidden 속성이 깨진 것이다.</div>
      <p className="text-xs text-gray-500">위에 아무 문장도 보이지 않아야 한다.</p>
    </Section>
  </main>
}
