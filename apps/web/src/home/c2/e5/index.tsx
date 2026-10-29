import { ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { headLinkTouch } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import { C2_EMPTY, C2_SHOWN, C2_TITLE } from '../c2-data'
import type { C2Props } from '../c2-props'
import { EventRow } from './EventRow'
import { CARD, EMPTY, HEAD, LIST, TEXT_HEAD, TEXT_SUB } from './tokens'

// e5: 줄 끝 상태 신호 목록(레퍼런스 e16·e17·e18).
// 흰 판 하나 + 줄 사이 선. 줄 = 이름 / 'D-3 신청 마감'(왼쪽 두 층) | 신호 알약(오른쪽 끝에서 왼쪽으로) | 다음 일정 날짜.
// ①(회색 쟁반 위 흰 묶음, 줄 앞 아이콘 원, 사람 얼굴)과 글자 단계·반경은 같고, 면·나누는 법·줄 앞뒤 생김새가 다르다.

const HEAD_ID = 'c2-e5-head'

function Empty({ canCreate, onCreate }: Pick<C2Props, 'onCreate'> & { canCreate: boolean }) {
  return (
    <section
      aria-labelledby={HEAD_ID}
      className={cn('flex flex-wrap items-center justify-between', CARD, EMPTY)}
    >
      <div className="flex min-w-0 items-baseline gap-3">
        <h2 id={HEAD_ID} className={cn('text-fg', TEXT_HEAD)}>
          {C2_TITLE}
        </h2>
        <p className={cn('text-fg-tertiary', TEXT_SUB)}>{C2_EMPTY}</p>
      </div>
      {canCreate && (
        <Button variant="secondary" className="rounded-full" onClick={onCreate}>
          <Plus aria-hidden />새 행사
        </Button>
      )}
    </section>
  )
}

export default function C2E5(props: C2Props) {
  const { data, onSeeAll, onCreate } = props
  if (data.total === 0) return <Empty canCreate={data.canCreate} onCreate={onCreate} />
  const shown = data.events.slice(0, C2_SHOWN)
  return (
    <section aria-labelledby={HEAD_ID} className={CARD}>
      <div className={cn('flex items-center justify-between', HEAD)}>
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 id={HEAD_ID} className={cn('text-fg', TEXT_HEAD)}>
            {C2_TITLE}
          </h2>
          <span className={cn('text-fg-tertiary', TEXT_HEAD)}>{data.total}</span>
        </div>
        {data.total > C2_SHOWN && (
          <Button
            variant="link"
            className={cn(
              'h-auto gap-0.5 border-0 px-2 py-1 font-medium text-fg-secondary hover:text-fg hover:no-underline [&_svg]:size-4.5',
              headLinkTouch,
              TEXT_SUB,
            )}
            onClick={onSeeAll}
          >
            {`전체 ${data.total}개 보기`}
            <ChevronRight aria-hidden />
          </Button>
        )}
      </div>
      <ul className={LIST}>
        {shown.map(event => (
          <EventRow key={event.id} event={event} props={props} />
        ))}
      </ul>
    </section>
  )
}
