import { CalendarDays, Copy, Plus } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { Section } from './GallerySection'

export function ButtonsSection() {
  return (
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
      <Button busy>보내는 중</Button>
      <Button variant="ghost" size="icon" aria-label="달력">
        <CalendarDays />
      </Button>
    </Section>
  )
}

// 필수 별표, 선택 표시, 형식 도움말, 누른 뒤의 문제(Field의 required, optional, hint, error).
function FieldExample() {
  return (
    <div className="flex w-72 flex-col gap-3">
      <Field label="행사 이름" required error="이름을 입력해 주세요">
        <Input />
      </Field>
      <Field label="장소" optional>
        <Input />
      </Field>
      <Field label="학번" required hint="줄바꿈이나 쉼표로 구분">
        <Input />
      </Field>
      <div className="flex flex-wrap justify-end gap-2">
        <Button>만들기</Button>
      </div>
    </div>
  )
}

export function InputsSection() {
  return (
    <Section title="입력">
      <FieldExample />
      <div className="flex w-72 flex-col gap-1.5">
        <Label htmlFor="g-input">행사 이름</Label>
        <Input id="g-input" />
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
        <Textarea id="g-textarea" />
      </div>
      <div className="flex w-72 flex-col gap-1.5">
        <Label htmlFor="g-disabled">비활성</Label>
        <Input id="g-disabled" disabled value="입력할 수 없음" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-primary-emphasis" defaultChecked />
        체크박스
      </label>
    </Section>
  )
}

export function ChipsSection() {
  return (
    <Section title="칩">
      <Badge tone="info">접수</Badge>
      <Badge tone="success">승인</Badge>
      <Badge tone="warning">보완 요청</Badge>
      <Badge tone="danger">반려</Badge>
      <Badge>검토 대기</Badge>
      <Badge tone="count">99+</Badge>
    </Section>
  )
}

export function CardsSection() {
  return (
    <Section title="카드·배너">
      <Card className="w-72 p-4">
        <p className="text-sm font-semibold">카드 제목</p>
        <p className="text-xs text-fg-muted">카드 설명</p>
      </Card>
      <div className="flex w-full flex-col gap-2">
        <Alert tone="info">학생회 초대 링크로 들어왔어요. 로그인하면 참여할 수 있어요.</Alert>
        <Alert tone="success">참여했어요.</Alert>
        <Alert tone="warning">카카오톡 안에서는 Google 로그인이 막혀 있어요.</Alert>
        <Alert tone="danger">처리하지 못했어요.</Alert>
      </div>
    </Section>
  )
}
