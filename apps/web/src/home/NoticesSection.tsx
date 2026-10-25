import { Megaphone } from 'lucide-react'
import type { ChatMessage } from '@vada/contracts'
import { createdDay, firstLine, SHORT_LIST } from './home-view'
import HomeRow from './HomeRow'
import HomeSection from './HomeSection'

type Props = {
  notices: ChatMessage[]
  // 공지 모아 보기로 간다.
  onOpenNotices: () => void
}

// 최근 공지: 운영진 전체방의 공지 중 7일 안의 것(요구 5). 없으면 부분을 두지 않는다.
export default function NoticesSection({ notices, onOpenNotices }: Props) {
  if (notices.length === 0) return null
  return (
    <HomeSection icon={Megaphone} title="공지" onSeeAll={onOpenNotices}>
      {notices.slice(0, SHORT_LIST).map(notice => (
        <HomeRow
          key={notice.id}
          title={firstLine(notice.body)}
          meta={[notice.senderName, createdDay(notice.sentAt)]}
          onOpen={onOpenNotices}
        />
      ))}
    </HomeSection>
  )
}
