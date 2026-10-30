import type { MeetingAgendaItem } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { isMinutesDirty, type MinutesDraft } from './minutes-drafts'
import { useMinutesScope } from './minutes-scope'
import { MINUTES_TEXT as T, minutesConflict, minutesUpdated } from './minutes-text'

export function MinutesNotes({ text }: { text: string | null }) {
  return (
    <div className="wrap-anywhere text-sm leading-7 whitespace-pre-wrap">
      {text ? (
        text
          .split('\n')
          .map((line, index) => <p key={index}>{line.trim() ? `• ${line}` : '\u00a0'}</p>)
      ) : (
        <p className="text-muted-foreground">{T.emptyDiscussion}</p>
      )}
    </div>
  )
}
type Props = {
  item: MeetingAgendaItem
  draft: MinutesDraft | undefined
  writable: boolean
  onChange: (text: string) => void
  onRetry: () => void
  onOverwrite: () => void
  onAdopt: () => void
}
function statusText(draft: MinutesDraft | undefined, server: MeetingAgendaItem) {
  if (draft) {
    if (draft.saving) return T.saving
    if (draft.conflict) return T.unsaved
    if (draft.error || draft.refreshing) return T.failed
    if (!draft.conflict && draft.text !== draft.savedText) return T.pending
  }
  return minutesUpdated(server.updatedAt, server.updatedBy?.name)
}
function DiscussionInput({ item, draft, onChange }: Pick<Props, 'item' | 'draft' | 'onChange'>) {
  return (
    <Field label={T.discussion} error={draft?.error ?? undefined}>
      <Textarea
        rows={8}
        className="min-h-48 wrap-anywhere"
        value={draft?.text ?? item.notes ?? ''}
        onChange={e => onChange(e.target.value)}
      />
    </Field>
  )
}
function ConflictInput({
  draft,
  onChange,
  onOverwrite,
  onAdopt,
}: Pick<Props, 'draft' | 'onChange' | 'onOverwrite' | 'onAdopt'>) {
  if (!draft?.conflict) return null
  return (
    <>
      <Field label={T.mine}>
        <Textarea
          rows={8}
          className="min-h-48 wrap-anywhere"
          value={draft.text}
          onChange={e => onChange(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button touch onClick={onOverwrite}>
          {T.overwrite}
        </Button>
        <Button touch variant="outline" onClick={onAdopt}>
          {T.adopt}
        </Button>
      </div>
    </>
  )
}
function SaveStatus({
  draft,
  server,
  writable,
  onRetry,
}: Pick<Props, 'draft' | 'writable' | 'onRetry'> & { server: MeetingAgendaItem }) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground tabular-nums"
    >
      {statusText(draft, server)}
      {writable && draft?.error && (
        <Button touch size="sm" variant="outline" onClick={onRetry}>
          {T.retry}
        </Button>
      )}
    </div>
  )
}
export function ReadOnlyDraft({ draft, writable }: Pick<Props, 'draft' | 'writable'>) {
  if (writable || !draft || !isMinutesDirty(draft)) return null
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label={T.mine}>
      <h3 className="text-sm font-semibold">{T.mine}</h3>
      <MinutesNotes text={draft.text} />
      {draft.error && <StateMessage kind="error">{draft.error}</StateMessage>}
    </section>
  )
}
// updatedBy는 마지막 한 사람이다. 상대 글 위에 내가 제목을 고쳤으면 내 이름이 오므로 상대로 부르지 않는다.
function ConflictNotice({ conflict }: { conflict: MeetingAgendaItem }) {
  const me = useMinutesScope()?.memberId
  const author = conflict.updatedBy
  return (
    <Alert tone="warning" role="status" className="text-sm">
      {minutesConflict(author?.id === me ? undefined : author?.name)}
    </Alert>
  )
}
export function MinutesDiscussion({
  item,
  draft,
  writable,
  onChange,
  onRetry,
  onOverwrite,
  onAdopt,
}: Props) {
  const conflict = draft?.conflict
  const server = conflict ?? draft?.server ?? item
  return (
    <section className="flex min-w-0 flex-col gap-3 border-t pt-5">
      {conflict && <ConflictNotice conflict={conflict} />}
      {writable && !conflict ? (
        <DiscussionInput item={item} draft={draft} onChange={onChange} />
      ) : (
        <>
          <h3 className="text-sm font-semibold">{T.discussion}</h3>
          <MinutesNotes text={server.notes} />
        </>
      )}
      {writable && (
        <ConflictInput
          draft={draft}
          onChange={onChange}
          onOverwrite={onOverwrite}
          onAdopt={onAdopt}
        />
      )}
      <ReadOnlyDraft draft={draft} writable={writable} />
      <SaveStatus draft={draft} server={server} writable={writable} onRetry={onRetry} />
    </section>
  )
}
