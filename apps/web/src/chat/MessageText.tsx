import type { ReactNode } from 'react'
import { parseCoupangLinks, type CoupangLink } from '@vada/contracts'
import { Button } from '@/components/ui/button'

// 메시지 안의 쿠팡 상품 링크를 버튼으로 그린다. 나머지 글은 그대로 둔다(서버가 후보로 기록하는 것과 같은 규칙).
export default function MessageText({ content, onOpenLink }: { content: string; onOpenLink?: (link: CoupangLink) => void }) {
  const links = onOpenLink ? parseCoupangLinks(content) : []
  if (!links.length) return <>{content}</>
  const parts: ReactNode[] = []
  let cursor = 0
  for (const [index, link] of links.entries()) {
    if (link.start > cursor) parts.push(content.slice(cursor, link.start))
    parts.push(<Button key={index} variant="link" size="sm" className="inline h-auto p-0 text-left text-sm whitespace-normal wrap-anywhere"
      onClick={() => onOpenLink!(link)}>{content.slice(link.start, link.end)}</Button>)
    cursor = link.end
  }
  if (cursor < content.length) parts.push(content.slice(cursor))
  return <>{parts}</>
}
