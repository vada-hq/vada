import { useState } from 'react'
import { ChevronRight, CircleCheck, QrCode as QrIcon } from 'lucide-react'
import type { MyRegistration } from '@vada/contracts'
import QrCode from '@/components/QrCode'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { radius, size, type } from './tokens'

const ENTRY_LINE = '행사 당일 운영진에게 보여 주세요'

// 입장 QR 판: 파란 옅은 면 위 흰 네모(QR 사방 여백 4모듈 이상, 다크 모드에도 흰 바탕) + 이름.
// 포스터(신청용) QR은 맨 QR이라, 이름표·면·신청자 이름이 붙은 이 판과 생김새가 다르다.
function QrPlate({ mine, width }: { mine: MyRegistration; width: string }) {
  if (mine.attended)
    return (
      <p className={`flex items-center gap-2 ${type.body} font-semibold text-success`}>
        <CircleCheck aria-hidden="true" className="size-6" />
        출석 확인됨
      </p>
    )
  return (
    <div className={`flex flex-col items-center gap-3 ${radius.panel} bg-primary-surface p-5`}>
      <div className={`${width} rounded-2xl bg-white p-3`} data-k="entry-qr">
        <QrCode text={mine.qrText} label="입장 QR" large />
      </div>
      <p className={`${type.label} font-semibold text-primary-strong`}>
        {mine.mine.name} · {mine.event.name}
      </p>
    </div>
  )
}

// 행사 당일: 완료 자리 자체가 입장 QR이 된다(Result 자리 = QR). 맨 위.
export function EntryQrHero({ mine }: { mine: MyRegistration }) {
  return (
    <section aria-label="입장 QR" className="flex flex-col items-center gap-2 text-center">
      <h1 className={type.title}>입장 QR</h1>
      <p className={`${type.label} text-fg-tertiary`}>{ENTRY_LINE}</p>
      <div className="mt-3 w-full">
        <QrPlate mine={mine} width={size.qrDay} />
      </div>
    </section>
  )
}

// 당일 전: 줄 하나(QR 아이콘 + '입장 QR' + 용도 한 줄 + ›). 누르면 아래에서 시트가 올라온다.
export function EntryQrRow({ mine }: { mine: MyRegistration }) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`-mx-2 flex min-h-16 cursor-pointer items-center gap-3 ${radius.control} px-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-emphasis active:bg-surface-subtle`}
      >
        <span
          className={`flex ${size.rowIcon} shrink-0 items-center justify-center rounded-full bg-primary-surface text-primary-emphasis`}
        >
          <QrIcon aria-hidden="true" className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`${type.body} font-semibold`}>입장 QR</span>
          <span className={`${type.label} text-fg-muted`}>{ENTRY_LINE}</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-fg-subtle" />
      </button>
      <SheetContent side="adaptive" title="입장 QR" closeLabel="닫기" className={radius.sheet}>
        <div className="flex flex-col items-center gap-3 px-6 pt-2 pb-8 text-center">
          <p className={`${type.label} text-fg-tertiary`}>{ENTRY_LINE}</p>
          <div className="w-full">
            <QrPlate mine={mine} width={size.qrSheet} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
