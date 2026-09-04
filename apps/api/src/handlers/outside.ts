import type { Handlers } from '../deps.ts'
import { checkIn, checkInForm, checkInResult } from '../public/attendance.ts'
import {
  apply,
  applyForm,
  applyResult,
  collegeOptions,
  departmentOptions,
  linkState,
} from '../public/survey.ts'

// 밖에서 오는 사람 — QR을 찍는 학생과 설문 링크를 받은 학생.
//
// **로그인이 없다.** 링크가 실어 온 열쇠 하나가 유일한 벽이고, 그래서 이 파일의
// 자리들은 하나같이 답을 어디에도 쌓지 못하게 막는다(`Cache-Control: no-store`).

export const outsideHandlers: Handlers = {
  // ── 밖에서 오는 사람 (EXT-01A · EXT-01B) ───────────────────────────────
  //
  // 로그인이 없다. 어느 QR인지는 주소가, 누가 냈는지는 폼이 말한다.
  'attendance.checkInForm': async (c, d) =>
    checkInForm(d.db, c.req.query('checkInToken') ?? '', d.invite),
  // **영수증으로만 연다.** QR 토큰으로 열면 같은 QR을 찍은 남의 결과가 열린다.
  'attendance.checkInResult': async (c, d) => {
    c.header('Cache-Control', 'no-store')
    return checkInResult(d.db, c.req.query('receiptToken') ?? '', d.invite)
  },
  'attendance.checkIn': async (c, d) => {
    const draft = (await c.req.json().catch(() => ({}))) as {
      name?: unknown
      studentNumber?: unknown
    }
    const made = await checkIn(d.db, c.req.param('checkInToken')!, draft, {
      newId: d.newId,
      now: d.invite.now,
    })
    // **영수증을 기록에 남기지 않는다.** 감사 기록이 새면 그것으로 결과가 열린다.
    c.set('auditSubject', { type: 'studentNumber', id: String(draft.studentNumber ?? '') })
    // 열쇠를 담은 답은 어디에도 쌓이면 안 된다.
    c.header('Cache-Control', 'no-store')
    return made
  },


  // ── 링크로 온 신청자 (EXT-02A · EXT-02B · EXT-02C) ─────────────────────
  //
  // **막힌 링크와 열린 링크가 서로 다른 자리로 간다.** 판정은 한 곳에 있고
  // 두 자리가 그것을 뒤집어 쓴다 — 갈림이 두 곳에 적히면 둘 다 답하는 때가 온다.
  'survey.applyForm': async (c, d) =>
    applyForm(d.db, c.req.query('surveyToken') ?? '', d.invite),
  'survey.linkState': async (c, d) => linkState(d.db, c.req.query('surveyToken') ?? '', d.invite),
  // **영수증으로만 연다.** 같은 링크를 여럿이 연다.
  'survey.applyResult': async (c, d) => {
    c.header('Cache-Control', 'no-store')
    return applyResult(d.db, c.req.query('receiptToken') ?? '', d.invite)
  },
  'survey.apply': async (c, d) => {
    const draft = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const made = await apply(d.db, c.req.param('surveyToken')!, draft, {
      newId: d.newId,
      now: d.invite.now,
    })
    // 누구의 것을 다뤘는지는 남기고 영수증은 남기지 않는다.
    c.set('auditSubject', { type: 'studentNumber', id: String(draft.studentNumber ?? '') })
    c.header('Cache-Control', 'no-store')
    return made
  },
  'survey.colleges.options': async (c, d) =>
    collegeOptions(d.db, c.req.query('surveyToken') ?? ''),
  'survey.departments.options': async (c, d) =>
    departmentOptions(d.db, c.req.query('surveyToken') ?? '', c.req.query('collegeId') ?? ''),
}
