import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SidePanel, SidePanelBody, SidePanelContent, SidePanelFooter, SidePanelSection } from '@/components/ui/side-panel'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { M, MP, R, WRAP } from '../s5/S5Parts'
import { dayLabel } from './s7-view'
import type { S7Asked, S7Person } from './s7-data'

// 홈에서 여는 '시작' 행동 셋의 창 시늉(2.0). 실제 대화·요청·안건은 만들지 않는다.
// 보여 주려는 것: 창은 홈 위에 열리고, 묻기는 그 업무가 붙은 대화이며, 물은 것과 답이 그 업무에 남는다.
export type StartAction =
  | { kind: 'ask'; to: S7Person; attach: string; marker: string | null; asked: S7Asked | null }
  | { kind: 'purchase'; eventName: string }
  | { kind: 'agenda'; meeting: string; date: string }

// 빠른 만들기 버튼: 테두리 sm, 글자는 L 조합(12/500/gray-900, 밑줄 없음)
export const START_BUTTON = 'h-8 gap-1 bg-white px-3 py-1 text-xs font-medium text-gray-900 max-sm:min-h-11'

export function StartButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className={cn(START_BUTTON, 'relative z-10')} onClick={onClick}>
      {label}
    </Button>
  )
}

function Thread({ asked, to }: { asked: S7Asked; to: S7Person }) {
  return (
    <ol className="flex flex-col gap-3">
      <li className="flex flex-col gap-1">
        <span className={M}>{`나 · ${dayLabel(asked.date)}`}</span>
        <p className={cn(R, WRAP)}>{asked.question}</p>
      </li>
      {asked.answer && (
        <li className="flex flex-col gap-1">
          <span className={M}>{`${to.name} · ${dayLabel(asked.date)}`}</span>
          <p className={cn(R, WRAP)}>{asked.answer}</p>
        </li>
      )}
    </ol>
  )
}

function AskBody({ action }: { action: Extract<StartAction, { kind: 'ask' }> }) {
  return (
    <>
      <SidePanelSection title="붙은 일">
        <p className="flex flex-wrap items-baseline gap-x-2">
          {action.marker && <span className={MP}>{action.marker}</span>}
          <span className={cn(R, WRAP)}>{action.attach}</span>
        </p>
      </SidePanelSection>
      <SidePanelSection title="대화">
        {action.asked ? <Thread asked={action.asked} to={action.to} /> : <p className={M}>대화 없음</p>}
        <Field label="메시지">
          <Textarea rows={3} />
        </Field>
      </SidePanelSection>
    </>
  )
}

function titleOf(action: StartAction) {
  if (action.kind === 'ask') return `${action.to.name} (${action.to.role})에게 묻기`
  return action.kind === 'purchase' ? '구매 요청' : '안건 올리기'
}

export function StartPanel({ action, onClose }: { action: StartAction | null; onClose: () => void }) {
  return (
    <SidePanel open={action !== null} onOpenChange={open => !open && onClose()}>
      {action && (
        <SidePanelContent title={titleOf(action)}>
          <SidePanelBody>
            {action.kind === 'ask' && <AskBody action={action} />}
            {action.kind === 'purchase' && (
              <SidePanelSection title="요청">
                <Field label="행사">
                  <Input defaultValue={action.eventName} />
                </Field>
                <Field label="품목">
                  <Input />
                </Field>
              </SidePanelSection>
            )}
            {action.kind === 'agenda' && (
              <SidePanelSection title={`${action.meeting} · ${action.date}`}>
                <Field label="안건">
                  <Textarea rows={3} />
                </Field>
              </SidePanelSection>
            )}
          </SidePanelBody>
          <SidePanelFooter>
            <Button variant="outline" onClick={onClose}>
              닫기
            </Button>
            <Button onClick={onClose}>{action.kind === 'ask' ? '보내기' : action.kind === 'purchase' ? '요청 만들기' : '올리기'}</Button>
          </SidePanelFooter>
        </SidePanelContent>
      )}
    </SidePanel>
  )
}
