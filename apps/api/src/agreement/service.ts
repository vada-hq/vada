import { and, eq, isNull, sql } from 'drizzle-orm'
import { isTermsRequired, type AgreementResponse, type Terms } from '@vada/contracts'
import { termsAgreement } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { clockNow } from '../records/records.js'

// 이 사람이 지금 판 둘에 동의했는지. 지난 판에만 동의했으면 아니다.
export async function hasAgreed(db: Db, userId: string, terms: Terms) {
  const rows = await db
    .select({ id: termsAgreement.id })
    .from(termsAgreement)
    .where(
      and(
        eq(termsAgreement.userId, userId),
        eq(termsAgreement.termsVersion, terms.termsVersion),
        eq(termsAgreement.privacyVersion, terms.privacyVersion),
      ),
    )
    .limit(1)
  return rows.length > 0
}

// 같은 판을 다시 보내도 줄이 늘지 않는다. 기록은 고치지 않고 판마다 한 줄 더한다.
export async function recordAgreement(db: Db, userId: string, terms: Terms) {
  await db
    .insert(termsAgreement)
    .values({
      userId,
      termsVersion: terms.termsVersion,
      privacyVersion: terms.privacyVersion,
    })
    .onConflictDoNothing()
}

export async function agreementOf(
  db: Db,
  userId: string,
  terms: Terms,
): Promise<AgreementResponse> {
  const required = isTermsRequired(terms)
  // 동의할 약관이 없으면 기록도 없다. 막지 않으므로 동의한 것으로 보지는 않는다.
  return { ...terms, required, agreed: required && (await hasAgreed(db, userId, terms)) }
}

// 탈퇴하면 그 계정의 동의 기록에 탈퇴한 시각을 적는다. 기록은 탈퇴하고 1년 남는다(DEC-51, DEC-55).
export async function markAgreementsWithdrawn(tx: Tx, userId: string) {
  await tx
    .update(termsAgreement)
    .set({ withdrawnAt: clockNow })
    .where(and(eq(termsAgreement.userId, userId), isNull(termsAgreement.withdrawnAt)))
}

// 기한 파기: 탈퇴하고 1년이 지난 동의 기록을 지운다(DEC-55). 같은 일을 두 번 해도 같다.
export async function purgeAgreements(tx: Tx, now: Date) {
  await tx.execute(sql`DELETE FROM terms_agreement
    WHERE withdrawn_at <= (${now.toISOString()}::timestamptz - interval '1 year')`)
}
