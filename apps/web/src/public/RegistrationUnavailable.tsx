import { CircleAlert } from 'lucide-react'
import type { PublicRegistrationForm } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { closedLine, STATUS_LABEL } from './registration-text'

export default function RegistrationUnavailable({ data }: { data: PublicRegistrationForm }) {
  if (data.status === 'open') return null
  const title = STATUS_LABEL[data.status]
  const tone = data.status === 'full' ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-600'
  return (
    <section
      aria-label={title}
      className={`${cardClass} flex flex-col items-center gap-3 p-6 text-center break-keep wrap-anywhere ${tone}`}
    >
      <CircleAlert aria-hidden="true" className="size-9" />
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{closedLine(data)}</p>
      </div>
      <Button variant="outline" touch onClick={() => window.history.back()}>
        돌아가기
      </Button>
    </section>
  )
}
