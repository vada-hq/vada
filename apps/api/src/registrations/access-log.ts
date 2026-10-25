import type { Actor } from '../access/actor.js'
import { applicantAccessLog } from '../db/schema.js'
import type { Tx } from '../db/types.js'

// 신청자 정보(이름, 학번, 휴대폰)를 응답에 담는 거래는 이 기록을 같은 거래에서 남긴다(DEC-56, 안전성 확보조치 기준의 접속기록).
// 거래가 하나라서 기록을 못 쓰면 응답도 없다. 응답을 만들기 전에 불러, 기록 쓰기에서 던지면 신청자 정보가 나가지 않는다.
// 시각은 DB 기본값(now())이고 시나리오 시계(clockNow)를 따르지 않는다. 접속기록은 실제로 열람한 때를 남겨야 해서, 시계를 미룬 흐름에서도 실제 시각이다. 요청 IP는 부르는 쪽이 clientIpOf로 정한다.
export async function recordApplicantAccess(
  tx: Tx,
  access: {
    actor: Actor
    formId: string
    registrationId: string | null
    action: 'list' | 'check_in'
    ip: string
  },
) {
  await tx.insert(applicantAccessLog).values({
    memberId: access.actor.memberId,
    councilId: access.actor.councilId,
    formId: access.formId,
    registrationId: access.registrationId,
    action: access.action,
    ip: access.ip,
  })
}
