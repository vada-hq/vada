import { Alert } from '@/components/ui/alert'
import { MINUTES_TEXT as T } from './minutes-text'

// 저장할 곳이 없어진 글도 사람이 옮겨 쓸 수 있게 남긴다.
export function OrphanDrafts({ texts, label = T.orphan }: { texts: string[]; label?: string }) {
  return texts.map((text, index) => (
    <Alert key={index} tone="warning" role="status" className="flex min-w-0 flex-col gap-2 text-sm">
      <p className="font-medium">{label}</p>
      <p className="wrap-anywhere whitespace-pre-wrap text-fg-body">{text}</p>
    </Alert>
  ))
}
