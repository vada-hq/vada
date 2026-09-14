import { useRef, useState } from 'react'
import { readObjectSource } from '../../data-sources/catalog'
import { elementByNodeId, org07b } from '../../spec/screens'
import type { ButtonSpec, InputSpec, StepsSpec, SummarySpec } from '../../spec/types'
import { STUDENT_ROSTER_UPLOAD_NODE as NODE } from './config'

export function useStudentRosterUpload(onNavigate: (screenId: string) => void) {
  const head = elementByNodeId(org07b, NODE.head).spec as SummarySpec
  const close = elementByNodeId(org07b, NODE.close).spec as ButtonSpec
  const steps = elementByNodeId(org07b, NODE.steps).spec as StepsSpec
  const intro = elementByNodeId(org07b, NODE.intro).spec as SummarySpec
  const file = elementByNodeId(org07b, NODE.file).spec as InputSpec
  const note = elementByNodeId(org07b, NODE.note).spec as SummarySpec
  const cancel = elementByNodeId(org07b, NODE.cancel).spec as ButtonSpec
  const verify = elementByNodeId(org07b, NODE.verify).spec as ButtonSpec
  const [step] = useState(steps.items[0].key)
  const [chosenFile, setChosenFile] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const scope = readObjectSource(head.dataSourceKey)

  function goBack() {
    if (close.action.type === 'navigate') onNavigate(close.action.targetScreenId)
  }

  function verifyFile() {
    if (verify.action.type === 'pending') setPending(verify.action.note)
  }

  return {
    head,
    close,
    steps,
    intro,
    file,
    note,
    cancel,
    verify,
    step,
    chosenFile,
    setChosenFile,
    pending,
    fileInput,
    scope,
    goBack,
    verifyFile,
  }
}

export type StudentRosterUploadModel = ReturnType<typeof useStudentRosterUpload>
