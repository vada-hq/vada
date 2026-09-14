import { and, asc, count, eq, ilike, or } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { students } from '../db/schema.ts'

const PER_PAGE = 20
const DUES: Record<string, { label: string; tone: string; rowTone: string }> = {
  paid: { label: '납부', tone: 'green', rowTone: '' },
  unpaid: { label: '미납', tone: 'red', rowTone: '' },
  check: { label: '확인 필요', tone: 'yellow', rowTone: 'yellow' },
}

export interface RosterQuery {
  query?: string
  grade?: string
  duesStatus?: string
  page?: string
}

function narrowing(orgId: string, asked: RosterQuery) {
  const parts = [eq(students.orgId, orgId)]
  const query = (asked.query ?? '').trim()
  if (query !== '') {
    parts.push(or(ilike(students.name, `%${query}%`), ilike(students.studentNumber, `%${query}%`))!)
  }
  const grade = (asked.grade ?? '').trim()
  if (grade !== '' && grade !== 'all') parts.push(eq(students.grade, grade))
  const dues = (asked.duesStatus ?? '').trim()
  if (dues !== '' && dues !== 'all' && dues in DUES) {
    parts.push(eq(students.duesStatus, dues as 'paid' | 'unpaid' | 'check'))
  }
  return and(...parts)
}

export interface StudentRow {
  id: string
  name: string
  studentNumber: string
  college: string
  department: string
  grade: string
  duesLabel: string
  duesTone: string
  rowTone: string
}

export async function roster(db: Db, orgId: string, asked: RosterQuery): Promise<StudentRow[]> {
  const page = Math.max(1, Number.parseInt(asked.page ?? '1', 10) || 1)
  const rows = await db
    .select({
      id: students.id,
      name: students.name,
      studentNumber: students.studentNumber,
      college: students.college,
      department: students.department,
      grade: students.grade,
      duesStatus: students.duesStatus,
    })
    .from(students)
    .where(narrowing(orgId, asked))
    .orderBy(asc(students.studentNumber))
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE)
  return rows.map((row) => {
    const dues = DUES[row.duesStatus] ?? DUES.unpaid!
    return {
      id: row.id,
      name: row.name,
      studentNumber: row.studentNumber,
      college: row.college ?? '',
      department: row.department ?? '',
      grade: row.grade ?? '',
      duesLabel: dues.label,
      duesTone: dues.tone,
      rowTone: dues.rowTone,
    }
  })
}

export interface RosterPaging {
  totalNote: string
  pageCount: number
}

export async function rosterPaging(
  db: Db,
  orgId: string,
  asked: RosterQuery,
): Promise<RosterPaging> {
  const rows = await db.select({ total: count() }).from(students).where(narrowing(orgId, asked))
  const total = rows[0]?.total ?? 0
  return {
    totalNote: `총 ${total.toLocaleString('ko-KR')}명`,
    pageCount: Math.max(1, Math.ceil(total / PER_PAGE)),
  }
}
