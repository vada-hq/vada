import { useRef, useState } from 'react'
import type { CreateCouncilRequest, CreateCouncilResponse, MyCouncil } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { CREATE_COUNCIL_ERRORS, CREATE_COUNCIL_FAILED } from '@/lib/messages'

// 학생회 만들기 요청: 보내는 중과 오류 문구. 학생회는 2단계의 [학생회 만들기] 한 요청, 한 거래로 생긴다(기능 020 정한 것 1).
// 보내는 중에는 다시 보내지 않는다(버튼은 busy로 꺼지고, 입력칸의 Enter로 다시 보내는 것도 막는다).
export function useCreateCouncil() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const sending = useRef(false)

  async function submit(body: CreateCouncilRequest): Promise<MyCouncil | null> {
    if (sending.current) return null
    sending.current = true
    setSaving(true)
    setError('')
    const result = await postJson<CreateCouncilResponse>('/api/organizations/create', body)
    // 만들었으면 곧바로 초대 링크 단계로 넘어가므로 막아 둔 채로 둔다.
    if (result.ok) return result.data.council
    sending.current = false
    setSaving(false)
    setError(CREATE_COUNCIL_ERRORS[result.code] ?? CREATE_COUNCIL_FAILED)
    return null
  }
  return { saving, error, submit }
}
