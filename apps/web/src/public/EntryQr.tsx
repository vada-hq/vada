import { useState } from 'react'
import { ChevronRight, CircleCheck, QrCode as QrIcon } from 'lucide-react'
import type { MyRegistration } from '@vada/contracts'
import QrCode from '@/components/QrCode'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { focusRing, radius, type } from './public-look'

const ENTRY_LINE = '행사 당일 운영진에게 보여 주세요'

// 입장 QR 판: 파란 옅은 면 위 흰 네모 + 신청자 이름·행사명. 포스터(신청용) QR은 맨 QR이라 생김새가 다르다(내용 ④).
// QR은 어두운 화면에서도 흰 바탕이고, matrix 안 여백 2모듈에 흰 네모 안쪽 여백(p-3)을 더해 사방 4모듈 이상 비운다(DENSO).
function QrPlate({ mine, width }: { mine: MyRegistration; width: string }) {
  if (mine.attended)
    return (
      <p
        className={`flex items-center justify-center gap-2 ${type.body} font-semibold text-success`}
      >
        <CircleCheck aria-hidden="true" className="size-6" />
        출석 확인됨
      </p>
    )
  return (
    <div
      data-plate
      className={`flex flex-col items-center gap-3 ${radius.panel} bg-primary-surface p-5`}
    >
      <div className={cn(width, 'rounded-2xl bg-white p-3')}>
        <QrCode text={mine.qrText} label="입장 QR" large />
      </div>
      <p className={`${type.label} font-semibold text-primary-strong wrap-anywhere`}>
        {mine.mine.name} · {mine.event.name}
      </p>
    </div>
  )
}

// 행사 당일: 완료 자리가 입장 QR이 된다(맨 위, 펼친 채).
export function EntryQrHero({ mine }: { mine: MyRegistration }) {
  return (
    <section aria-label="입장 QR" className="flex flex-col items-center gap-2 text-center">
      <h1 className={`${type.title} text-fg`}>입장 QR</h1>
      <p className={`${type.label} text-fg-tertiary`}>{ENTRY_LINE}</p>
      <div className="mt-3 w-full">
        <QrPlate mine={mine} width="w-62 max-w-full" />
      </div>
    </section>
  )
}

// 당일 전: 줄 하나(QR 아이콘 + '입장 QR' + 용도 한 줄 + ›). 누르면 아래에서 시트가 올라온다.
// 신청 직후 QR이 갑자기 주인공이 되면 "엥?"이라 접어 둔다(내용 ④).
export function EntryQrRow({ mine }: { mine: MyRegistration }) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        touch={false}
        onClick={() => setOpen(true)}
        className={cn(
          '-mx-2 h-auto min-h-16 justify-start gap-3 border-0 px-2 text-left font-normal whitespace-normal text-fg hover:bg-surface-subtle active:bg-surface-subtle',
          radius.control,
          focusRing,
        )}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-surface text-primary-emphasis">
          <QrIcon aria-hidden="true" className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`${type.body} font-semibold`}>입장 QR</span>
          <span className={`${type.label} text-fg-muted`}>{ENTRY_LINE}</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-fg-subtle" />
      </Button>
      <SheetContent side="adaptive" title="입장 QR" closeLabel="닫기" className="rounded-t-3xl">
        <div className="flex flex-col items-center gap-3 px-6 pt-2 pb-8 text-center">
          <p className={`${type.label} text-fg-tertiary`}>{ENTRY_LINE}</p>
          <div className="w-full">
            <QrPlate mine={mine} width="w-7/10 max-w-72" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
