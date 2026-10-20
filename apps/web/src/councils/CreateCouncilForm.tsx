import type { MyCouncil } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import CouncilFields from './CouncilFields'
import { endsBeforeStart, TERM_ORDER_MESSAGE } from './term'
import { useCreateCouncil } from './useCreateCouncil'

type Props = { onCreated: (council: MyCouncil) => void; onCancel: () => void }

// 학생회 만들기(바탕 spec G6): 이름, 단위, 학교, 첫 기수의 이름과 임기.
export default function CreateCouncilForm({ onCreated, onCancel }: Props) {
  const { form, set, saving, error, valid, submit } = useCreateCouncil(onCreated)
  return (
    <form
      aria-label="학생회 만들기"
      className="flex flex-col gap-4"
      onSubmit={event => {
        void submit(event)
      }}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">학생회 만들기</h2>
        <p className="text-sm text-gray-500">만든 사람이 회장이 되고, 재정부가 함께 생겨요.</p>
      </div>
      <CouncilFields form={form} set={set} />
      {endsBeforeStart(form) && <StateMessage kind="error">{TERM_ORDER_MESSAGE}</StateMessage>}
      {error && <StateMessage kind="error">{error}</StateMessage>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" className="flex-1" disabled={!valid || saving}>
          {saving ? '만드는 중…' : '학생회 만들기'}
        </Button>
      </div>
    </form>
  )
}
