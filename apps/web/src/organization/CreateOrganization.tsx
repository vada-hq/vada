import { useRef, useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { CreateOrganizationSchema, LEADERSHIP_DEFAULT_NAME, type CreateOrganizationRequest, type CreateOrganizationResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Row = { key: number; name: string; handlesFinance: boolean }
// 확인한 학생회 세 곳에 공통으로 많았던 부서. 돈을 맡는 총무부만 구매를 승인한다.
const defaults: Row[] = [
  { key: 0, name: '총무부', handlesFinance: true }, { key: 1, name: '기획부', handlesFinance: false },
  { key: 2, name: '홍보부', handlesFinance: false }, { key: 3, name: '복지부', handlesFinance: false },
]

// 와이어프레임 ORG-01·02를 한 화면으로 줄였다. 학교·유형·연도는 M1에서 쓰지 않아 받지 않는다.
export default function CreateOrganization({ onCreated, onCancel }: { onCreated: (organizationId: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [rows, setRows] = useState(defaults)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const nextKey = useRef(defaults.length)
  // 빈 줄은 보내지 않는다. 버튼 활성화는 서버와 같은 스키마로 판단한다.
  const departments = rows.filter(row => row.name.trim()).map(({ name: department, handlesFinance }) => ({ name: department, handlesFinance }))
  const parsed = CreateOrganizationSchema.safeParse({ name, departments })
  const names = departments.map(department => department.name.trim())
  const duplicate = new Set(names).size !== names.length || names.includes(LEADERSHIP_DEFAULT_NAME)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!parsed.success || saving) return
    setSaving(true)
    setFailed(false)
    try {
      const body: CreateOrganizationRequest = parsed.data
      const response = await fetch('/api/organizations/create', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (response.status !== 201) throw new Error('Create failed')
      const result = await response.json() as CreateOrganizationResponse
      if (!result.membership?.organization?.id) throw new Error('Invalid response')
      onCreated(result.membership.organization.id)
    } catch {
      setFailed(true)
      setSaving(false)
    }
  }

  return <form aria-label="새 학생회 만들기" className="flex flex-col gap-5" onSubmit={event => { void submit(event) }}>
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">새 학생회 만들기</h2>
      <Alert tone="info">학생회가 이미 VADA를 쓰고 있다면 초대 링크로 참여하세요.</Alert>
    </div>
    <Label className="flex flex-col gap-2">학생회 이름
      <Input value={name} placeholder="예: 제12대 소프트웨어융합대학 학생회" onChange={event => setName(event.target.value)} />
    </Label>
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-gray-700">부서</legend>
      <p className="flex items-center gap-2 rounded-sm bg-gray-50 px-3 py-2 text-sm text-gray-700">회장단<span className="text-xs text-gray-400">항상 있어요</span></p>
      {rows.map((row, index) => <div key={row.key} className="flex items-center gap-2">
        <Input aria-label={`부서 ${index + 1} 이름`} value={row.name} autoFocus={row.key >= defaults.length}
          onChange={event => setRows(rows.map(item => item.key === row.key ? { ...item, name: event.target.value } : item))} />
        {row.handlesFinance && <Badge tone="info">구매 승인</Badge>}
        <Button type="button" variant="ghost" size="icon" aria-label={`${row.name.trim() || `부서 ${index + 1}`} 빼기`}
          onClick={() => setRows(rows.filter(item => item.key !== row.key))}><X /></Button>
      </div>)}
      <Button type="button" variant="outline" size="sm" className="self-start"
        onClick={() => setRows([...rows, { key: nextKey.current++, name: '', handlesFinance: false }])}><Plus />부서 추가</Button>
      {duplicate && <StateMessage kind="error">부서 이름이 겹쳐요.</StateMessage>}
      <p className="text-xs text-gray-400">구매 승인 부서는 나중에 바꿀 수 있어요.</p>
    </fieldset>
    {failed && <StateMessage kind="error">학생회를 만들지 못했어요. 다시 시도해 주세요.</StateMessage>}
    <div className="flex gap-2">
      <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>취소</Button>
      <Button type="submit" className="flex-1" disabled={!parsed.success || saving}>{saving ? '만드는 중…' : '학생회 만들기'}</Button>
    </div>
  </form>
}
