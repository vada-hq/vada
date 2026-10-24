import { useEffect } from 'react'
import { useNow } from '@/lib/use-now'
import { ArrowLeft } from 'lucide-react'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { NOTICES_LOAD_FAILED } from '@/lib/messages'
import { dateLabel } from './chat-view'
import { markNoticesSeen } from './notice-seen'
import { useNotices } from './useNotices'
import type { ChatMessage } from '@vada/contracts'

function NoticeList({ notices }: { notices: ChatMessage[] }) {
  const now = useNow()
  if (notices.length === 0) return <StateMessage kind="empty">아직 공지가 없어요.</StateMessage>
  return (
    <ul className="flex flex-col divide-y">
      {notices.map(notice => (
        <li key={notice.id} className="px-1 py-3">
          <p className="text-xs text-gray-400">
            <span className="font-medium text-gray-700">{notice.senderName ?? '시스템'}</span>{' '}
            {dateLabel(notice.sentAt, now)}
          </p>
          <p className="mt-1 text-sm/6 wrap-anywhere whitespace-pre-wrap text-gray-900">
            {notice.body}
          </p>
        </li>
      ))}
    </ul>
  )
}

// 공지 모아 보기: 같은 기수의 공지를 최근 것부터. 들어오기 전 공지도 보인다.
export default function NoticePage({
  councilId,
  onBack,
  onForbidden,
}: {
  councilId: string
  onBack: () => void
  onForbidden: () => void
}) {
  const { state, retry } = useNotices(councilId, onForbidden)
  const shown = state.kind === 'ready' ? state.notices : null
  useEffect(() => {
    if (shown) markNoticesSeen(councilId, shown)
  }, [councilId, shown])
  return (
    <PageColumn className="gap-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="대화방 목록" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <h2 className="text-base font-semibold text-gray-900">공지 모아 보기</h2>
      </div>
      {state.kind === 'loading' && <StateMessage kind="loading">공지 불러오는 중…</StateMessage>}
      {state.kind === 'failed' && (
        <>
          <StateMessage kind="error">{NOTICES_LOAD_FAILED}</StateMessage>
          <Button variant="outline" className="self-start" onClick={retry}>
            다시 시도
          </Button>
        </>
      )}
      {shown && <NoticeList notices={shown} />}
    </PageColumn>
  )
}
