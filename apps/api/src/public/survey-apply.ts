import type { Db } from '../db/client.ts'
import { surveyApplications } from '../db/schema.ts'
import { AlreadyExists, Blocked } from '../errors.ts'
import type { Clock, Ids } from './attendance.ts'
import { blockOf, surveyOf } from './survey-link.ts'
import { hashToken, newToken } from './tokens.ts'

/** 영수증이 얼마나 사는가. 참석과 같다. */
const RECEIPT_LIFE_MS = 1000 * 60 * 60 * 24

export interface ApplyDraft {
  name?: unknown
  studentNumber?: unknown
  college?: unknown
  department?: unknown
  currentGrade?: unknown
  motivation?: unknown
  privacyConsent?: unknown
}

function word(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * 참여 신청을 보낸다(EXT-02A).
 *
 * 참석과 같은 규칙이다 — **같은 사람이 두 번 내는 것은 표가 막고**, 막혔을 때
 * **영수증을 돌려주지 않는다**. 학번은 아무나 적을 수 있는 값이고 영수증은 그 사람만
 * 가져야 하는 값이므로 앞의 것으로 뒤의 것을 가릴 수 없다.
 */
export async function apply(
  db: Db,
  token: string,
  draft: ApplyDraft,
  make: Ids & Clock,
): Promise<{ receiptToken: string }> {
  const name = word(draft.name)
  const studentNumber = word(draft.studentNumber)
  const college = word(draft.college)
  const department = word(draft.department)
  const currentGrade = word(draft.currentGrade)
  if (name === '' || studentNumber === '' || college === '' || department === '' || currentGrade === '') {
    throw new Blocked('필수 항목을 모두 적어 주세요')
  }
  // **동의는 참이어야 한다.** 계약이 필수라 적은 것은 '칸이 있다'가 아니라
  // '동의를 받았다'는 뜻이고, 거짓인 채로 받으면 그 신청은 근거 없이 모은 정보다.
  if (draft.privacyConsent !== true) {
    throw new Blocked('개인정보 수집·이용에 동의해야 신청할 수 있습니다')
  }

  const survey = await surveyOf(db, token)
  const now = make.now()
  const blocked = await blockOf(db, survey, now)
  if (blocked !== null) throw new Blocked(blocked.note)

  const receipt = newToken()
  try {
    await db.insert(surveyApplications).values({
      id: make.newId(),
      surveyId: survey.id,
      name,
      studentNumber,
      college,
      department,
      grade: currentGrade,
      motivation: word(draft.motivation) === '' ? null : word(draft.motivation),
      receiptHash: hashToken(receipt),
      receiptExpiresAt: new Date(now.getTime() + RECEIPT_LIFE_MS),
      privacyConsentAt: now,
      at: now,
    })
  } catch {
    // **이미 낸 사실만 알린다.** 영수증은 주지 않는다.
    throw new AlreadyExists('이미 신청했습니다')
  }
  return { receiptToken: receipt }
}
