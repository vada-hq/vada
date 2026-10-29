import { useEffect, useState } from 'react'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { REGISTRATION_FORM_LOST, REGISTRATION_LOAD_FAILED } from '@/lib/registration-messages'
import ApplyFields from './ApplyFields'
import FormSummary from './FormSummary'
import { mineHref } from './public-path'
import RegistrationUnavailable from './RegistrationUnavailable'
import { savedToken, saveToken } from './saved-links'
import { EMPTY_VALUES, parseApply, useApply, type ApplyValues } from './useApply'
import { usePublicForm } from './usePublicForm'

// 같은 기기가 이미 신청했으면 내 신청으로 가는 길을 보인다. 신청 칸은 그대로 둔다(친구 기기, 이미 취소한 신청).
function AlreadyApplied({ token }: { token: string }) {
  return (
    <Alert tone="info" className="mb-6 flex flex-wrap items-center justify-between gap-2">
      <span>이미 신청했어요.</span>
      <a
        href={mineHref(token)}
        className={buttonVariants({ variant: 'outline', size: 'sm', touch: true })}
      >
        내 신청 보기
      </a>
    </Alert>
  )
}

type Props = { code: string; onApplied: (token: string) => void }

// 로그인 없이 여는 신청 화면(/apply/코드). 받는 중일 때만 칸이 있다.
export default function ApplyPage({ code, onApplied }: Props) {
  const { state, lost, unavailable, reload } = usePublicForm(code)
  const [values, setValues] = useState<ApplyValues>(EMPTY_VALUES)
  const [gone, setGone] = useState(false)
  const apply = useApply({
    code,
    reload,
    onLost: () => setGone(true),
    onApplied: token => {
      saveToken(code, token)
      onApplied(token)
    },
  })
  const status = state.kind === 'ready' ? state.data.status : null
  const { clearProblem } = apply
  useEffect(() => {
    if (status !== null && status !== 'open') clearProblem()
  }, [status, clearProblem])
  if (lost || gone) return <StateMessage kind="error">{REGISTRATION_FORM_LOST}</StateMessage>
  if (unavailable) return <Alert tone="warning">지금은 신청을 받지 않아요.</Alert>
  if (state.kind === 'loading') return <StateMessage kind="loading">불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return <StateMessage kind="error">{REGISTRATION_LOAD_FAILED}</StateMessage>
  const data = state.data
  const saved = savedToken(code)
  return (
    <div className="flex flex-1 flex-col">
      {saved && <AlreadyApplied token={saved} />}
      <FormSummary data={data} />
      {data.status !== 'open' ? (
        <RegistrationUnavailable data={data} />
      ) : (
        <ApplyFields
          data={data}
          values={values}
          busy={apply.busy}
          problem={apply.problem}
          onValues={next => {
            clearProblem()
            setValues(next)
          }}
          onSubmit={() => {
            const parsed = parseApply(data, values)
            if (parsed.success) void apply.submit(parsed.data)
          }}
        />
      )}
    </div>
  )
}
