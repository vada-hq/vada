import type { ReactNode } from 'react'
import { CircleCheck, Clock } from 'lucide-react'
import { qrMatrix, qrPath } from '@/lib/qr-code'
import type { FormDeposit, FormSample } from '../form-data'
import { CLS, QR_PX } from './tokens'

// 영수증이 된 종이의 부품: 완료 패널(r03), 점선 키-값 줄(r04), 절취 점선, 도장 칸 QR.

// 맨 위 채운 면 완료 패널. 제목과 핵심 값만 둔다(GOV.UK panel: 패널 안에 링크·버튼 없음).
export function DonePanel({ data }: { data: FormSample }) {
  return (
    <section
      data-k="done-title"
      className={`${CLS.pad} bg-success pt-6 pb-6 text-white sm:pt-8`}
      aria-label="신청 완료"
    >
      <p className="text-xs font-medium text-white">{data.text.council}</p>
      <h1 className="mt-1.5 flex items-center gap-2 text-xl leading-7 font-bold text-white">
        <CircleCheck aria-hidden className="size-6 shrink-0" />
        신청 완료
      </h1>
      <p className="mt-2 text-base font-semibold break-keep text-white wrap-anywhere">
        {data.text.event}
      </p>
      <p className="mt-0.5 text-sm text-white">신청자 {data.mine.mine.name}</p>
    </section>
  )
}

// 운영진 완료 안내(있을 때만): 패널 바로 아래 인용 한 덩어리
export function DoneNotice({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <section className={`${CLS.pad} pt-5`} aria-label="운영진 안내">
      <p className="border-l-2 border-success-border pl-3 text-sm leading-6 whitespace-pre-wrap text-fg-body">
        {text}
      </p>
    </section>
  )
}

// 영수증 줄 하나: 왼쪽 이름표, 오른쪽 값. end는 줄 끝 글자 버튼(복사).
export function KeyRow(props: { label: string; children: ReactNode; end?: ReactNode }) {
  return (
    <div className="flex min-h-13 items-start gap-3 py-3">
      <dt className="w-14 shrink-0 pt-0.5 text-sm leading-5 text-fg-muted">{props.label}</dt>
      <dd className="min-w-0 flex-1 text-right text-sm break-keep text-fg-body wrap-anywhere">
        {props.children}
      </dd>
      {props.end && <div className="-my-2.5 shrink-0">{props.end}</div>}
    </div>
  )
}

// 입금 상태: 금액 아래 작은 글자 + 아이콘(색만으로 말하지 않기). 미납은 사실이라 주황 글자로 둔다.
export function DepositMark({ deposit }: { deposit: FormDeposit }) {
  if (!deposit) return null
  const done = deposit === '입금 확인됨'
  const Icon = done ? CircleCheck : Clock
  return (
    <span
      className={`mt-0.5 flex items-center justify-end gap-1 text-sm font-medium ${done ? 'text-success' : 'text-pending'}`}
    >
      <Icon aria-hidden className="size-4" />
      {deposit}
    </span>
  )
}

export function Perforation() {
  return <div aria-hidden className={`${CLS.perforation} mx-5 sm:mx-8`} />
}

// 도장 칸: 2px 진한 사각 테두리 윗변에 '입장 QR' 이름표가 걸치고, 아래 한 줄 용도. 포스터(신청용) QR과 생김새·이름이 다르다.
// QR은 흰 바탕 + 둘레 16px(+ matrix 안 2모듈)로 4모듈 이상 비운다(DENSO). 어두운 설정에서도 흰 바탕 고정.
export function StampQr({ data }: { data: FormSample }) {
  const big = data.eventDay
  const matrix = qrMatrix(data.mine.qrText)
  const px = big ? QR_PX.day : QR_PX.normal
  return (
    <section
      aria-label="입장 QR"
      className={`${CLS.pad} flex flex-col items-center ${big ? 'pt-8 pb-6' : 'pt-9 pb-7'}`}
    >
      <div className={`${CLS.stamp} p-4 pt-5`}>
        <span className={CLS.stampTab}>입장 QR</span>
        {data.mine.attended ? (
          <p
            className="flex items-center justify-center gap-2 text-base font-semibold text-success"
            style={{ width: px, height: px }}
          >
            <CircleCheck aria-hidden className="size-5" />
            출석 확인됨
          </p>
        ) : (
          <svg
            data-k="entry-qr"
            role="img"
            aria-label="입장 QR"
            viewBox={`0 0 ${matrix.length} ${matrix.length}`}
            shapeRendering="crispEdges"
            className="block max-w-full bg-white"
            style={{ width: px, height: px }}
          >
            <path d={qrPath(matrix)} className="fill-black" />
          </svg>
        )}
      </div>
      <p className="mt-3 text-sm break-keep text-fg-secondary">행사 당일 운영진에게 보여 주세요</p>
    </section>
  )
}
