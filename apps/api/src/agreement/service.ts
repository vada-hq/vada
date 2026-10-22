import { and, eq } from 'drizzle-orm'
import { isTermsRequired, type AgreementResponse, type Terms } from '@vada/contracts'
import { termsAgreement } from '../db/schema.js'
import type { Db } from '../db/types.js'

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
