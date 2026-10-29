import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { headLinkTouch } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import { C1R_SHOWN } from '../c1r-data'
import type { C1rProps } from '../c1r-props'
import { Band, HEAD_ID } from './Band'
import { Row } from './Row'
import { TEXT_SUB } from './tokens'

// f3 위쪽 상태 띠(생김새 회차 c1f, c1f-refs.md '다').
// 구역 머리 자리에 둥근 흰 띠 하나: 이름 + 큰 건수 + 이유 알약(이유 + 수). 그 아래 줄은 상자 없이 바닥 위에 흐른다.
// 716·977은 줄이 두 열로 흘러 넓은 폭의 오른쪽이 비지 않는다. 0건이면 띠 한 줄만 남는다. 줄은 공용 견본 차례대로 위 5개(미배정 줄도 한 줄), 넘으면 '전체 n건 보기'.
export default function C1rF3({ data, onOpen, onAsk, onOpenAsked, onAssign, onSeeAll }: C1rProps) {
  const rows = data.rows.slice(0, C1R_SHOWN)
  return (
    <section aria-labelledby={HEAD_ID} className="flex flex-col gap-1">
      <Band rows={data.rows} total={data.total} />
      {rows.length > 0 && (
        <ul className="mt-1 grid grid-cols-1 @2xl:grid-cols-2 @2xl:gap-x-4">
          {rows.map((row, index) => (
            <Row
              key={row.id}
              row={row}
              index={index}
              onOpen={onOpen}
              onAsk={onAsk}
              onOpenAsked={onOpenAsked}
              onAssign={onAssign}
            />
          ))}
        </ul>
      )}
      {data.total > C1R_SHOWN && (
        // 줄 글 시작선(줄 pl-3.5 + 아이콘 36 + 간격 12 = 62px)에 맞춘다
        <div className="pt-1 pb-1 pl-15.5 max-sm:py-0">
          <Button
            variant="link"
            touch={false}
            className={cn(
              'h-auto gap-0.5 p-0 font-semibold text-primary-strong',
              TEXT_SUB,
              headLinkTouch,
              'max-sm:my-0',
            )}
            onClick={onSeeAll}
          >
            {`전체 ${data.total}건 보기`}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </section>
  )
}
