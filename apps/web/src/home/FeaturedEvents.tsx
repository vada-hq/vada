import { useId, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { rowLinkBox, rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'

export type FeaturedTile = {
  id: string
  name: string
  // 행사 상태 칩(행사 화면과 같은 칩)
  chip: ReactNode
  // '10월 30일 (금) · D-4', 날짜 미정이면 '미정'
  when: string
  onOpen: () => void
}

// 타일 줄은 서버가 정한 차례와 개수(주요 행사 3) 그대로다. 모르는 값은 0이 아니라 '집계 전'이다(DEC-95).
export type TilesRead =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; tiles: FeaturedTile[] }

const TITLE = '학생회 주요 행사'

// 제목 옆 수(카드 머리와 같은 규칙): 읽었으면 0도 '0개', 읽지 못했으면 '집계 전'.
const countOf = (read: TilesRead) => (read.kind === 'ready' ? `${read.tiles.length}개` : '집계 전')

// 좁은 타일에서도 이름이 온 폭을 쓰도록 상태 칩은 아래에 둔다. 긴 이름은 두 줄까지 보이고 읽는 이름은 전체다.
function Tile({ tile }: { tile: FeaturedTile }) {
  return (
    // 같은 줄 타일은 높이가 같아서 날짜를 맨 아래에 붙여 세 타일의 날짜 선을 맞춘다.
    <li
      className={cn(
        rowLinkBox,
        'flex flex-col rounded-lg border px-3 py-2 transition-colors hover:border-blue-300 hover:bg-blue-50',
      )}
    >
      <div className="flex flex-col items-start gap-1">
        <Button
          variant="link"
          className={cn(
            'h-auto w-full min-w-0 line-clamp-2 justify-start p-0 text-left text-sm font-bold break-keep whitespace-normal text-gray-900 wrap-anywhere',
            rowLinkTarget,
          )}
          onClick={tile.onOpen}
        >
          {tile.name}
        </Button>
        <span>{tile.chip}</span>
      </div>
      <p className="mt-auto pt-1 text-xs text-gray-500">{tile.when}</p>
    </li>
  )
}

// 인사 카드 오른쪽 '학생회 주요 행사' 타일 3(와이어프레임 HOME-01D·01M·01F): 행사명, 상태 칩, 날짜. 참여 여부와 관계없다.
// 본문이 좁으면 타일이 세로 줄 셋이 된다(DEC-95 휴대폰 배치).
export default function FeaturedEvents({ read }: { read: TilesRead }) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-1.5">
      <h3 className="text-xs font-normal text-gray-500">
        <span id={titleId}>{TITLE}</span>
        <span className="ml-1">{countOf(read)}</span>
      </h3>
      {read.kind === 'ready' && read.tiles.length === 0 && (
        <p className="py-2 text-sm text-gray-500">진행할 행사 없음</p>
      )}
      {read.kind === 'ready' && read.tiles.length > 0 && (
        <ul className="grid gap-2 @2xl:grid-cols-3">
          {read.tiles.map(tile => (
            <Tile key={tile.id} tile={tile} />
          ))}
        </ul>
      )}
    </section>
  )
}
