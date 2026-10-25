import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { dateFromKorean, koreanDateTime } from '@vada/contracts'
import { cohort, councilMembership, inviteCode, member } from '../src/db/schema.js'
import type { Db } from '../src/db/types.js'
import {
  ERASED_BY_REQUEST,
  eraseMessages,
  erasePlanOf,
  type EraseCounts,
  type EraseScope,
} from '../src/chat/erase.js'
import type { FileStorage } from '../src/storage/storage.js'
import { joinedDisplayNameOf } from '../src/team/display-name.js'
import { flagsOf, isEmail, optionsOf, type Flags, type Outcome } from './privacy-args.js'

// privacy erase-messages(기능 021 정한 것 14, DEC-54, DEC-88): 학생회의 요청으로 한 사람이 정한 때 사이에 보낸 메시지와 사진을 지운다.
// 학생회는 초대 코드로 가린다. 학생회 번호나 이름을 DB에서 찾아보지 않으려는 것이다. 보낸 사람은 그 학생회 운영진의 이메일이나,
// 탈퇴해 이메일이 없으면 '떠난 운영진 N'의 N이다. 때는 한국 시각의 분(YYYY-MM-DDTHH:MM)이고 --to의 그 분까지 넣는다.
// 출력은 개수뿐이다. 본문·이름·이메일·번호·저장소 위치는 찍지 않는다(DEC-56, AGENTS.md '로그·비밀').
// --apply는 --expect가 미리 보기의 메시지 개수와 같을 때만 쓴다. 차례: 저장소의 사진 객체를 지우고, 그다음 한 거래로 비운다.
// 거래가 실패해도 다시 돌리면 끝까지 간다(이미 지운 객체는 저장소가 성공으로 본다).

const INVITE = /^[2-9A-HJ-NP-Z]{8}$/
const MINUTE_MS = 60_000
const LEFT_MAX = 100_000
const EXPECT_MAX = 1_000_000

type Sender = { email: string } | { left: number }
export type EraseArgs = Flags & {
  command: 'erase-messages'
  invite: string
  sender: Sender
  from: Date
  until: Date
  expect: number | null
}

function wholeNumber(value: string | undefined, min: number, max: number) {
  if (value === undefined || !/^\d{1,7}$/.test(value)) return null
  const number = Number(value)
  return number >= min && number <= max ? number : null
}

function senderOf(values: Map<string, string>): Sender | null {
  const email = values.get('--sender')
  const left = values.get('--left')
  if ((email === undefined) === (left === undefined)) return null
  if (email !== undefined) return isEmail(email) ? { email } : null
  const n = wholeNumber(left, 1, LEFT_MAX)
  return n === null ? null : { left: n }
}

// 한국 시각의 분 두 개. --to는 그 분 끝까지 넣어 [from, until)이다. 달력에 없는 시각(2026-02-30)은 받지 않는다.
function rangeOf(values: Map<string, string>) {
  const from = values.get('--from')
  const to = values.get('--to')
  const valid = (value: string | undefined): value is string =>
    value !== undefined && koreanDateTime.safeParse(value).success
  if (!valid(from) || !valid(to) || to < from) return null
  return {
    from: dateFromKorean(from),
    until: new Date(dateFromKorean(to).getTime() + MINUTE_MS),
  }
}

// --expect가 없으면 null, 있는데 틀리면 undefined다.
const expectOf = (values: Map<string, string>) =>
  values.has('--expect') ? (wholeNumber(values.get('--expect'), 0, EXPECT_MAX) ?? undefined) : null

const NAMES = ['--invite', '--sender', '--left', '--from', '--to', '--expect']
// erase-messages 뒤의 인자. 틀리면 null이다.
export function parseEraseArgs(rest: readonly string[]): EraseArgs | null {
  const options = optionsOf(rest, NAMES)
  const flags = options && flagsOf(options.flags)
  if (!options || !flags) return null
  const invite = options.values.get('--invite')?.toUpperCase()
  const sender = senderOf(options.values)
  const range = rangeOf(options.values)
  const expect = expectOf(options.values)
  if (!invite || !INVITE.test(invite) || !sender || !range || expect === undefined) return null
  return { command: 'erase-messages', invite, sender, ...range, expect, ...flags }
}

// 그 학생회에 소속(어느 기수든)이 있었던 운영진
const inCouncil = (councilId: string) =>
  sql`EXISTS (SELECT 1 FROM ${councilMembership} JOIN ${cohort} ON ${cohort.id} = ${councilMembership.cohortId}
    WHERE ${councilMembership.memberId} = ${member.id} AND ${cohort.councilId} = ${councilId}::uuid)`

async function senderIdOf(db: Pick<Db, 'select'>, councilId: string, sender: Sender) {
  const which =
    'email' in sender
      ? and(isNull(member.leftAt), sql`lower(${member.email}) = lower(${sender.email})`)
      : and(
          isNotNull(member.leftAt),
          eq(joinedDisplayNameOf(member, councilId), `떠난 운영진 ${sender.left}`),
        )
  const rows = await db
    .select({ id: member.id })
    .from(member)
    .where(and(which, inCouncil(councilId)))
  // 같은 이메일의 운영진이 둘이면 누구의 메시지인지 가릴 수 없어 멈춘다.
  return rows.length === 1 ? rows[0]!.id : null
}

async function scopeOf(db: Pick<Db, 'select'>, args: EraseArgs): Promise<EraseScope | string> {
  const [found] = await db
    .select({ councilId: inviteCode.councilId })
    .from(inviteCode)
    .where(eq(inviteCode.code, args.invite))
  if (!found) return NO_COUNCIL
  const senderId = await senderIdOf(db, found.councilId, args.sender)
  if (!senderId) return NO_SENDER
  return { councilId: found.councilId, senderId, from: args.from, until: args.until }
}

const NO_COUNCIL = '그 초대 코드의 학생회가 없다. 아무것도 바꾸지 않았다.'
const NO_SENDER = '그 학생회에서 그 운영진을 하나로 찾지 못했다. 아무것도 바꾸지 않았다.'
export const NO_EXPECT =
  '--apply에는 미리 보기의 메시지 개수를 --expect <개수>로 함께 준다. 아무것도 하지 않았다.'
export const NO_STORAGE =
  '사진을 지울 저장소가 없다. R2 설정(R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)을 .env나 셸에 준다. 아무것도 하지 않았다.'
const STORAGE_FAILED =
  '저장소에서 사진을 지우지 못했다. DB는 바꾸지 않았다. 같은 명령을 다시 돌리면 이어서 지운다. 오류 원문은 출력하지 않는다.'
const CHANGED = '미리 보기 뒤에 지울 메시지가 바뀌었다. DB는 바꾸지 않았다. 미리 보기를 다시 본다.'

const countsLine = (counts: EraseCounts) =>
  `메시지 ${counts.messages}, 판 ${counts.versions}, 사진 파일 ${counts.files}, 저장소 객체 ${counts.objects}, 이미 지운 메시지 ${counts.alreadyErased}`

const stop = (line: string): Outcome => ({ code: 1, line, error: true })

export async function previewErase(db: Db, args: EraseArgs): Promise<Outcome> {
  const scope = await scopeOf(db, args)
  if (typeof scope === 'string') return stop(scope)
  const { counts } = await erasePlanOf(db, scope)
  return {
    code: 0,
    line: `지울 것: ${countsLine(counts)}. 미리 보기라 바꾸지 않았다. 실제로 하려면 같은 명령에 --expect ${counts.messages} --apply를 붙인다.`,
  }
}

class Changed extends Error {}
const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index])

export async function applyErase(db: Db, storage: FileStorage, args: EraseArgs): Promise<Outcome> {
  const scope = await scopeOf(db, args)
  if (typeof scope === 'string') return stop(scope)
  const plan = await erasePlanOf(db, scope)
  if (plan.counts.messages !== args.expect)
    return stop(
      `지울 메시지가 ${plan.counts.messages}개라 --expect ${args.expect}와 다르다. 아무것도 바꾸지 않았다.`,
    )
  try {
    for (const key of plan.storageKeys) await storage.remove(key)
  } catch {
    return stop(STORAGE_FAILED)
  }
  try {
    await db.transaction(async tx => {
      const again = await erasePlanOf(tx, scope)
      if (!sameIds(again.messageIds, plan.messageIds)) throw new Changed()
      await eraseMessages(tx, plan.messageIds, { actor: null, reason: ERASED_BY_REQUEST })
    })
  } catch (error) {
    if (error instanceof Changed) return stop(CHANGED)
    throw error
  }
  return { code: 0, line: `지움: ${countsLine(plan.counts)}` }
}
