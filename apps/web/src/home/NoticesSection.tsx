import { Megaphone } from 'lucide-react'
import type { ChatMessage } from '@vada/contracts'
import { createdDay, firstLine, SHORT_LIST } from './home-view'
import HomeRow from './HomeRow'
import HomeSection from './HomeSection'

type Props = {
  notices: ChatMessage[]
  // 대화 화면으로 간다.
  onOpenChat: () => void
}

// 최근 공지: 운영진 전체방의 공지 중 7일 안의 것(요구 5). 없으면 부분을 두지 않는다.
export default function NoticesSection({ notices, onOpenChat }: Props) {
  if (notices.length === 0) return null
  return (
    <HomeSection icon={Megaphone} title="공지" onSeeAll={onOpenChat}>
      {notices.slice(0, SHORT_LIST).map(notice => (
        <HomeRow
          key={notice.id}
          title={firstLine(notice.body)}
          meta={[notice.senderName, createdDay(notice.sentAt)]}
          onOpen={onOpenChat}
        />
      ))}
    </HomeSection>
  )
}
