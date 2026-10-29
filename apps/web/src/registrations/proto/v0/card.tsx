import { useState } from 'react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormReception } from '../../FormReception'
import type { BuilderProps } from '../builder-props'

// v0 인원 관리 탭 위쪽 = RegistrationTab의 FormsView에서 행사 참가자(셋째 화면 몫)를 뺀 것.
// TabToolbar·FormList는 내보내지 않는 함수라 같은 모양으로 옮겨 적었다. 양식 카드는 지금 FormReception 그대로다.
const canScan = (props: BuilderProps) =>
  props.data.forms.some(item => item.form.actions.includes('form.check_in'))

function Toolbar(props: BuilderProps) {
  const creatable = props.data.forms.length > 0 && props.data.listActions.includes('form.create')
  return (
    <div className="flex flex-wrap gap-2">
      {creatable && (
        <Button touch onClick={props.onCreate}>
          참여 설문 만들기
        </Button>
      )}
      {canScan(props) && (
        <Button variant="outline" touch onClick={props.onScan}>
          QR로 출석 확인
        </Button>
      )}
    </div>
  )
}

function Empty(props: BuilderProps) {
  return (
    <Card className="flex min-h-72 flex-col items-center justify-center gap-4 p-6">
      <h3 className="text-base font-semibold">참여 설문 없음</h3>
      {props.data.listActions.includes('form.create') && (
        <Button touch onClick={props.onCreate}>
          참여 설문 만들기
        </Button>
      )}
    </Card>
  )
}

const ignore = () => {}

function FormList(props: BuilderProps) {
  const { data } = props
  const [selected, setSelected] = useState<string | null>(null)
  const forms = data.forms.map(item => item.form)
  const form = forms.find(item => item.id === selected) ?? forms[0]
  if (!form) return <Empty {...props} />
  return (
    <>
      <FormReception
        key={form.id}
        councilId="proto"
        councilName={data.councilName}
        event={data.event}
        form={form}
        onEdit={focus => props.onEdit(form.id, focus)}
        onEditEvent={props.onEditEvent}
        onChanged={ignore}
        onForbidden={ignore}
        onLost={message => console.info('[builder] 닫힘', message)}
      />
      {forms.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">다른 양식</span>
          {forms
            .filter(item => item.id !== form.id)
            .map(item => (
              <Button
                key={item.id}
                variant="link"
                size="sm"
                touch
                className="max-w-full whitespace-normal break-keep wrap-anywhere"
                onClick={() => setSelected(item.id)}
              >
                {item.name}
              </Button>
            ))}
        </div>
      )}
    </>
  )
}

export function CardScreen(props: BuilderProps) {
  return (
    <div className="flex flex-col gap-3">
      <Toolbar {...props} />
      <FormList {...props} />
      {props.data.forms.length > 0 && (
        <StateMessage kind="notice">셋째 화면 자리: 행사 참가자</StateMessage>
      )}
    </div>
  )
}
