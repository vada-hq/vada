import { eq } from 'drizzle-orm'
import { PUBLIC_CODE_PATTERN, type ApplyRequest } from '@vada/contracts'
import { registrationForm } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { lockedCompleted } from '../events/completion.js'
import { ApiError } from '../http/errors.js'
import { createRecord } from '../records/records.js'
import { appliedFeeOf } from './fee-match.js'
import { addLink, newToken } from './link.js'
import { applicantCountOf, publicRowOf } from './public-form.js'
import { registrationStatusOf } from './state.js'

// 양식 행을 잠근다. 마지막 자리에 두 신청이 겹쳐도 하나씩 줄을 서고, 잠금을 얻은 뒤에 읽어야 앞 신청이 센 수에 들어온다(READ COMMITTED 다시 읽기).
// 양식을 고치는 쪽(정원 줄이기)도 같은 행을 잠그므로 정원과 수가 어긋나지 않는다.
async function lockForm(tx: Tx, code: string) {
  const [locked] = await tx
    .select({ id: registrationForm.id })
    .from(registrationForm)
    .where(eq(registrationForm.publicCode, code))
    .for('update')
  if (!locked) throw new ApiError('NOT_FOUND')
}

// 받는 중이 아니면 던진다. 정원은 양식 행을 잠근 뒤에 센다.
async function assertOpen(tx: Tx, form: Awaited<ReturnType<typeof publicRowOf>>, now: Date) {
  const status = registrationStatusOf(
    {
      opensAt: form.opensAt,
      closesAt: form.closesAt,
      paused: form.pausedAt !== null,
      capacity: form.capacity,
      applicantCount: await applicantCountOf(tx, form.id),
    },
    now,
  )
  if (status === 'full') throw new ApiError('REGISTRATION_FULL')
  if (status !== 'open') throw new ApiError('REGISTRATION_NOT_OPEN')
}

// 받지 않는 칸이 오거나 받는 칸이 없으면 열린 화면이 낡았다는 뜻이다(409 FORM_CHANGED).
function assertFieldsMatch(input: ApplyRequest, wants: { studentId: boolean; phone: boolean }) {
  if ((input.studentId !== null) !== wants.studentId || (input.phone !== null) !== wants.phone)
    throw new ApiError('FORM_CHANGED')
}

// 로그인 없이 코드로 신청한다. 신청하면 개인 링크 토큰을 한 번만 돌려준다.
// 모르는 코드는 404, 받는 중이 아니면 REGISTRATION_NOT_OPEN(마감·멈춤·시작 전), 정원 참은 REGISTRATION_FULL이다.
// 같은 학번이 이미 있어도 막지 않는다(막으면 남의 학번으로 신청 여부를 떠볼 수 있다, DEC-26).
export async function applyToForm(
  tx: Tx,
  target: { code: string; now: Date },
  input: ApplyRequest,
): Promise<{ token: string }> {
  const code = target.code.toUpperCase()
  if (!PUBLIC_CODE_PATTERN.test(code)) throw new ApiError('NOT_FOUND')
  // 학생회 행을 잠그지 않는 경로(선착순이 다른 변경 뒤에 줄 서지 않게)라 완료와는 행사 행에서 만난다(DEC-68). 양식 행 잠금보다 먼저다.
  // 신청자에게는 완료가 아니라 받지 않는 양식으로 보인다.
  if (await lockedCompleted(tx, [(await publicRowOf(tx, code)).eventId]))
    throw new ApiError('REGISTRATION_NOT_OPEN')
  await lockForm(tx, code)
  const form = await publicRowOf(tx, code)
  await assertOpen(tx, form, target.now)
  // 학번은 두 참가비가 다를 때만 받는다(DEC-62).
  assertFieldsMatch(input, {
    studentId: form.payerFee !== form.nonPayerFee,
    phone: form.collectsPhone,
  })
  // 양식 기록은 늘 학생회 번호가 있다(학생회 번호가 없는 것은 학생회와 운영진뿐이다).
  const councilId = form.councilId
  if (councilId === null) throw new ApiError('NOT_FOUND')
  const registrationId = await createRecord(tx, {
    kind: 'registration',
    councilId,
    actor: null,
    values: {
      formId: form.id,
      name: input.name,
      studentId: input.studentId,
      phone: input.phone,
      appliedFee: String(
        await appliedFeeOf(tx, {
          councilId,
          form,
          studentId: input.studentId,
          now: target.now,
        }),
      ),
    },
  })
  const token = newToken()
  await addLink(tx, registrationId, token)
  return { token }
}
