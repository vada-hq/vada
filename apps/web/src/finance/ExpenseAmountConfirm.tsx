import { ConfirmDialog } from '@/components/ConfirmDialog'

type Props = {
  busy: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}

export function ExpenseAmountConfirm(props: Props) {
  return <ConfirmDialog title="금액과 자릿수를 확인하세요" confirmLabel="그래도 적기" {...props} />
}
