import type { ReactNode } from 'react'
import {
  PURCHASE_RECENT_LIMIT,
  type PurchaseArea,
  type PurchaseBoard,
  type PurchaseRequestSummary,
} from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { TabButton } from '@/components/ui/tab-button'
import type { PurchaseList } from '@/finance/usePurchases'
import { PURCHASES_LOAD_FAILED } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { cardsOf } from './purchase-board'
import { PurchaseItemBoard } from './PurchaseItemBoard'
import { PurchaseProcessBoard } from './PurchaseProcessBoard'
import { PurchaseRequestTable } from './PurchaseRequestTable'

export type WorkView = 'all' | 'mine'
type Props = {
  list: PurchaseList
  board: PurchaseBoard
  area: PurchaseArea
  view: WorkView
  onBoard: (board: PurchaseBoard) => void
  onArea: (area: PurchaseArea) => void
  onView: (view: WorkView) => void
  showEvent: boolean
  onOpen: (requestId: string) => void
}

// 구매 메뉴와 행사 구매 탭이 같이 쓰는 작업 구역: 보드 탭(품목 현황·처리 단계·구매 요청 기록)과 그 본문.
// 보드는 모두에게 열려 있다(읽기는 권한으로 가리지 않는다). 처리 버튼이 생기면 그 버튼만 권한으로 가른다.
export function PurchaseWork(props: Props) {
  const { list } = props
  const requests = list.state.kind === 'ready' ? list.state.requests : []
  const cards = cardsOf(requests)
  return (
    <section aria-label="구매 작업" className="flex flex-col gap-4">
      <BoardTabs {...props} itemCount={cards.length} requestCount={requests.length} />
      {props.board === 'items' && <ViewToggle view={props.view} onView={props.onView} />}
      <Body {...props} requests={requests} />
    </section>
  )
}

function BoardTabs({
  board,
  onBoard,
  itemCount,
  requestCount,
}: Props & { itemCount: number; requestCount: number }) {
  const tab = (value: PurchaseBoard, label: string, count?: number) => (
    <TabButton aria-selected={board === value} onClick={() => onBoard(value)}>
      {label}
      {count !== undefined && (
        <span className="ml-1.5 rounded-full bg-surface-muted px-1.5 text-xs text-fg-muted tabular-nums">
          {count}
        </span>
      )}
    </TabButton>
  )
  return (
    <div className="flex items-end justify-between gap-4 border-b">
      <div role="tablist" aria-label="구매 보드" className="flex items-end gap-4">
        <TabGroup label="작업 보드">
          {tab('items', '품목 현황')}
          {tab('process', '처리 단계')}
        </TabGroup>
        <span aria-hidden className="mb-2 h-8 w-px bg-border-default" />
        <TabGroup label="기록">{tab('records', '구매 요청', requestCount)}</TabGroup>
      </div>
      {board === 'items' && (
        <span className="mb-2 rounded-full border border-primary-border bg-primary-surface px-2.5 py-0.5 text-xs font-semibold text-primary-strong tabular-nums">
          품목 {itemCount}건
        </span>
      )}
    </div>
  )
}

function TabGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="px-4 text-xs text-fg-faint">{label}</span>
      <div className="flex">{children}</div>
    </div>
  )
}

function ViewToggle({ view, onView }: { view: WorkView; onView: (view: WorkView) => void }) {
  return (
    <div
      role="group"
      aria-label="요청 범위"
      className="flex self-start rounded-md bg-surface-muted p-0.5"
    >
      {(['all', 'mine'] as const).map(value => (
        <Button
          key={value}
          size="sm"
          variant={view === value ? 'outline' : 'ghost'}
          aria-pressed={view === value}
          className={cn(view === value && 'border-transparent text-primary-strong shadow-sm')}
          onClick={() => onView(value)}
        >
          {value === 'all' ? '전체 요청' : '내 요청'}
        </Button>
      ))}
    </div>
  )
}

function Body(props: Props & { requests: PurchaseRequestSummary[] }) {
  const { list, board, requests } = props
  if (list.state.kind === 'loading')
    return <StateMessage kind="loading">구매 요청 불러오는 중…</StateMessage>
  if (list.state.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="error">{PURCHASES_LOAD_FAILED}</StateMessage>
        <Button touch variant="outline" onClick={() => void list.reload()}>
          다시 시도
        </Button>
      </div>
    )
  const cards = cardsOf(requests)
  return (
    <>
      {board === 'items' && (
        <PurchaseItemBoard cards={cards} showEvent={props.showEvent} onOpen={props.onOpen} />
      )}
      {board === 'process' && (
        <PurchaseProcessBoard
          cards={cards}
          area={props.area}
          onArea={props.onArea}
          onOpen={props.onOpen}
        />
      )}
      {board === 'records' &&
        (requests.length === 0 ? (
          <StateMessage kind="empty">구매 요청 없음</StateMessage>
        ) : (
          <PurchaseRequestTable requests={requests} variant="records" onOpen={props.onOpen} />
        ))}
      {list.state.truncated && (
        <StateMessage kind="notice">
          요청이 많아서 최근 {PURCHASE_RECENT_LIMIT}개만 보여요.
        </StateMessage>
      )}
    </>
  )
}
