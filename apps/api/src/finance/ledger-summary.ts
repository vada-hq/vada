import type { Db } from '../db/client.ts'
import { moment } from '../time.ts'
import { won } from './labels.ts'
import { ledgerLines, PROOF, RECENT, type ProofKey } from './ledger-lines.ts'
import { drawLedgerLine, readLedgerMonth } from './ledger-list.ts'

export interface LedgerSummary {
  termTotal: string
  monthLabel: string
  monthTotal: string
  proofDone: string
  proofMissing: string
}

export async function ledgerSummary(
  db: Db,
  orgId: string,
  askedMonth: string | undefined,
  now: Date,
): Promise<LedgerSummary> {
  const today = moment(now).slice(0, 7)
  const month = readLedgerMonth(askedMonth) ?? today
  const spent = (await ledgerLines(db, orgId)).filter((line) => line.stage === 'spent')
  const inMonth = spent.filter((line) => line.month === month)
  const done = inMonth.filter((line) => line.proof.label === PROOF.done.label).length
  const missing = inMonth.filter((line) => line.proof.label === PROOF.missing.label).length
  const [year, mm] = month.split('-')
  return {
    termTotal: won(spent.reduce((sum, line) => sum + line.amount, 0)),
    monthLabel: `${year === today.slice(0, 4) ? '' : `${year}년 `}${Number(mm)}월 지출`,
    monthTotal: won(inMonth.reduce((sum, line) => sum + line.amount, 0)),
    proofDone: `${inMonth.length}건 중 ${done}건`,
    proofMissing: `${missing}건`,
  }
}

export interface RecentExpense {
  id: string
  date: string
  title: string
  context: string
  amountNote: string
  proof: string
  proofTone: string
}

export async function recentExpenses(db: Db, orgId: string): Promise<RecentExpense[]> {
  const spent = (await ledgerLines(db, orgId)).filter((line) => line.stage === 'spent')
  return spent.slice(0, RECENT).map((line) => {
    const { department: _department, budgetItem: _budgetItem, ...row } = drawLedgerLine(line)
    return row
  })
}

export interface ProofSummary {
  completed: string
  supplement: string
  unregistered: string
  totalNote: string
}

export async function proofSummary(db: Db, orgId: string): Promise<ProofSummary> {
  const spent = (await ledgerLines(db, orgId)).filter((line) => line.stage === 'spent')
  const count = (key: ProofKey) =>
    spent.filter((line) => line.proof.label === PROOF[key].label).length
  return {
    completed: `${count('done')}건`,
    supplement: `${count('checking')}건`,
    unregistered: `${count('missing')}건`,
    totalNote: `${spent.length}건`,
  }
}
