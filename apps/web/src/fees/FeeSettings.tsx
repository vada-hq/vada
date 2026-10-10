import { useId, useState } from 'react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card, cardClass } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { dayText } from '../public/registration-text'
import { timeText, todayInSeoul } from '../purchases/purchase-view'
import FeeAccountDialog from './FeeAccountDialog'
import RosterUploadDialog from './RosterUploadDialog'
import { findMembers } from './fee-view'
import { useFeeSettings } from './useFeeSettings'

// 참가비 설정(재정 전용): 참가비를 받는 학생회 계좌와 학생회비 납부 명단.
// 명단은 학번·이름만 두고, 쓰는 기한이 지나면 서버가 지운다. 납부 여부는 재정 담당자만 본다(와이어프레임 ORG-04).
export default function FeeSettings({ organizationId }: { organizationId: string }) {
  const state = useFeeSettings(organizationId, true)
  const [accountOpen, setAccountOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const historyId = useId()
  if (!state.data) return <div className="p-4 sm:p-6">{state.loadError
    ? <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">참가비 설정을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={state.refresh}>다시 시도</Button></Card>
    : <StateMessage kind="loading">참가비 설정을 불러오는 중…</StateMessage>}</div>
  const { account, accountHistory, roster } = state.data
  const found = roster ? findMembers(roster.members, query) : { shown: [], more: false }
  async function remove(version: number) {
    setDeleting(true)
    setMessage('')
    const result = await state.deleteRoster(version)
    setDeleting(false)
    setConfirmDelete(false)
    if (!result.ok) setMessage(result.message)
  }
  return <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <section aria-label="받는 계좌" className={cn(cardClass, 'flex flex-col gap-3 p-4')}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">받는 계좌</h2>
          {account && <Button variant="outline" size="sm" onClick={() => setAccountOpen(true)}>바꾸기</Button>}
        </div>
        {account ? <>
          <dl className="flex flex-col gap-1.5 text-sm">
            <div className="flex gap-3"><dt className="w-14 shrink-0 text-gray-500">은행</dt><dd className="wrap-anywhere text-gray-900">{account.bank}</dd></div>
            <div className="flex gap-3"><dt className="w-14 shrink-0 text-gray-500">계좌번호</dt>
              <dd className="wrap-anywhere text-gray-900">{account.accountNumber}</dd></div>
            <div className="flex gap-3"><dt className="w-14 shrink-0 text-gray-500">예금주</dt><dd className="wrap-anywhere text-gray-900">{account.holder}</dd></div>
          </dl>
          <p className="text-xs text-gray-500">{timeText(account.updatedAt)} · {account.updatedBy.name}</p>
        </> : <>
          <p className="text-sm text-gray-500">아직 학생회 계좌가 없어요. 참가비를 받으려면 계좌를 넣어 주세요.</p>
          <Button className="self-start" onClick={() => setAccountOpen(true)}>계좌 넣기</Button>
        </>}
        {accountHistory.length > 0 && <div className="flex flex-col gap-1 border-t pt-3">
          <h3 id={historyId} className="text-xs font-medium text-gray-500">바꾼 기록</h3>
          <ol aria-labelledby={historyId} className="flex flex-col gap-1">
            {accountHistory.map(entry => <li key={entry.id} className="text-xs wrap-anywhere text-gray-600">
              {timeText(entry.createdAt)} {entry.actor.name} — {entry.to.bank} {entry.to.accountNumber} ({entry.to.holder})</li>)}
          </ol>
        </div>}
      </section>
      <section aria-label="학생회비 납부 명단" className={cn(cardClass, 'flex flex-col gap-3 p-4')}>
        <h2 className="text-sm font-semibold text-gray-900">학생회비 납부 명단</h2>
        {roster ? <>
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-medium wrap-anywhere text-gray-900">{roster.label}</span>
            <span className="text-gray-500">{roster.members.length.toLocaleString('ko-KR')}명</span>
          </p>
          <p className="text-xs text-gray-500">{dayText(roster.useUntil)}까지 쓰고, 그다음 날 지워요.</p>
          <p className="text-xs text-gray-500">올림 · {timeText(roster.uploadedAt)} · {roster.uploadedBy.name}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>새 명단 올리기</Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>명단 지우기</Button>
          </div>
          <Input aria-label="이름이나 학번으로 찾기" placeholder="이름이나 학번으로 찾기" value={query} onChange={event => setQuery(event.target.value)} />
          {query.trim() !== '' && (found.shown.length === 0 ? <StateMessage kind="empty">찾는 사람이 없어요</StateMessage>
            : <ol className="flex flex-col divide-y">
              {found.shown.map(member => <li key={member.studentId} className="flex flex-wrap gap-x-3 py-1.5 text-sm">
                <span className="font-medium wrap-anywhere text-gray-900">{member.name}</span>
                <span className="text-gray-600">{member.studentId}</span>
              </li>)}
            </ol>)}
          {found.more && <p className="text-xs text-gray-500">50명까지만 보여요</p>}
        </> : <>
          <p className="text-sm text-gray-500">올린 명단이 없어요. 학생회비 납부자 참가비를 쓰려면 명단이 필요해요.</p>
          <Button className="self-start" onClick={() => setUploadOpen(true)}>명단 올리기</Button>
        </>}
        {message && <StateMessage kind="error">{message}</StateMessage>}
      </section>
    </div>
    <FeeAccountDialog open={accountOpen} account={account} onClose={() => setAccountOpen(false)} onSubmit={state.setAccount} />
    <RosterUploadDialog open={uploadOpen} current={roster} today={todayInSeoul()} onClose={() => setUploadOpen(false)} onSubmit={state.replaceRoster} />
    <Dialog open={confirmDelete && roster !== null} onOpenChange={open => { if (!open && !deleting) setConfirmDelete(false) }}>
      {roster && <DialogContent>
        <DialogHeader>
          <DialogTitle>명단을 지울까요?</DialogTitle>
          <DialogDescription>지우면 학생회비 납부자 참가비를 쓰는 신청은 새 신청자를 모두 미납자로 봐요. 이미 한 신청은 그대로예요.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={deleting} onClick={() => setConfirmDelete(false)}>돌아가기</Button>
          <Button variant="destructive" disabled={deleting} onClick={() => void remove(roster.version)}>{deleting ? '지우는 중…' : '지우기'}</Button>
        </DialogFooter>
      </DialogContent>}
    </Dialog>
  </div>
}
