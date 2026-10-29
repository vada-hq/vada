import { ChevronLeft, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { MainButton, PageIcon, TextAction, invalid } from './DocParts'
import { fieldSurface, size, type } from './doc-look'

// 편집기 맨 위 붙는 머리줄과 문서 제목(양식 이름).

// '필수 N칸 남음'(누르면 첫 빈 필수 칸으로). 머리줄이 스크롤해도 붙어 있어 긴 문서 어디서든 남은 일이 보인다. 0이면 숨긴다.
function Remaining({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null
  return (
    <TextAction
      className={`${type.small} pointer-coarse:px-2.5`}
      onClick={() => document.getElementById(ids[0]!)?.focus()}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-danger-emphasis" />
      <span className="max-sm:sr-only">필수</span> {ids.length}칸 남음
    </TextAction>
  )
}

export function EditorHeader({
  title,
  submit,
  formId,
  backLabel,
  busy,
  missing,
  onBack,
  onPreview,
}: {
  title: string
  submit: string
  formId: string
  backLabel: string
  busy: boolean
  // 비어 있는 필수 칸의 id(화면 차례)
  missing: string[]
  onBack: () => void
  // 좁은 화면의 [미리보기](행사를 읽기 전이면 없다)
  onPreview: (() => void) | null
}) {
  return (
    <header className="sticky top-0 z-20 -mx-4 flex items-center gap-1 border-b border-border-subtle bg-white px-2 py-2 sm:-mx-8 sm:rounded-t-group sm:px-4">
      <TextAction icon={ChevronLeft} aria-label={backLabel} busy={busy} onClick={onBack}>
        <span className="max-sm:sr-only">{backLabel}</span>
      </TextAction>
      <span aria-hidden="true" className="text-fg-faint max-sm:hidden">
        /
      </span>
      <h2
        className={`mr-auto min-w-0 truncate px-1 ${type.body} font-semibold text-fg max-sm:sr-only`}
      >
        {title}
      </h2>
      <span aria-hidden="true" className="mr-auto sm:hidden" />
      <Remaining ids={missing} />
      {onPreview && (
        <Button
          type="button"
          variant="secondary"
          onClick={onPreview}
          className={`${size.hit} rounded-full bg-surface-muted px-3 py-0 ${type.body} text-fg-secondary hover:bg-muted-strong @4xl:hidden pointer-coarse:px-4`}
        >
          <Eye aria-hidden />
          미리보기
        </Button>
      )}
      <MainButton type="submit" form={formId} busy={busy}>
        {submit}
      </MainButton>
    </header>
  )
}

// 문서 제목 = 양식 이름을 그 자리에서 쓴다. 쉴 때 바탕 없이 큰 글자만(올림 면·초점 고리). 비면 회색 '양식 이름'(입력칸 밖 글).
export function EditorTitle({
  id,
  value,
  error,
  onChange,
}: {
  id: string
  value: string
  error: string | undefined
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-4">
        <PageIcon large />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className={`pl-3 ${type.small} text-fg-muted`}>
            <label htmlFor={id}>양식 이름</label>
            <span aria-hidden="true" className="ml-0.5 text-danger-emphasis">
              *
            </span>
          </div>
          <div className="relative flex min-w-0">
            <Input
              id={id}
              value={value}
              aria-required
              {...invalid(id, error)}
              onChange={event => onChange(event.target.value)}
              className={cn(
                `peer w-auto max-w-full field-sizing-content px-3 py-0.5 pointer-coarse:min-h-11 ${type.docTitle} sm:text-3xl text-fg ${fieldSurface}`,
                value ? 'min-w-40' : 'min-w-56',
              )}
            />
            {!value && (
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-y-0 left-3 flex items-center ${type.docTitle} text-fg-tertiary peer-focus:hidden`}
              >
                양식 이름
              </span>
            )}
          </div>
        </div>
      </div>
      {error && (
        <p id={`${id}-error`} className={`${type.small} font-medium text-danger`}>
          {error}
        </p>
      )}
    </div>
  )
}
