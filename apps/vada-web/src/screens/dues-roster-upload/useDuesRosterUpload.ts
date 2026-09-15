import { useRef, useState } from 'react'
import { elementByNodeId } from '../../spec/screens'
import { org07c } from '../../spec/screen-specs/org07c'
import type { ButtonSpec, InputSpec, SelectSpec, StepsSpec, SummarySpec } from '../../spec/types'
import { DUES_ROSTER_NODE as NODE } from './config'

export interface DuesTermOption {
  value: string
  label: string
}

export function useDuesRosterUpload(onNavigate: (screenId: string) => void) {
  const head = elementByNodeId(org07c, NODE.head).spec as SummarySpec
  const close = elementByNodeId(org07c, NODE.close).spec as ButtonSpec
  const steps = elementByNodeId(org07c, NODE.steps).spec as StepsSpec
  const term = elementByNodeId(org07c, NODE.term).spec as SelectSpec
  const file = elementByNodeId(org07c, NODE.file).spec as InputSpec
  const note = elementByNodeId(org07c, NODE.note).spec as SummarySpec
  const cancel = elementByNodeId(org07c, NODE.cancel).spec as ButtonSpec
  const verify = elementByNodeId(org07c, NODE.verify).spec as ButtonSpec
  const [step] = useState(steps.items[0].key)
  const [chosenTerm, setChosenTerm] = useState<DuesTermOption | null>(null)
  const [chosenFile, setChosenFile] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

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
    term,
    file,
    note,
    cancel,
    verify,
    step,
    chosenTerm,
    setChosenTerm,
    chosenFile,
    setChosenFile,
    pending,
    fileInput,
    goBack,
    verifyFile,
  }
}

export type DuesRosterUploadModel = ReturnType<typeof useDuesRosterUpload>
