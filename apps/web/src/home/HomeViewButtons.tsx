import { Button } from '@/components/ui/button'

// 실제 주소 전환과 갤러리 견본이 같은 버튼 표시를 쓴다.
export default function HomeViewButtons({
  finance,
  onChange,
}: {
  finance: boolean
  onChange: (finance: boolean) => void
}) {
  return (
    <div aria-label="홈 보기" className="mb-3 flex gap-2">
      <Button
        variant={finance ? 'outline' : 'secondary'}
        size="sm"
        className="max-sm:min-h-11"
        aria-pressed={!finance}
        onClick={() => onChange(false)}
      >
        운영 보기
      </Button>
      <Button
        variant={finance ? 'secondary' : 'outline'}
        size="sm"
        className="max-sm:min-h-11"
        aria-pressed={finance}
        onClick={() => onChange(true)}
      >
        재정 보기
      </Button>
    </div>
  )
}
